'use client';

import { useEffect, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import { lookupProduct, useCategories, useCounts, useCreateCount, useProducts } from '@/lib/trade-queries';

/** Same draft key as the old system, so a half-done count survives a reload. */
const CD = 'mk_count_draft';
interface DraftLine {
  v: string;
  name: string;
  code: string;
  cat: string;
  qty: number;
  cost: number;
}
type Draft = Record<string, DraftLine>;

const readDraft = (): Draft => {
  try {
    const d = JSON.parse(localStorage.getItem(CD) || '{}') as Record<string, unknown>;
    // Old-format drafts (id → number) can't be valued without the product, so they are dropped.
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v && typeof v === 'object')) as Draft;
  } catch {
    return {};
  }
};
const writeDraft = (d: Draft) => {
  try {
    localStorage.setItem(CD, JSON.stringify(d));
  } catch {
    /* private mode */
  }
};
const toWestern = (s: string) => s.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
const r2 = (n: number) => Math.round(n * 100) / 100;
const has = (l: DraftLine | undefined) => !!l && l.v !== '';

function CountHistory({ onClose }: { onClose: () => void }) {
  const { open } = useModal();
  const list = useCounts();
  const L = list.data?.items ?? [];
  return (
    <Modal title="سجل الجرد" onClose={onClose} wide>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>أصناف</th>
                <th>عجز</th>
                <th>زيادة</th>
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {L.length ? (
                L.map((c) => (
                  <tr key={c.id} className="prow" onClick={() => open({ kind: 'countResult', count: c })}>
                    <td>
                      <b>{c.no}</b>
                    </td>
                    <td>{c.createdAt.slice(0, 10)}</td>
                    <td>{c.itemCount}</td>
                    <td style={{ color: 'var(--danger)' }}>{money(c.shortValue)}</td>
                    <td style={{ color: 'var(--green)' }}>{money(c.excessValue)}</td>
                    <td>{c.createdBy ?? ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لسه مفيش جرد</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function CountScreen() {
  const toast = useToast();
  const { open } = useModal();
  const [draft, setDraft] = useState<Draft>({});
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [show, setShow] = useState<'all' | 'done' | 'diff'>('all');
  const [hit, setHit] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [scan, setScan] = useState('');
  const [history, setHistory] = useState(false);
  const cats = useCategories();
  const products = useProducts({ q: q || undefined, category: cat || undefined, pageSize: 200 }, show === 'all');
  const save = useCreateCount();

  useEffect(() => setDraft(readDraft()), []);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);

  const update = (next: Draft) => {
    setDraft(next);
    writeDraft(next);
  };
  const setCount = (p: Pick<ProductDto, 'id' | 'name' | 'code' | 'category' | 'qty' | 'cost'>, v: string) =>
    update({ ...draft, [p.id]: { v: toWestern(v), name: p.name, code: p.code, cat: p.category ?? '', qty: p.qty, cost: p.cost ?? 0 } });

  type Line = { id: string; name: string; code: string; cat: string; qty: number; cost: number };
  let lines: Line[];
  if (show === 'all') {
    lines = (products.data?.items ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code, cat: p.category ?? '', qty: p.qty, cost: p.cost ?? 0 }));
  } else {
    const words = q.toLowerCase().split(' ').filter(Boolean);
    lines = Object.entries(draft)
      .filter(([, l]) => has(l) && (show === 'done' || Number(l.v) !== l.qty))
      .filter(([, l]) => (!cat || l.cat === cat) && words.every((w) => `${l.name} ${l.code}`.toLowerCase().includes(w)))
      .map(([id, l]) => ({ id, name: l.name, code: l.code, cat: l.cat, qty: l.qty, cost: l.cost }));
  }
  if (hit) {
    const i = lines.findIndex((l) => l.id === hit);
    if (i > 0) lines.unshift(lines.splice(i, 1)[0]!);
  }

  let n = 0;
  let sv = 0;
  let ev = 0;
  for (const l of Object.values(draft)) {
    if (!has(l)) continue;
    n++;
    const df = Number(l.v) - l.qty;
    if (df < 0) sv += -df * l.cost;
    else ev += df * l.cost;
  }

  const onScan = async () => {
    const code = toWestern(scan.trim());
    setScan('');
    if (!code) return;
    try {
      const p = await lookupProduct(code);
      const cur = draft[p.id];
      const v = String((Number(cur?.v) || 0) + 1);
      setCount(p, v);
      setHit(p.id);
      toast(`${p.name} = ${v}`);
    } catch {
      toast(`باركود مش متسجل: ${code}`, 'bad');
    }
  };

  const onSave = async () => {
    const items = Object.entries(draft)
      .filter(([, l]) => has(l))
      .map(([productId, l]) => ({ productId, counted: Number(l.v) }));
    if (!items.length) return toast('مفيش أصناف اتعدّت', 'bad');
    if (!window.confirm(`حفظ الجرد لـ ${items.length} صنف؟\nالمخزون هيتظبط على العدد اللي كتبته، وكل فرق هيتسجل في كارت الصنف.`)) return;
    try {
      const c = await save.mutateAsync({ items, note: note.trim() });
      update({});
      setNote('');
      open({ kind: 'countResult', count: c });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <section id="count">
      <div className="title-row">
        <div className="title">
          <h1>🧮 الجرد</h1>
          <p>عدّ الأصناف (أو امسحها بالباركود)، والسيستم يقولك العجز والزيادة ويظبط المخزون</p>
        </div>
        <div className="btnrow">
          <button type="button" className="secondary" onClick={() => setHistory(true)}>
            سجل الجرد
          </button>
        </div>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو الكود..." value={text} onChange={(e) => (setText(e.target.value), setHit(null))} />
        <select className="search" style={{ maxWidth: 180 }} value={cat} onChange={(e) => (setCat(e.target.value), setHit(null))}>
          <option value="">كل التصنيفات</option>
          {cats.data?.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="search" style={{ maxWidth: 160 }} value={show} onChange={(e) => (setShow(e.target.value as typeof show), setHit(null))}>
          <option value="all">كل الأصناف</option>
          <option value="done">اللي اتعدّ بس</option>
          <option value="diff">اللي فيه فرق</option>
        </select>
        <input
          className="search"
          placeholder="📷 جرد بالباركود — امسح هنا (كل مسحة = قطعة)"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void onScan();
            }
          }}
        />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="cnt-row" style={{ fontSize: 12, color: 'var(--muted)', background: '#fafcfc' }}>
          <div>الصنف</div>
          <div style={{ textAlign: 'center' }}>في السيستم</div>
          <div style={{ textAlign: 'center' }}>العدد الفعلي</div>
          <div style={{ textAlign: 'center' }}>الفرق</div>
        </div>
        <div>
          {show === 'all' && products.isPending ? (
            <Loading />
          ) : show === 'all' && products.isError ? (
            <ErrorBox message={errorMessage(products.error)} onRetry={() => products.refetch()} />
          ) : lines.length ? (
            lines.map((p) => {
              const l = draft[p.id];
              const df = has(l) ? r2(Number(l!.v) - p.qty) : null;
              return (
                <div key={p.id} className={`cnt-row${hit === p.id ? ' hit' : ''}`}>
                  <div style={{ minWidth: 0 }}>
                    <b>{p.name}</b>
                    <br />
                    <small style={{ color: 'var(--muted)' }}>
                      {p.code}
                      {p.cat ? ` • ${p.cat}` : ''}
                    </small>
                  </div>
                  <div style={{ textAlign: 'center' }}>{qtyText(p.qty)}</div>
                  <input
                    inputMode="decimal"
                    value={l?.v ?? ''}
                    placeholder="العدد"
                    onChange={(e) => setCount({ id: p.id, name: p.name, code: p.code, category: p.cat, qty: p.qty, cost: p.cost }, e.target.value)}
                  />
                  <div
                    style={{
                      textAlign: 'center',
                      fontWeight: 700,
                      color: df === null ? 'inherit' : df < 0 ? 'var(--danger)' : df > 0 ? 'var(--green)' : 'inherit',
                    }}
                  >
                    {df === null ? '' : df > 0 ? `+${df}` : df}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">مفيش أصناف</div>
          )}
          {show === 'all' && (products.data?.total ?? 0) > 200 && (
            <p style={{ color: 'var(--muted)', fontSize: 12, padding: 8 }}>ظاهر أول 200 — استخدم البحث أو التصنيف</p>
          )}
        </div>
        <div className="cnt-foot">
          <div className="cf">
            اتعدّ <b>{n}</b> صنف — عجز <b style={{ color: 'var(--danger)' }}>{money(sv)}</b> — زيادة{' '}
            <b style={{ color: 'var(--green)' }}>{money(ev)}</b>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="ملاحظة (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ padding: 9, border: '1px solid var(--border)', borderRadius: 10 }}
            />
            <button
              type="button"
              className="secondary danger"
              onClick={() => window.confirm('مسح كل الأعداد اللي كتبتها في الجرد ده؟') && update({})}
            >
              مسح المسودة
            </button>
            <button type="button" className="primary" disabled={save.isPending} onClick={onSave}>
              ✔ حفظ الجرد
            </button>
          </div>
        </div>
      </div>
      {history && <CountHistory onClose={() => setHistory(false)} />}
    </section>
  );
}

export default function CountPage() {
  return (
    <AdminOnly>
      <CountScreen />
    </AdminOnly>
  );
}
