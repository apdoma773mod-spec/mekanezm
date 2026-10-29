'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useAllProducts, useCreateCount } from '@/lib/trade-queries';
import { CameraScanner } from '../scan/camera-scanner';
import { Portal } from '../ui/portal';
import { Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/** 🗂️ جلسات الجرد (على أكتر من يوم): بتتحفظ وتكمّل منها، والفرق المتوقع بيتحسب من رصيد وقت العد + حركة البيع/الشراء بعده،
 *  والمخزون ما يتعدلش غير عند «اعتماد». نفس الشكل والكلام بتاع القديم، والجلسات محفوظة على السيرفر (Setting count_sessions). */
const KEY = 'count_sessions';
interface Item {
  start: number;
  cnt: string | null;
  qAt: number | null;
}
interface Session {
  id: string;
  name: string;
  cat: string;
  created: string;
  status: 'open' | 'closed';
  approved?: string;
  items: Record<string, Item>;
}
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return Number.isNaN(n) ? 0 : n;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const done = (it: Item) => it.cnt != null && it.cnt !== '';

export function CountSessions() {
  const { close } = useModal();
  const toast = useToast();
  const settings = useSettings().data;
  const products = useAllProducts({}).data;
  const createCount = useCreateCount();
  const [S, setS] = useState<Session[] | null>(null);
  const [curId, setCurId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | 'pending' | 'done' | 'diff'>('all');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef<Session[] | null>(null);

  useEffect(() => {
    api
      .get<{ value: Session[] | null }>(`/work/kv/${KEY}`)
      .then((r) => {
        const v = Array.isArray(r.value) ? r.value : [];
        live.current = v;
        setS(v);
      })
      .catch(() => setS([]));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const persist = useCallback((next: Session[]) => {
    live.current = next;
    setS(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void api.put(`/work/kv/${KEY}`, { value: live.current }).catch(() => undefined), 700);
  }, []);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const cats = useMemo(() => [...new Set((products ?? []).map((p) => p.category || '').filter(Boolean))].sort(), [products]);
  const cur = S?.find((x) => x.id === curId) ?? null;

  const stats = (s: Session) => {
    let counted = 0;
    let sh = 0;
    let su = 0;
    let shv = 0;
    let suv = 0;
    const ids = Object.keys(s.items);
    ids.forEach((id) => {
      const it = s.items[id]!;
      if (!done(it)) return;
      counted++;
      const d = r2(num(it.cnt) - num(it.qAt));
      const cost = byId.get(id)?.cost ?? 0;
      if (d < 0) {
        sh += -d;
        shv += -d * cost;
      } else if (d > 0) {
        su += d;
        suv += d * cost;
      }
    });
    return { total: ids.length, counted, sh, su, shv, suv };
  };

  const setCnt = (s: Session, pid: string, v: string) => {
    if (s.status !== 'open') return;
    const it = s.items[pid];
    if (!it) return;
    const p = byId.get(pid);
    const nx: Item = v === '' ? { ...it, cnt: null, qAt: null } : { ...it, cnt: v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))), qAt: it.cnt == null || it.cnt === '' || it.qAt == null ? num(p?.qty ?? 0) : it.qAt };
    persist((live.current ?? []).map((x) => (x.id === s.id ? { ...x, items: { ...x.items, [pid]: nx } } : x)));
  };

  const approve = async (s: Session) => {
    const ch: { p: ProductDto; nq: number; from: number }[] = [];
    Object.keys(s.items).forEach((pid) => {
      const it = s.items[pid]!;
      const p = byId.get(pid);
      if (!p || !done(it)) return;
      const nq = Math.max(0, r2(num(it.cnt) + (p.qty - num(it.qAt))));
      if (nq !== p.qty) ch.push({ p, nq, from: p.qty });
    });
    const left = Object.keys(s.items).length - stats(s).counted;
    const msg = `هتعتمد الجرد "${s.name}":\n• ${ch.length} صنف هيتعدّل رصيده\n• ${left} صنف لسه ماتعدّش (مش هيتأثر)\n${ch
      .slice(0, 8)
      .map((x) => `- ${x.p.name}: ${x.from} ← ${x.nq}`)
      .join('\n')}${ch.length > 8 ? '\n...' : ''}\n\nالرصيد الجديد = العدد + الحركة اللي حصلت بعد العد. مينفعش يترجع. نكمّل؟`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      if (ch.length) await createCount.mutateAsync({ items: ch.map((x) => ({ productId: x.p.id, counted: x.nq })), note: `جلسة جرد: ${s.name}` });
      persist((live.current ?? []).map((x) => (x.id === s.id ? { ...x, status: 'closed' as const, approved: new Date().toISOString() } : x)));
      toast(`✔ اتعتمد الجرد وتعدّل ${ch.length} صنف`);
      setCurId(null);
    } catch (e) {
      toast(`مقدرتش أكمّل: ${errorMessage(e)}`, 'bad');
    }
    setBusy(false);
  };

  const printSheet = (s: Session) => {
    if (!settings) return;
    const rows = Object.keys(s.items)
      .map((pid) => ({ p: byId.get(pid)!, it: s.items[pid]! }))
      .filter((x) => x.p)
      .sort((a, b) => (a.p.category || '').localeCompare(b.p.category || '') || a.p.name.localeCompare(b.p.name, 'ar'));
    printHtml(
      reportHtml(
        {
          title: `ورقة جرد — ${s.name}`,
          range: `${s.created.slice(0, 10)}${s.cat ? ` — ${s.cat}` : ''}`,
          sum: [],
          head: ['#', 'الصنف', 'الكود', 'بالسيستم', 'العدد الفعلي'],
          rows: rows.map((x, i) => [String(i + 1), x.p.name, x.p.code || '', String(done(x.it) ? num(x.it.qAt) : x.p.qty), done(x.it) ? String(x.it.cnt) : '']),
        },
        settings,
      ),
    );
  };

  const btn = (primary: boolean) => ({ padding: '13px 16px', fontSize: 16, fontWeight: 700, borderRadius: 12 }) as const;
  const field = { width: '100%', padding: 12, marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 } as const;

  let body;
  if (!S || !products) body = <Loading />;
  else if (!cur) {
    body = (
      <>
        <div className="card" style={{ marginTop: 12 }}>
          <b>جلسة جديدة</b>
          <input placeholder="اسم الجلسة (مثال: جرد رف الأكر)" value={name} onChange={(e) => setName(e.target.value)} style={field} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={field}>
            <option value="">كل المخزن</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="primary"
              style={btn(true)}
              onClick={() => {
                const items: Record<string, Item> = {};
                products.filter((p) => !cat || (p.category || '') === cat).forEach((p) => (items[p.id] = { start: p.qty, cnt: null, qAt: null }));
                const s: Session = { id: `cs${Date.now().toString(36)}`, name: name.trim() || `جرد ${new Date().toISOString().slice(0, 10)}`, cat, created: new Date().toISOString(), status: 'open', items };
                persist([...(live.current ?? []), s]);
                setName('');
                setCurId(s.id);
              }}
            >
              ابدأ الجلسة
            </button>
          </div>
        </div>
        {S.length ? (
          [...S].reverse().map((s) => {
            const t = stats(s);
            return (
              <div key={s.id} className="card" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{s.name}</b>
                  <span className={`badge ${s.status === 'open' ? '' : 'green'}`}>{s.status === 'open' ? 'مفتوحة' : 'اتعتمدت'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {s.created.slice(0, 10)}
                  {s.cat ? ` — ${s.cat}` : ' — كل المخزن'}
                </div>
                <div style={{ margin: '6px 0' }}>
                  اتعدّ <b>{t.counted}</b> من <b>{t.total}</b>
                </div>
                <div style={{ height: 8, background: '#e5eef0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${t.total ? Math.round((t.counted / t.total) * 100) : 0}%`, background: '#087f8c' }} />
                </div>
                <div className="btnrow" style={{ marginTop: 8 }}>
                  <button type="button" className="primary" onClick={() => setCurId(s.id)}>
                    {s.status === 'open' ? 'كمّل' : 'عرض'}
                  </button>
                  <button
                    type="button"
                    className="secondary danger"
                    onClick={() => {
                      if (window.confirm('تمسح الجلسة دي؟ (المخزون مش هيتأثر)')) persist((live.current ?? []).filter((x) => x.id !== s.id));
                    }}
                  >
                    مسح
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="empty">مفيش جلسات لسه.</div>
          </div>
        )}
      </>
    );
  } else {
    const s = cur;
    const open = s.status === 'open';
    const t = stats(s);
    const w = vn(q).split(' ').filter(Boolean);
    const rows = Object.keys(s.items)
      .map((pid) => ({ pid, p: byId.get(pid), it: s.items[pid]! }))
      .filter((x): x is { pid: string; p: ProductDto; it: Item } => !!x.p)
      .filter((x) => {
        if (st === 'pending' && done(x.it)) return false;
        if (st === 'done' && !done(x.it)) return false;
        if (st === 'diff' && (!done(x.it) || r2(num(x.it.cnt) - num(x.it.qAt)) === 0)) return false;
        const h = vn(`${x.p.name} ${x.p.code} ${x.p.barcode ?? ''}`);
        return w.every((k) => h.includes(k));
      })
      .slice(0, 120);
    body = (
      <>
        <div className="card" style={{ marginTop: 10, lineHeight: 1.9 }}>
          اتعدّ <b>{t.counted}</b> / {t.total} — عجز <b style={{ color: '#c0392b' }}>{r2(t.sh)}</b> ({money(t.shv)}) — زيادة <b style={{ color: '#159447' }}>{r2(t.su)}</b> ({money(t.suv)})
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input placeholder="🔍 اسم أو كود" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 }} />
          <button type="button" className="secondary" style={{ width: 52, fontSize: 22, borderRadius: 12 }} onClick={() => open && setScanning(true)}>
            📷
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 8 }}>
          {(
            [
              ['all', 'الكل'],
              ['pending', 'لسه'],
              ['done', 'اتعدّ'],
              ['diff', 'فيه فرق'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={st === k ? 'primary' : 'secondary'} style={{ flex: 'none', padding: '9px 14px', borderRadius: 99 }} onClick={() => setSt(k)}>
              {l}
            </button>
          ))}
        </div>
        <div>
          {rows.length ? (
            rows.map((x) => {
              const c = done(x.it);
              const cu = x.p.qty;
              const qAt = c ? num(x.it.qAt) : cu;
              const d = c ? r2(num(x.it.cnt) - qAt) : null;
              const mv = c ? r2(cu - qAt) : 0;
              return (
                <div key={x.pid} className="card" style={{ marginTop: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b style={{ flex: 1 }}>{x.p.name}</b>
                    <small style={{ color: 'var(--muted)' }}>{x.p.code || ''}</small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      بالسيستم: <b>{cu}</b>
                      {mv ? <span style={{ color: '#d97706' }}> (اتحرك {mv > 0 ? '+' : ''}{mv} بعد العد)</span> : null}
                    </div>
                    <input
                      disabled={!open}
                      inputMode="decimal"
                      placeholder="العدد"
                      value={c ? (x.it.cnt ?? '') : ''}
                      onChange={(e) => setCnt(s, x.pid, e.target.value)}
                      style={{ width: 90, padding: 11, fontSize: 18, textAlign: 'center', border: `2px solid ${c ? '#087f8c' : 'var(--border)'}`, borderRadius: 10 }}
                    />
                    <b style={{ width: 56, textAlign: 'center', color: d == null ? 'inherit' : d < 0 ? '#c0392b' : d > 0 ? '#159447' : 'inherit' }}>{d == null ? '' : `${d > 0 ? '+' : ''}${d}`}</b>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card" style={{ marginTop: 10 }}>
              <div className="empty">مفيش أصناف.</div>
            </div>
          )}
        </div>
        <div className="btnrow" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="secondary" style={btn(false)} onClick={() => printSheet(s)}>
            🖨️ اطبع ورقة الجرد
          </button>
          {open && (
            <button type="button" className="primary" style={btn(true)} disabled={busy} onClick={() => void approve(s)}>
              ✔ اعتماد الجرد
            </button>
          )}
        </div>
        {scanning && (
          <CameraScanner
            multi
            title="امسح للجرد — كل مسحة = قطعة"
            onClose={() => setScanning(false)}
            onCode={(c) => {
              const p = (products ?? []).find((x) => String(x.barcode || '') === c || String(x.code || '') === c);
              const it = p && live.current?.find((x) => x.id === s.id)?.items[p.id];
              if (!p || !it) return false;
              const v = String((it.cnt == null || it.cnt === '' ? 0 : num(it.cnt)) + 1);
              setCnt(s, p.id, v);
              return `${p.name} → ${v}`;
            }}
          />
        )}
      </>
    );
  }

  return (
    <Portal>
      <div id="mkCnt" style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'var(--bg,#f5f7f8)', color: 'var(--text,#18343a)', overflow: 'auto', direction: 'rtl', padding: '12px 14px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: cur ? 19 : undefined }}>{cur ? cur.name : '🗂️ جلسات الجرد'}</h2>
          {cur ? (
            <button type="button" className="secondary" style={btn(false)} onClick={() => setCurId(null)}>
              ← الجلسات
            </button>
          ) : (
            <button type="button" className="secondary" style={btn(false)} onClick={close}>
              ✕ قفل
            </button>
          )}
        </div>
        {body}
      </div>
    </Portal>
  );
}
