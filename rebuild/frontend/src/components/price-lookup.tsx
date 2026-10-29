'use client';

import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { useAllProducts, useMarketPrices } from '@/lib/trade-queries';

/** 🔎 استعلام عن سعر صنف (priceLookup القديمة): سعر الشراء والبيع والمكسب والمتاح وآخر شراء، للمدير. */
export function PriceLookupCard() {
  const [q, setQ] = useState('');
  const products = useAllProducts({}).data;
  const market = useMarketPrices().data;
  const L = useMemo(() => {
    const w = vn(q).split(' ').filter(Boolean);
    if (!w.length) return [];
    return (products ?? []).filter((p) => w.every((x) => vn(`${p.name} ${p.code || ''}`).includes(x))).slice(0, 8);
  }, [q, products]);
  return (
    <div id="plCard" className="card own" style={{ marginTop: 14 }}>
      <h3 style={{ margin: '0 0 10px' }}>🔎 استعلام عن سعر صنف</h3>
      <input id="plQ" className="search" style={{ width: '100%' }} placeholder="اكتب اسم الصنف أو الكود..." autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      <div id="plOut">
        {q.trim() && !L.length ? (
          <div className="empty" style={{ padding: 14 }}>
            مفيش صنف بالاسم ده
          </div>
        ) : (
          L.map((p) => {
            const lb = market?.last.find((x) => x.pid === p.id);
            const cost = p.cost ?? 0;
            return (
              <div key={p.id} className="plr">
                <div style={{ minWidth: 160, flex: 1 }}>
                  <b>{p.name}</b>
                  {p.code ? <small style={{ color: 'var(--muted)' }}> كود {p.code}</small> : null}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{lb ? `آخر شراء: ${money(lb.p)} من ${lb.s || '—'} يوم ${lb.at}` : 'مفيش فواتير شراء للصنف ده لسه'}</div>
                </div>
                <div className="pp">
                  <div>
                    <small>سعر الشراء</small>
                    <b style={{ color: 'var(--blue)' }}>{money(cost)}</b>
                  </div>
                  <div>
                    <small>سعر البيع</small>
                    <b>{money(p.price)}</b>
                  </div>
                  <div>
                    <small>المكسب</small>
                    <b style={{ color: p.price - cost < 0 ? 'var(--danger)' : 'var(--green)' }}>{money(p.price - cost)}</b>
                  </div>
                  <div>
                    <small>المتاح</small>
                    <b>
                      {p.qty} {p.unit || ''}
                    </b>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
