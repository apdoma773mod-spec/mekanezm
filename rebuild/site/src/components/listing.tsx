// Product grid with sort / "available only" / "show more" — plain links, so it works without JS
// and Google can follow every page. Used by category pages and the search page.
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { PAGE } from '@/lib/catalog';
import { ProductCard } from './product-card';

export type ListParams = { q?: string; sort?: string; av?: string; page?: string; top?: string };

const SORTS: [string, string][] = [['', 'الافتراضي'], ['new', 'الأحدث'], ['az', 'الاسم أ ← ي'], ['av', 'المتوفر الأول']];

export function Listing({ base, params, total, items, empty }: {
  base: string; params: ListParams; total: number; items: { p: Product; ok: boolean }[]; empty: React.ReactNode;
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
      <div className="chips" role="toolbar" aria-label="ترتيب وفلترة">
        <Link className={params.av ? '' : 'on'} href={href({ av: '', page: '' })} scroll={false}>الكل</Link>
        <Link className={params.av ? 'on' : ''} href={href({ av: '1', page: '' })} scroll={false}>✔ المتوفر فقط</Link>
        {SORTS.map(([v, t]) => (
          <Link key={v} className={(params.sort ?? '') === v ? 'on' : ''} href={href({ sort: v, page: '' })} scroll={false}>{v ? t : 'ترتيب: ' + t}</Link>
        ))}
      </div>
      <p className="count mut">{total ? `${total} منتج` : ''}</p>
      {items.length ? (
        <div className="grid list-grid">{items.map(({ p, ok }, i) => <ProductCard key={p.id} p={p} ok={ok} priority={i < 2} />)}</div>
      ) : empty}
      {items.length < total && (
        <Link className="more" href={href({ page: String(page + 1) })} scroll={false} rel="next">
          عرض المزيد ({Math.min(PAGE, total - items.length)} من {total - items.length} باقيين)
        </Link>
      )}
    </>
  );
}
