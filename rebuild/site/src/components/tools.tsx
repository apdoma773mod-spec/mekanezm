'use client';
// «اطلب بالكود» (type codes + quantities) and «السلة كلينك» (open a prepared order).
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Item } from '@/lib/schema';
import { norm, productPath } from '@/lib/shop';
import { useShop } from './shop-provider';

const AR = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** Each line: «كود كمية» (also «كود × كمية», «كود*3», or just «كود» = 1). */
export function parseLines(text: string) {
  return AR(text).split(/\n|،|,|;/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = /^(\S+?)\s*(?:[x×*]\s*|\s+)(\d{1,4})$/i.exec(l);
    return m ? { code: m[1], q: Math.max(1, +m[2]) } : { code: l.split(/\s+/)[0], q: 1 };
  });
}

export function QuickOrder() {
  const { add, open } = useShop();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ found: { item: Item; q: number }[]; missing: string[] } | null>(null);

  async function check() {
    const lines = parseLines(text);
    if (!lines.length) return;
    setBusy(true);
    try {
      const r = await fetch('/api/items?codes=' + encodeURIComponent(lines.map(l => l.code).join(',')));
      const items = (await r.json()) as Item[];
      const by = new Map(items.map(i => [norm(i.code), i]));
      setRes({
        found: lines.filter(l => by.has(norm(l.code))).map(l => ({ item: by.get(norm(l.code))!, q: l.q })),
        missing: lines.filter(l => !by.has(norm(l.code))).map(l => l.code),
      });
    } catch { setRes({ found: [], missing: ['مفيش اتصال — جرّب تاني'] }); }
    setBusy(false);
  }

  return (
    <>
      <p className="mut">اكتب كل صنف في سطر: الكود وبعده الكمية. مثال:<br /><code dir="ltr">P0339 2</code><br /><code dir="ltr">1248 × 4</code></p>
      <textarea className="qo" value={text} onChange={e => { setText(e.target.value); setRes(null); }} rows={7} dir="auto" placeholder={'P0339 2\n1248 4'} aria-label="الأكواد والكميات" />
      <button className="pri" style={{ width: '100%', marginTop: 10 }} onClick={check} disabled={busy || !text.trim()}>🔍 راجع الأكواد</button>
      {res && (
        <div style={{ marginTop: 14 }}>
          {res.found.map(({ item, q }) => (
            <div className="citem" key={item.id}>
              {item.img && <span className="cimg"><Image src={item.img} alt="" fill sizes="48px" style={{ objectFit: 'contain' }} /></span>}
              <span style={{ flex: 1 }}><Link href={productPath(item.id)}>{item.name}</Link><small>كود {item.code}{item.ok ? '' : ' — 📦 بالحجز'}</small></span>
              <b>× {q}</b>
            </div>
          ))}
          {res.missing.length > 0 && <p className="warn">⚠️ مالقيناش: {res.missing.join('، ')}</p>}
          {res.found.length > 0 && (
            <button className="pri" style={{ width: '100%', marginTop: 10 }} onClick={() => { res.found.forEach(({ item, q }) => add(item, q)); setText(''); setRes(null); open({ kind: 'cart' }); }}>
              ➕ ضيف {res.found.length} صنف لطلبي
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function SharedCart({ lines }: { lines: { item: Item; q: number }[] }) {
  const { add, open } = useShop();
  const [done, setDone] = useState(false);
  if (!lines.length) return <div className="empty"><p>اللينك ده مفيهوش منتجات.</p><Link className="btn-wa" href="/">تصفح المنتجات</Link></div>;
  return (
    <>
      {lines.map(({ item, q }) => (
        <div className="citem" key={item.id}>
          {item.img && <span className="cimg"><Image src={item.img} alt="" fill sizes="48px" style={{ objectFit: 'contain' }} /></span>}
          <span style={{ flex: 1 }}><Link href={productPath(item.id)}>{item.name}</Link>{item.code && <small>كود {item.code}{item.ok ? '' : ' — 📦 بالحجز'}</small>}</span>
          <b>× {q}</b>
        </div>
      ))}
      <button className="pri" style={{ width: '100%', marginTop: 12 }} disabled={done}
        onClick={() => { lines.forEach(({ item, q }) => add(item, q)); setDone(true); open({ kind: 'cart' }); }}>
        {done ? '✔ اتضافوا لطلبك' : '➕ ضيفهم كلهم لطلبي'}
      </button>
    </>
  );
}
