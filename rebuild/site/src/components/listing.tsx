// Product grid with sort / "available only" / keyword chips / numbered pages — plain links, so it works
// without JS and Google can follow every page. Used by category pages and the search page.
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { PAGE } from '@/lib/catalog';
import { ProductCard } from './product-card';

export type ListParams = { q?: string; sort?: string; av?: string; page?: string; top?: string; f?: string };

const SORTS: [string, string][] = [['', 'الافتراضي'], ['new', 'الأحدث'], ['az', 'الاسم أ ← ي'], ['av', 'المتوفر الأول']];

export function Listing({ base, params, total, items, empty, terms, specs }: {
  base: string; params: ListParams; total: number; items: { p: Product; ok: boolean; fresh?: boolean }[]; empty: React.ReactNode; terms?: string[];
  specs?: { k: string; vals: string[] }[];
}) {
  const href = (o: Partial<ListParams>) => {
    const sp = new URLSearchParams();
    const m = { ...params, ...o };
    (Object.keys(m) as (keyof ListParams)[]).forEach(k => { if (m[k]) sp.set(k, String(m[k])); });
    const s = sp.toString();
    return base + (s ? '?' + s : '');
  };
  const page = Math.max(1, Number(params.page) || 1);
  return (
    <>
      {terms && terms.length > 0 && (
        <div className="chips terms" role="toolbar" aria-label="فرز سريع">
          {params.q && <Link className="on" href={href({ q: '', page: '' })} scroll={false}>✕ {params.q}</Link>}
          {terms.filter(t => t !== params.q).map(t => <Link key={t} href={href({ q: t, page: '' })} scroll={false}>{t}</Link>)}
        </div>
      )}
      {specs?.map(({ k, vals }) => (
        <div key={k} className="chips spec" role="toolbar" aria-label={k}>
          <b>{k}:</b>
          {vals.map(v => { const f = k + '|' + v, on = params.f === f; return <Link key={v} className={on ? 'on' : ''} href={href({ f: on ? '' : f, page: '' })} scroll={false}>{on ? '✕ ' : ''}{v}</Link>; })}
        </div>
      ))}
      <div className="chips" role="toolbar" aria-label="ترتيب وفلترة">
        <Link className={params.av ? '' : 'on'} href={href({ av: '', page: '' })} scroll={false}>الكل</Link>
        <Link className={params.av ? 'on' : ''} href={href({ av: '1', page: '' })} scroll={false}>✔ المتوفر فقط</Link>
        {SORTS.map(([v, t]) => (
          <Link key={v} className={(params.sort ?? '') === v ? 'on' : ''} href={href({ sort: v, page: '' })} scroll={false}>{v ? t : 'ترتيب: ' + t}</Link>
        ))}
      </div>
      <p className="count mut">{total ? `${total} منتج${total > PAGE ? ` — صفحة ${page} من ${Math.ceil(total / PAGE)}` : ''}` : ''}</p>
      {items.length ? (
        <div className="grid list-grid">{items.map(({ p, ok, fresh }, i) => <ProductCard key={p.id} p={p} ok={ok} fresh={fresh} priority={i < 2} />)}</div>
      ) : empty}
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} href={n => href({ page: n > 1 ? String(n) : '' })} />
    </>
  );
}

/** 1 2 3 … pages with previous/next; shows the first, the last and two around the current page. */
export function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages < 2) return null;
  const L: (number | '…')[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) L.push(n);
    else if (L[L.length - 1] !== '…') L.push('…');
  }
  return (
    <nav className="pager" aria-label="الصفحات">
      {page > 1 ? <Link href={href(page - 1)} rel="prev" aria-label="الصفحة اللي قبل">›</Link> : <span className="off">›</span>}
      {L.map((n, i) => n === '…' ? <span key={'e' + i} className="gap">…</span>
        : <Link key={n} href={href(n)} className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined}>{n}</Link>)}
      {page < pages ? <Link href={href(page + 1)} rel="next" aria-label="الصفحة اللي بعد">‹</Link> : <span className="off">‹</span>}
    </nav>
  );
}
