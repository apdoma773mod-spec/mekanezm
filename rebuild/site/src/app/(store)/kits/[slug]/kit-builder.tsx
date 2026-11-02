'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useShop } from '@/components/shop-provider';
import { KITS } from '@/lib/kits';
import type { Item } from '@/lib/schema';
import { productPath } from '@/lib/shop';
import { ev } from '@/lib/track';

export function KitBuilder({ slug, picks }: { slug: string; picks: Record<string, Item | null> }) {
  const kit = KITS.find(k => k.slug === slug)!;
  const { add, open, say } = useShop();
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(kit.inputs.map(i => [i.k, i.def])));
  const set = (k: string, n: number) => { const i = kit.inputs.find(x => x.k === k)!; setV(o => ({ ...o, [k]: Math.max(i.min ?? 0, Math.min(i.max ?? 999, Math.round(n) || 0)) })); };
  const rows = useMemo(() => kit.slots.map(s => ({ s, q: s.qty(v), it: picks[s.k] })).filter(r => r.q > 0), [kit, v, picks]);
  const have = rows.filter(r => r.it), miss = rows.filter(r => !r.it);
  const missText = miss.map(r => `• ${r.s.label} × ${r.q}`).join('\n');

  const addAll = () => {
    have.forEach(r => add(r.it!, r.q));
    ev('add_to_cart', 'AddToCart', { kit: slug });
    say(`✔ اتضاف ${have.length} صنف للطلب${miss.length ? ` — و${miss.length} هنسعّرهم لك` : ''}`);
  };
  const ask = () => open({ kind: 'price', lines: have.map(r => ({ item: r.it!, q: r.q })), extra: `${kit.emoji} ${kit.title}: ${kit.inputs.map(i => `${i.label.replace('؟', '')} ${i.kind === 'yes' ? (v[i.k] ? 'آه' : 'لأ') : v[i.k]}`).join('، ')}${missText ? '\nكمان محتاج:\n' + missText : ''}` });

  return (
    <>
      <div className="info-cards form">
        <div>
          <h2>📏 قولنا عن شغلك</h2>
          <div className="kin">{kit.inputs.map(i => i.kind === 'num' ? (
            <label key={i.k}>{i.label}{i.unit && <small> ({i.unit})</small>}
              <span className="kstep">
                <button type="button" onClick={() => set(i.k, v[i.k] - (i.unit ? 10 : 1))} aria-label="نقص">−</button>
                <input type="number" inputMode="numeric" value={v[i.k]} onChange={e => set(i.k, Number(e.target.value))} />
                <button type="button" onClick={() => set(i.k, v[i.k] + (i.unit ? 10 : 1))} aria-label="زيادة">+</button>
              </span>
            </label>
          ) : (
            <label key={i.k} className="kyes"><input type="checkbox" checked={!!v[i.k]} onChange={e => set(i.k, e.target.checked ? 1 : 0)} />{i.label}</label>
          ))}</div>
        </div>
      </div>
      <h2 className="sec-h">🧾 طقمك</h2>
      <div className="krows">{rows.map(({ s, q, it }) => (
        <div key={s.k} className={'krow' + (it ? '' : ' miss')}>
          <span className="kim">{it?.img ? <Image src={it.img} alt="" fill sizes="64px" style={{ objectFit: 'contain' }} /> : '🧩'}</span>
          <span className="kt">
            <b>{s.label}</b>
            {it ? <Link href={productPath(it.id)}>{it.name}{it.code && <small> — كود {it.code}</small>}</Link> : <small>هنختارلك المناسب ونسعّره</small>}
            <small className="mut">{s.why(v)}</small>
          </span>
          <span className="kq">× {q}</span>
        </div>
      ))}</div>
      {!rows.length && <p className="mut">اختار اللي محتاجه فوق.</p>}
      {rows.length > 0 && (
        <div className="kact">
          {have.length > 0 && <button className="pri" onClick={addAll}>🛒 ضيف الطقم للطلب</button>}
          <button className="sec" onClick={ask}>💬 ابعتلي سعر الطقم كله</button>
        </div>
      )}
      <p className="mut" style={{ fontSize: 13 }}>الكميات حسابات تقريبية — بنراجعها معاك قبل التأكيد.</p>
    </>
  );
}
