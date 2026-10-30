'use client';
// Fixed top bar on every store page: name, search with live suggestions (from the server), cart.
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { productPath } from '@/lib/shop';
import { useShop } from './shop-provider';

type Sug = { id: string; name: string; img: string };

export function TopBar() {
  const { site, cartCount, open } = useShop();
  const router = useRouter();
  const qs = useSearchParams();
  const [q, setQ] = useState(qs.get('q') ?? '');
  const [sug, setSug] = useState<Sug[]>([]);
  const [show, setShow] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setSug([]); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/suggest?q=' + encodeURIComponent(v));
        const j = (await r.json()) as Sug[];
        if (n === seq.current) setSug(j);
      } catch { /* offline */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const hl = (t: string) => {
    const v = q.trim().toLowerCase(), i = t.toLowerCase().indexOf(v);
    return i < 0 || !v ? t : <>{t.slice(0, i)}<mark>{t.slice(i, i + v.length)}</mark>{t.slice(i + v.length)}</>;
  };

  return (
    <div className="tb">
      <Link href="/" className="tb-brand" aria-label="الرئيسية">{site.name.split(' ')[0]}</Link>
      <form className="tb-s" role="search" onSubmit={e => { e.preventDefault(); setShow(false); router.push('/search?q=' + encodeURIComponent(q.trim())); }}>
        <input type="search" value={q} placeholder="ابحث عن منتج أو كود…" aria-label="ابحث عن منتج" autoComplete="off" enterKeyHint="search"
          onChange={e => { setQ(e.target.value); setShow(true); }} onFocus={() => setShow(true)} onBlur={() => setTimeout(() => setShow(false), 200)} />
        <button type="submit" aria-label="بحث">🔍</button>
        {show && sug.length > 0 && (
          <div className="sug" role="listbox">
            {sug.map(p => (
              <Link key={p.id} role="option" aria-selected={false} href={productPath(p.id)} onClick={() => setShow(false)}>
                <span className="si">{p.img && <Image src={p.img} alt="" fill sizes="44px" style={{ objectFit: 'contain' }} />}</span><b>{hl(p.name)}</b>
              </Link>
            ))}
            <Link className="all" href={'/search?q=' + encodeURIComponent(q.trim())} onClick={() => setShow(false)}>كل النتايج لـ «{q.trim()}» ←</Link>
          </div>
        )}
      </form>
      <button className="tb-cart" onClick={() => open({ kind: 'cart' })} aria-label={`السلة (${cartCount})`}>🛒{cartCount > 0 && <i>{cartCount}</i>}</button>
    </div>
  );
}
