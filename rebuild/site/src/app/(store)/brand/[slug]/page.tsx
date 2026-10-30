import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { Footer } from '@/components/site-parts';
import { activeBrands, brandBySlug, productsOfBrand } from '@/lib/brands';
import { getCatalog, getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { productPath } from '@/lib/shop';

export const revalidate = 60;

export async function generateStaticParams() {
  const { site } = await getCatalog();
  return activeBrands(site.products).map(b => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = brandBySlug((await params).slug);
  if (!b) return {};
  const d = `منتجات ${b.name} الأصلية من ميكانيزم: إكسسوارات مطابخ ودريسنج روم. اطلب أونلاين أو على الواتساب، توصيل وشحن لكل المحافظات.`;
  return { title: `${b.name} | ميكانيزم`, description: d, alternates: { canonical: `/brand/${b.slug}` } };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const b = brandBySlug((await params).slug);
  if (!b) notFound();
  const [site, { site: full, ok, fresh }] = await Promise.all([getSettings(), getCatalog()]);
  const L = productsOfBrand(full.products, b);
  if (!L.length) notFound();
  const others = activeBrands(full.products).filter(x => x.slug !== b.slug);
  const ld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: b.name, url: `${SITE_URL}/brand/${b.slug}`,
    mainEntity: { '@type': 'ItemList', numberOfItems: L.length, itemListElement: L.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + productPath(p.id), name: p.name })) },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main id="main" className="page">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/brands">البراندات</Link><span>›</span><span>{b.name}</span></nav>
        <h1 className="page-h">🏷️ {b.name}</h1>
        <p className="count mut">{L.length} منتج</p>
        <div className="grid list-grid">{L.map((p, i) => <ProductCard key={p.id} p={p} ok={ok(p)} fresh={fresh(p)} priority={i < 2} />)}</div>
        {others.length > 0 && <>
          <h2 className="sec-h">براندات تانية</h2>
          <div className="chips" style={{ flexWrap: 'wrap' }}>{others.map(x => <Link key={x.slug} href={`/brand/${x.slug}`}>{x.name} ({x.n})</Link>)}</div>
        </>}
      </main>
      <Footer site={site} />
    </>
  );
}
