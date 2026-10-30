import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { activeBrands, comingBrands } from '@/lib/brands';
import { getCatalog, getSettings } from '@/lib/catalog';
import { waUrl } from '@/lib/shop';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'البراندات | ميكانيزم',
  description: 'تسوق إكسسوارات المطابخ والدريسنج روم حسب البراند من ميكانيزم.',
  alternates: { canonical: '/brands' },
};

export default async function Brands() {
  const [site, { site: full }] = await Promise.all([getSettings(), getCatalog()]);
  const L = activeBrands(full.products), soon = comingBrands(full.products);
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>البراندات</span></nav>
        <h1 className="page-h">🏷️ البراندات</h1>
        {L.length > 0 && <div className="glist">{L.map(b => <Link key={b.slug} href={`/brand/${b.slug}`}><span>🏷️</span><b>{b.name}</b><small>{b.n} منتج</small></Link>)}</div>}
        {soon.length > 0 && <>
          <h2 className="sec-h">كمان عندنا</h2>
          <div className="glist">{soon.map(b => (
            <a key={b.slug} target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، عايز أسأل عن منتجات ${b.name}`)}><span>🏷️</span><b>{b.name}</b><small>منتجاتها بتنزل على الموقع قريب — اسأل عليها على الواتساب</small></a>
          ))}</div>
        </>}
      </main>
      <Footer site={site} />
    </>
  );
}
