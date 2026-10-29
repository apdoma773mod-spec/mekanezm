'use client';

import { useMemo, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useAllProducts, useContacts, useMarketPrices, useSaveMarketPrices, type MarketData, type MarketOffer } from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

/** 💹 أسعار السوق ومقارنة الشراء — نفس منطق القديم (mkPW). البيانات في Setting market_prices. */
const norm = (s: unknown) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
const nd = (v: unknown) => String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const num = (v: unknown) => {
  const n = parseFloat(nd(v).replace(/[,٬\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const today = () => new Date().toISOString().slice(0, 10);

interface Offer extends MarketOffer {
  src: 'manual' | 'buy';
}

export function useMarket(enabled = true) {
  const data = useMarketPrices(enabled);
  const products = useAllProducts({}, enabled).data;
  const m = data.data;
  const api = useMemo(() => {
    const offers = (p: ProductDto): Offer[] => {
      const key = p.code || p.id;
      const L: Offer[] = ((m?.prices ?? {})[key] ?? []).map((o) => ({ ...o, src: 'manual' as const }));
      (m?.buys ?? []).forEach((b) => {
        if (b.pid !== p.id || !b.p) return;
        L.push({ s: b.s || 'مورد غير معروف', p: b.p, at: b.at, src: 'buy' });
      });
      return L.filter((o) => o.p > 0).sort((a, b) => a.p - b.p);
    };
    const lastBuy = (p: ProductDto) => (m?.last ?? []).find((x) => x.pid === p.id) ?? null;
    const gaps = (products ?? [])
      .map((p) => {
        const lb = lastBuy(p);
        if (!lb || !lb.p) return null;
        const O = offers(p).filter((o) => o.s !== lb.s);
        if (!O.length) return null;
        const b = O[0]!;
        return b.p < lb.p * 0.98 ? { p, lb, b, save: lb.p - b.p } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.save - a.save);
    return { offers, lastBuy, gaps };
  }, [m, products]);
  return { data, products, ...api };
}

type View = { k: 'list' } | { k: 'item'; id: string } | { k: 'paste' } | { k: 'parsed'; supplier: string; rows: { nm: string; pr: number; pid: string }[] };

export function MarketModal() {
  const { close } = useModal();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const mk = useMarket(isAdmin);
  const save = useSaveMarketPrices();
  const suppliers = useContacts({ type: 'SUPPLIER', pageSize: 200 }, isAdmin).data?.items ?? [];
  const [view, setView] = useState<View>({ k: 'list' });
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState('');
  const [pasteS, setPasteS] = useState('');
  const [pasteT, setPasteT] = useState('');

  if (!isAdmin) return null;
  const M = mk.data.data;
  if (!M || !mk.products)
    return (
      <Modal title="💹 أسعار السوق ومقارنة الشراء" onClose={close}>
        <Loading />
      </Modal>
    );
  const prices = M.prices;
  const persist = async (next: Record<string, MarketOffer[]>) => {
    try {
      await save.mutateAsync(next);
      return true;
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
      return false;
    }
  };
  const P = mk.products;

  if (view.k === 'item') {
    const p = P.find((x) => x.id === view.id);
    if (!p) return null;
    const O = mk.offers(p);
    const key = p.code || p.id;
    const add = async () => {
      const s = supplier.trim();
      const pr = num(price);
      if (!s || !pr) return toast('اكتب المورد والسعر', 'bad');
      const next = { ...prices, [key]: [...(prices[key] ?? []).filter((o) => o.s !== s), { s, p: pr, at: today() }] };
      if (await persist(next)) {
        toast('✔ اتسجل');
        setSupplier('');
        setPrice('');
      }
    };
    const del = async (s: string) => {
      await persist({ ...prices, [key]: (prices[key] ?? []).filter((o) => o.s !== s) });
    };
    return (
      <Modal title={`💹 ${p.name}`} onClose={close}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المورد/المكان</th>
                <th>السعر</th>
                <th>التاريخ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {O.map((o, i) => (
                <tr key={`${o.s}-${o.src}`}>
                  <td>
                    {o.s}
                    {o.src === 'buy' && <small> (فاتورة شراء)</small>}
                  </td>
                  <td>
                    <b>{money(o.p)}</b>
                    {i === 0 ? ' 🏆' : ''}
                  </td>
                  <td>{String(o.at || '').slice(0, 10)}</td>
                  <td>
                    {o.src === 'manual' && (
                      <button type="button" className="secondary danger" onClick={() => void del(o.s)}>
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!O.length && (
                <tr>
                  <td colSpan={4}>مفيش أسعار لسه</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="form" style={{ marginTop: 8 }}>
          <div className="field">
            <label>المورد / المحل</label>
            <input list="pwSL" placeholder="مثلاً: المورد فلان / محل في العتبة" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <datalist id="pwSL">
              {suppliers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>السعر</label>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <button type="button" className="primary" onClick={() => void add()}>
            حفظ السعر
          </button>{' '}
          <button type="button" className="secondary" onClick={() => setView({ k: 'list' })}>
            ↩ رجوع
          </button>
        </div>
      </Modal>
    );
  }

  if (view.k === 'paste')
    return (
      <Modal title="📋 قايمة أسعار مورد" onClose={() => setView({ k: 'list' })}>
        <p style={{ marginTop: 0, color: '#7b8a90' }}>الصق القايمة اللي بعتهالك المورد (واتساب/إكسل) — كل سطر فيه اسم الصنف أو كوده والسعر. السيستم بيطابق الأصناف لوحده.</p>
        <div className="form">
          <div className="field">
            <label>اسم المورد</label>
            <input value={pasteS} onChange={(e) => setPasteS(e.target.value)} />
          </div>
          <div className="field">
            <label>القايمة</label>
            <textarea rows={8} placeholder={'مفصلة هيدروليك 35 مم — 18\nP0123 250'} value={pasteT} onChange={(e) => setPasteT(e.target.value)} />
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const s = pasteS.trim();
              if (!s) return toast('اكتب اسم المورد', 'bad');
              const rows: { nm: string; pr: number; pid: string }[] = [];
              pasteT.split('\n').forEach((line) => {
                const t = nd(line).trim();
                if (!t) return;
                const m = t.match(/([\d.,]+)\s*(ج\.?م|جنيه|ج)?\s*$/);
                if (!m) return;
                const pr = num(m[1]);
                const nm = t.slice(0, m.index).replace(/[-–—:=|]+\s*$/, '').trim();
                if (!pr || !nm) return;
                const code = nm.split(/\s+/)[0]!;
                let p = P.find((x) => x.code && norm(x.code) === norm(code)) ?? P.find((x) => norm(x.name) === norm(nm));
                if (!p) {
                  const w = norm(nm).split(' ').filter((x) => x.length > 1);
                  let best = 0;
                  P.forEach((x) => {
                    const n = norm(x.name);
                    const sc = w.filter((y) => n.includes(y)).length / Math.max(w.length, 1);
                    if (sc > best && sc >= 0.6) {
                      best = sc;
                      p = x;
                    }
                  });
                }
                rows.push({ nm, pr, pid: p?.id ?? '' });
              });
              setView({ k: 'parsed', supplier: s, rows });
            }}
          >
            طابق
          </button>
        </div>
      </Modal>
    );

  if (view.k === 'parsed') {
    const { supplier: s, rows } = view;
    const setRow = (i: number, pid: string) => setView({ ...view, rows: rows.map((r, j) => (j === i ? { ...r, pid } : r)) });
    return (
      <Modal title={`📋 المطابقة — ${s}`} onClose={() => setView({ k: 'paste' })}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>في القايمة</th>
                <th>السعر</th>
                <th>الصنف عندك</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.nm}</td>
                  <td>{money(r.pr)}</td>
                  <td>
                    <select value={r.pid} onChange={(e) => setRow(i, e.target.value)}>
                      <option value="">— تجاهل —</option>
                      {P.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3}>ماقدرتش ألاقي أسعار — كل سطر لازم ينتهي بالسعر</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="primary"
          style={{ marginTop: 8 }}
          onClick={async () => {
            const next: Record<string, MarketOffer[]> = { ...prices };
            let n = 0;
            rows.forEach((r) => {
              const p = P.find((x) => x.id === r.pid);
              if (!p) return;
              const k = p.code || p.id;
              next[k] = [...(next[k] ?? []).filter((o) => o.s !== s), { s, p: r.pr, at: today() }];
              n++;
            });
            if (await persist(next)) {
              toast(`✔ اتحفظ ${n} سعر`);
              setView({ k: 'list' });
            }
          }}
        >
          💾 حفظ {rows.length} سعر
        </button>
      </Modal>
    );
  }

  const G = mk.gaps;
  const w = norm(q);
  let L = P.filter((p) => !w || norm(p.name).includes(w) || norm(p.code).includes(w));
  if (only) {
    const ids = new Set(G.map((g) => g.p.id));
    L = L.filter((p) => ids.has(p.id));
  }
  L = L.slice(0, 80);
  return (
    <Modal title="💹 أسعار السوق ومقارنة الشراء" onClose={close}>
      <div style={{ padding: 2 }}>
        {G.length ? (
          <div style={{ background: '#fdecec', border: '1px solid #f3c0c0', borderRadius: 12, padding: 10, marginBottom: 10 }}>
            <b>⚠️ {G.length} صنف بتشتريهم أغلى من مورد تاني</b> — ممكن توفّر <b>{money(G.reduce((a, g) => a + g.save, 0))}</b> في القطعة الواحدة من كل صنف
            <div style={{ marginTop: 6 }}>
              {G.slice(0, 6).map((g) => (
                <div key={g.p.id} style={{ fontSize: 13, margin: '3px 0' }}>
                  • <b>{g.p.name}</b>: آخر شراء من {g.lb.s || '—'} بـ {money(g.lb.p)} — عند <b style={{ color: '#0b6b45' }}>{g.b.s}</b> بـ {money(g.b.p)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#e3f4ec', borderRadius: 12, padding: 10, marginBottom: 10, color: '#0b6b45', fontWeight: 700 }}>✅ مفيش صنف بتشتريه أغلى من السوق (حسب الأسعار المتسجلة)</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <input placeholder="🔎 دوّر على صنف" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button type="button" className={only ? 'primary' : 'secondary'} onClick={() => setOnly(!only)}>
            الأغلى بس
          </button>
          <button type="button" className="secondary" onClick={() => setView({ k: 'paste' })}>
            📋 لصق قايمة أسعار مورد
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>آخر شراء</th>
                <th>أرخص سعر في السوق</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {L.map((p) => {
                const O = mk.offers(p);
                const lb = mk.lastBuy(p);
                const b = O[0];
                const bad = !!(lb && b && b.s !== lb.s && b.p < lb.p * 0.98);
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      <br />
                      <small style={{ color: '#7b8a90' }}>
                        {p.code}
                        {O.length ? ` · ${O.length} سعر` : ''}
                      </small>
                    </td>
                    <td>
                      {lb ? (
                        <>
                          {money(lb.p)}
                          <br />
                          <small>{lb.s}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {b ? (
                        <>
                          <b style={{ color: bad ? '#0b6b45' : 'inherit' }}>{money(b.p)}</b>
                          <br />
                          <small>
                            {b.s}
                            {b.src === 'manual' ? ' (سعر سوق)' : ''}
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                      {bad && lb && b && (
                        <>
                          <br />
                          <span style={{ color: '#b33', fontSize: 12, fontWeight: 800 }}>أرخص بـ {money(lb.p - b.p)}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <button type="button" className="secondary" onClick={() => setView({ k: 'item', id: p.id })}>
                        ➕ سعر
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/** The orange banner under the dashboard title: «N صنف بتشتريهم أغلى من مورد تاني». */
export function MarketBanner() {
  const isAdmin = useIsAdmin();
  const { open } = useModal();
  const mk = useMarket(isAdmin);
  if (!isAdmin || !mk.gaps.length) return null;
  return (
    <div
      onClick={() => open({ kind: 'market' })}
      style={{ cursor: 'pointer', background: '#fff4e0', border: '1px solid #f0d68a', borderRadius: 12, padding: '8px 12px', margin: '6px 0', fontWeight: 700 }}
    >
      💹 {mk.gaps.length} صنف بتشتريهم أغلى من مورد تاني — دوس تشوف مين الأرخص
    </div>
  );
}

export type { MarketData };
