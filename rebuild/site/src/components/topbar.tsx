'use client';
// Fixed top bar on every store page: name, search with live suggestions (from the server), cart.
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { productPath, sectionPath, visibleSections } from '@/lib/shop';
import { ev } from '@/lib/track';
import { useMounted, useShop } from './shop-provider';

type Sug = { id: string; name: string; img: string };
const RK = 'mk_searches';
const recentSearches = (): string[] => { try { return JSON.parse(localStorage.getItem(RK) || '[]'); } catch { return []; } };

export function TopBar() {
  const { site, cartCount: n, open } = useShop();
  const cartCount = useMounted() ? n : 0;
  const router = useRouter();
  const qs = useSearchParams();
  const [q, setQ] = useState(qs.get('q') ?? '');
  const [sug, setSug] = useState<Sug[]>([]);
  const [show, setShow] = useState(false);
  const seq = useRef(0);
  const [past, setPast] = useState<string[]>([]);
  const submit = (v: string) => {
    v = v.trim();
    setShow(false);
    if (v) { try { localStorage.setItem(RK, JSON.stringify([v, ...recentSearches().filter(x => x !== v)].slice(0, 6))); } catch { /* */ } ev('search', 'Search', { search_term: v }, { search_string: v }); }
    router.push('/search' + (v ? '?q=' + encodeURIComponent(v) : ''));
  };

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
      <form className="tb-s" role="search" onSubmit={e => { e.preventDefault(); submit(q); }}>
        <input type="search" value={q} placeholder="ابحث عن منتج أو كود…" aria-label="ابحث عن منتج" autoComplete="off" enterKeyHint="search"
          onChange={e => { setQ(e.target.value); setShow(true); }} onFocus={() => { setPast(recentSearches()); setShow(true); }} onBlur={() => setTimeout(() => setShow(false), 200)} />
        <button type="submit" aria-label="بحث">🔍</button>
        {show && q.trim().length < 2 && (
          <div className="sug sug0">
            {past.length > 0 && <><small>بحثت قبل كده</small><div className="chips2">{past.map(x => <button type="button" key={x} onMouseDown={e => e.preventDefault()} onClick={() => { setQ(x); submit(x); }}>🕘 {x}</button>)}</div></>}
            <small>الأقسام</small>
            <div className="chips2">{visibleSections(site).map(s => <Link key={s.id} href={sectionPath(s.id)} onClick={() => setShow(false)}>{s.name}</Link>)}</div>
            <Link className="all" href="/quick" onClick={() => setShow(false)}>⚡ معاك أكواد؟ اطلب بالكود ←</Link>
          </div>
        )}
        {show && sug.length > 0 && q.trim().length >= 2 && (
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
