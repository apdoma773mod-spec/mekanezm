'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { serverNowIso, syncServerTime } from '@/lib/server-time';
import { useAllProducts } from '@/lib/trade-queries';
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
  /** رصيد السيستم وقت العد (بيتسجّل من السيرفر) */
  qAt: number | null;
  /** وقت العد بساعة السيرفر — الاعتماد بيحسب على رصيد الوقت ده */
  at?: string;
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
  const [S, setS] = useState<Session[] | null>(null);
  const [curId, setCurId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | 'pending' | 'done' | 'diff'>('all');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = useRef<Session[] | null>(null);

  /** تعديلات لسه ماوصلتش السيرفر (بنبعتها بعد ٠٫٦ ثانية من آخر كتابة في الخانة) */
  const pending = useRef(new Map<string, { sid: string; pid: string; cnt: string | null; at: string; timer?: ReturnType<typeof setTimeout> }>());
  const overlay = useCallback((list: Session[]) => {
    if (!pending.current.size) return list;
    return list.map((x) => {
      if (x.status !== 'open') return x;
      let items = x.items;
      pending.current.forEach((p) => {
        if (p.sid !== x.id || !items[p.pid]) return;
        items = { ...items, [p.pid]: p.cnt == null ? { ...items[p.pid]!, cnt: null, qAt: null, at: undefined } : { ...items[p.pid]!, cnt: p.cnt, at: p.at } };
      });
      return items === x.items ? x : { ...x, items };
    });
  }, []);
  const adopt = useCallback(
    (list: Session[]) => {
      const m = overlay(list);
      live.current = m;
      setS(m);
    },
    [overlay],
  );
  /** أي تعديل بيتطبّق على نسخة السيرفر الحالية (مش بنكتب فوق شغل جهاز تاني) */
  const op = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await api.post<{ value: Session[] }>('/counts/session-op', body);
      adopt(r.value);
      return r.value;
    },
    [adopt],
  );
  const flush = useCallback(async () => {
    const all = [...pending.current.entries()];
    for (const [k, p] of all) {
      clearTimeout(p.timer);
      try {
        await op({ op: 'set', sid: p.sid, pid: p.pid, cnt: p.cnt, at: p.at });
        if (pending.current.get(k) === p) pending.current.delete(k);
      } catch (e) {
        toast(errorMessage(e), 'bad');
        return false;
      }
    }
    return true;
  }, [op, toast]);

  // تحميل الجلسات + تحديث كل ١٥ ثانية (عشان عدّ الأجهزة التانية يظهر عندك)
  useEffect(() => {
    void syncServerTime();
    const load = () =>
      api
        .get<{ value: Session[] | null }>(`/work/kv/${KEY}`)
        .then((r) => adopt(Array.isArray(r.value) ? r.value : []))
        .catch(() => {
          if (!live.current) setS([]);
        });
    void load();
    const t = setInterval(() => void load(), 15000);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearInterval(t);
      document.body.style.overflow = prev;
      pending.current.forEach((p) => {
        clearTimeout(p.timer);
        void api.post('/counts/session-op', { op: 'set', sid: p.sid, pid: p.pid, cnt: p.cnt, at: p.at }).catch(() => undefined);
      });
    };
  }, [adopt]);

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
    const cnt = v === '' ? null : v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫،]/g, '.');
    const at = serverNowIso();
    // الشاشة بتتحدّث فوراً، والسيرفر بياخد آخر قيمة بعد ٠٫٦ ثانية. وقت العد بيتجدّد مع كل تعديل (العدّ الأخير هو اللي بيحسب).
    const key = `${s.id}|${pid}`;
    clearTimeout(pending.current.get(key)?.timer);
    const rec = { sid: s.id, pid, cnt, at, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    rec.timer = setTimeout(() => {
      void api
        .post<{ value: Session[] }>('/counts/session-op', { op: 'set', sid: rec.sid, pid, cnt: rec.cnt, at: rec.at })
        .then((r) => {
          if (pending.current.get(key) === rec) pending.current.delete(key);
          adopt(r.value);
        })
        .catch((e) => toast(`العدد ماتحفظش على السيرفر: ${errorMessage(e)}`, 'bad'));
    }, 600);
    pending.current.set(key, rec);
    const nx: Item = cnt == null ? { ...it, cnt: null, qAt: null, at: undefined } : { ...it, cnt, at, qAt: p ? num(p.qty) : it.qAt };
    const next = (live.current ?? []).map((x) => (x.id === s.id ? { ...x, items: { ...x.items, [pid]: nx } } : x));
    live.current = next;
    setS(next);
  };

  const approve = async (s: Session) => {
    setBusy(true);
    try {
      if (!(await flush())) return;
      // السيرفر هو اللي بيحسب: رصيد كل صنف وقت ما اتعدّ + البيع والشراء اللي حصل بعده
      const pv = await api.post<{ total: number; lines: { name: string; current: number; before: number; counted: number; diff: number; after: number }[]; negative: { name: string; after: number }[] }>('/counts/session-preview', { sid: s.id });
      const ch = pv.lines.filter((x) => x.diff !== 0);
      const moved = pv.lines.filter((x) => r2(x.current - x.before) !== 0).length;
      const msg = [
        `هتعتمد الجرد "${s.name}":`,
        `• ${pv.lines.length} صنف اتعدّ، منهم ${ch.length} فيه فرق عن السيستم وقت العد`,
        `• ${pv.total - pv.lines.length} صنف لسه ماتعدّش (مش هيتأثر)`,
        moved ? `• ${moved} صنف اتباع أو اتشترى منه بعد ما اتعدّ — الحركة دي محسوبة ومش هتتمسح` : '',
        ...ch.slice(0, 8).map((x) => `- ${x.name}: عددت ${x.counted} والسيستم كان ${x.before} (${x.diff > 0 ? '+' : ''}${x.diff}) ← الرصيد بعد الاعتماد ${x.after}`),
        ch.length > 8 ? '...' : '',
        pv.negative.length ? `⚠️ ${pv.negative.length} صنف هيطلع رصيده بالسالب — راجعهم: ${pv.negative.slice(0, 4).map((x) => x.name).join('، ')}` : '',
        'الرصيد الجديد = العدد + الحركة اللي حصلت بعد العد. مينفعش يترجع. نكمّل؟',
      ]
        .filter(Boolean)
        .join('\n');
      if (!window.confirm(msg)) return;
      const r = await api.post<{ count: { itemCount: number }; value: Session[] }>('/counts/session-approve', { sid: s.id });
      adopt(r.value);
      toast(`✔ اتعتمد الجرد (${r.count.itemCount} صنف اتحسبوا، ${ch.length} فيهم فرق)`);
      setCurId(null);
    } catch (e) {
      toast(`مقدرتش أكمّل: ${errorMessage(e)}`, 'bad');
    } finally {
      setBusy(false);
    }
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
                void op({ op: 'create', session: s }).then(() => setCurId(s.id)).catch((e) => toast(errorMessage(e), 'bad'));
                setName('');
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
                      if (window.confirm('تمسح الجلسة دي؟ (المخزون مش هيتأثر)')) void op({ op: 'delete', sid: s.id }).catch((e) => toast(errorMessage(e), 'bad'));
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
