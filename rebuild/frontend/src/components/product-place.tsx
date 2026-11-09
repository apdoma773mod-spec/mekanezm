'use client';

import { qtyText } from '@/lib/format';
import { useWarehouses, type ProductInfo, type ProductStore } from '@/lib/trade-queries';

/**
 * 📍 مكان المنتج — باين لأي حد (المدير والعامل): عينه/رفه في المحل وكام عليه دلوقتي، والباقي في أنهي مخزن وفي أنهي عين.
 * الرصيد الكلي بييجي من المنتج نفسه (بيتحدّث مع كل بيع وشراء)، فاللي في المخزن = الرصيد − اللي على الرف.
 */
export function placeSplit(qty: number, shelfQty: number | null) {
  const q = Math.max(qty, 0);
  if (shelfQty == null) return { shelf: null as number | null, store: null as number | null };
  const shelf = Math.min(Math.max(shelfQty, 0), q);
  return { shelf, store: Math.max(q - shelf, 0) };
}

export function PlaceCard({ inf, qty, unit }: { inf: ProductInfo; qty: number; unit: string }) {
  const wh = useWarehouses();
  const names = new Map((wh.data ?? []).map((w) => [w.id, w.name]));
  const stores = inf.stores ?? [];
  if (!inf.loc && !stores.length) return null;
  const { shelf, store } = placeSplit(qty, inf.shelfQty);
  return (
    <div className="pc-card pc-place">
      <h3>📍 مكانه</h3>
      <div className="pc-kv">
        {inf.loc && (
          <div>
            <small>في المحل</small>
            <b>{inf.loc}</b>
            {shelf != null && (
              <>
                {' '}
                · على الرف {qtyText(shelf)} {unit}
              </>
            )}
          </div>
        )}
        {stores.map((s, i) => (
          <div key={`${s.w}-${i}`}>
            <small>في المخزن</small>
            <b>{names.get(s.w) ?? '…'}</b>
            {s.s ? ` — ${s.s}` : ''}
            {i === 0 && store != null && (
              <>
                {' '}
                · {qtyText(store)} {unit}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** تعديل المكان داخل «تفاصيل وصور»: رف المحل + كمية الرف + أماكن في المخازن. */
export function PlaceEditor({ v, set, qty, unit }: { v: ProductInfo; set: (p: Partial<ProductInfo>) => void; qty: number; unit: string }) {
  const wh = useWarehouses();
  const list = wh.data ?? [];
  const stores = v.stores ?? [];
  const setStore = (i: number, p: Partial<ProductStore>) => set({ stores: stores.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const { shelf, store } = placeSplit(qty, v.shelfQty);
  return (
    <div className="field full">
      <label>📍 مكان المنتج</label>
      <div className="pc-place-ed">
        <div className="field">
          <label>مكانه في المحل (الرف / العين)</label>
          <input value={v.loc} placeholder="رف 3 – عين 2" onChange={(e) => set({ loc: e.target.value })} />
        </div>
        <div className="field">
          <label>كام {unit} على الرف دلوقتي؟ (الرصيد الكلي {qtyText(qty)})</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={v.shelfQty ?? ''}
            placeholder="فاضي = مش محدد"
            onChange={(e) => set({ shelfQty: e.target.value === '' ? null : Math.max(0, +e.target.value) })}
          />
          {v.shelfQty != null && v.shelfQty > qty && <small style={{ color: 'var(--danger)' }}>أكتر من الرصيد — هيتحسب {qtyText(qty)} بس.</small>}
          {shelf != null && store != null && (
            <small style={{ color: '#7b8a90' }}>
              الباقي في المخزن: {qtyText(store)} {unit}
            </small>
          )}
        </div>
        {stores.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={x.w} onChange={(e) => setStore(i, { w: e.target.value })} style={{ flex: 1, minWidth: 0 }}>
              <option value="">— اختار المخزن —</option>
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <input value={x.s} placeholder="عين 5 / رف ب" onChange={(e) => setStore(i, { s: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 10px' }} onClick={() => set({ stores: stores.filter((_, j) => j !== i) })} aria-label="شيل">
              ✕
            </button>
          </div>
        ))}
        {!list.length ? (
          <small style={{ color: '#7b8a90' }}>لسه مفيش مخازن متسجلة — اعمل مخزن من أيقونة «المخازن» في القايمة، وبعدين اختاره هنا.</small>
        ) : (
          stores.length < 10 && (
            <button type="button" className="secondary" onClick={() => set({ stores: [...stores, { w: list[0]!.id, s: '' }] })}>
              ➕ مكان في مخزن
            </button>
          )
        )}
      </div>
    </div>
  );
}
