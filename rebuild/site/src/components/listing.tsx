// Product grid with sort / "available only" / keyword chips / "show more" — plain links, so it works
// without JS and Google can follow every page. Used by category pages and the search page.
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { PAGE } from '@/lib/catalog';
import { AutoMore } from './auto-more';
import { ProductCard } from './product-card';

export type ListParams = { q?: string; sort?: string; av?: string; page?: string; top?: string };

const SORTS: [string, string][] = [['', 'الافتراضي'], ['new', 'الأحدث'], ['az', 'الاسم أ ← ي'], ['av', 'المتوفر الأول']];

export function Listing({ base, params, total, items, empty, terms }: {
  base: string; params: ListParams; total: number; items: { p: Product; ok: boolean; fresh?: boolean }[]; empty: React.ReactNode; terms?: string[];
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
      <div className="chips" role="toolbar" aria-label="ترتيب وفلترة">
        <Link className={params.av ? '' : 'on'} href={href({ av: '', page: '' })} scroll={false}>الكل</Link>
        <Link className={params.av ? 'on' : ''} href={href({ av: '1', page: '' })} scroll={false}>✔ المتوفر فقط</Link>
        {SORTS.map(([v, t]) => (
          <Link key={v} className={(params.sort ?? '') === v ? 'on' : ''} href={href({ sort: v, page: '' })} scroll={false}>{v ? t : 'ترتيب: ' + t}</Link>
        ))}
      </div>
      <p className="count mut">{total ? `${total} منتج` : ''}</p>
      {items.length ? (
        <div className="grid list-grid">{items.map(({ p, ok, fresh }, i) => <ProductCard key={p.id} p={p} ok={ok} fresh={fresh} priority={i < 2} />)}</div>
      ) : empty}
      {items.length < total && (
        <AutoMore href={href({ page: String(page + 1) })}>
          عرض المزيد ({Math.min(PAGE, total - items.length)} من {total - items.length} باقيين)
        </AutoMore>
      )}
    </>
  );
}
