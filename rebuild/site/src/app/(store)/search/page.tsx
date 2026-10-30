import type { Metadata } from 'next';
import Link from 'next/link';
import { Categories, OpenBtn } from '@/components/home';
import { Listing, type ListParams } from '@/components/listing';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings, PAGE } from '@/lib/catalog';
import { queryProducts, waUrl, type Sort } from '@/lib/shop';

export async function generateMetadata({ searchParams }: { searchParams: Promise<ListParams> }): Promise<Metadata> {
  const q = (await searchParams).q?.trim();
  return {
    title: q ? `نتايج «${q}» | ميكانيزم` : 'كل المنتجات | ميكانيزم',
    alternates: { canonical: '/search' },
    // Search result pages shouldn't be indexed (only the plain "all products" page).
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const site = await getSettings();
  const { site: full, ok } = await getCatalog();
  const base = sp.top ? full.products.filter(p => p.top) : full.products;
  const all = queryProducts(base, ok, { q, sort: (sp.sort ?? '') as Sort, av: !!sp.av });
  const items = all.slice(0, Math.max(1, Number(sp.page) || 1) * PAGE).map(p => ({ p, ok: ok(p) }));
  const title = sp.top ? '⭐ الأكثر طلباً' : q ? `نتايج البحث عن «${q}»` : 'كل المنتجات';
  return (
    <>
      <main id="main" className="page">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>{sp.top ? 'الأكثر طلباً' : q ? 'بحث' : 'كل المنتجات'}</span></nav>
        <h1 className="page-h">{title}</h1>
        <Listing base="/search" params={{ ...sp, q }} total={all.length} items={items} empty={
          <div className="empty">
            <p>مالقيناش «{q}» — جرّب كلمة تانية أو كود المنتج.</p>
            <a className="btn-wa" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، بدوّر على: ${q}`)}>💬 اسألنا على الواتساب</a>
            <div style={{ marginTop: 12 }}><OpenBtn modal={{ kind: 'req' }} className="reqbtn">📷 ابعتلنا صورته<small>هنرد عليك ونقولك نوفّره إمتى</small></OpenBtn></div>
          </div>
        } />
      </main>
      <Categories />
      <Footer site={site} />
    </>
  );
}
