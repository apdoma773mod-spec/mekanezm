import type { Metadata } from 'next';
import Link from 'next/link';
import { Categories, OpenBtn } from '@/components/home';
import { Listing, type ListParams } from '@/components/listing';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings, PAGE } from '@/lib/catalog';
import { looseQuery, norm, queryProducts, sectionPath, visibleSections, waUrl, type Sort } from '@/lib/shop';
import { ProductCard } from '@/components/product-card';

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
  const { site: full, ok, fresh } = await getCatalog();
  const base = sp.top ? full.products.filter(p => p.top) : full.products;
  const all = queryProducts(base, ok, { q, sort: (sp.sort ?? '') as Sort, av: !!sp.av });
  const items = all.slice(0, Math.max(1, Number(sp.page) || 1) * PAGE).map(p => ({ p, ok: ok(p), fresh: fresh(p) }));
  // Nothing matched every word: show close results and matching sections instead of an empty page.
  const near = !all.length && q ? looseQuery(base, q) : [];
  const nearSecs = !all.length && q ? visibleSections(site).filter(s => norm(q).split(' ').some(w => w.length >= 3 && norm(s.name).includes(w.slice(0, -1)))) : [];
  const title = sp.top ? '⭐ الأكثر طلباً' : q ? `نتايج البحث عن «${q}»` : 'كل المنتجات';
  return (
    <>
      <main id="main" className="page">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>{sp.top ? 'الأكثر طلباً' : q ? 'بحث' : 'كل المنتجات'}</span></nav>
        <h1 className="page-h">{title}</h1>
        <Listing base="/search" params={{ ...sp, q }} total={all.length} items={items} empty={
          <div className="empty">
            <p>مالقيناش «{q}» بالظبط — جرّب كلمة تانية أو كود المنتج.</p>
            {nearSecs.length > 0 && <div className="chips" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>{nearSecs.map(s => <Link key={s.id} href={sectionPath(s.id)}>{s.name}</Link>)}</div>}
            {near.length > 0 && <><h2 className="sec-h">🔎 نتايج قريبة</h2><div className="grid list-grid" style={{ textAlign: 'right' }}>{near.map(p => <ProductCard key={p.id} p={p} ok={ok(p)} fresh={fresh(p)} />)}</div></>}
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
