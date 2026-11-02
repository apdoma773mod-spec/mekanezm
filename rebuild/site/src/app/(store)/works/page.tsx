import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings } from '@/lib/catalog';
import { images, productPath } from '@/lib/shop';
import { worksWithProducts } from '@/lib/works';
import { WorkGallery } from './work-gallery';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'من شغلنا: مطابخ ودريسنج روم ركّبنا إكسسواراتها | ميكانيزم',
  description: 'صور مطابخ ودواليب ودريسنج روم حقيقية بإكسسوارات ميكانيزم، وتحت كل شغلانة المنتجات اللي اتستخدمت فيها.',
  alternates: { canonical: '/works' },
};

export default async function Works() {
  const [site, { site: full }] = await Promise.all([getSettings(), getCatalog()]);
  const W = worksWithProducts(full);
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>من شغلنا</span></nav>
        <h1 className="page-h">🏗️ من شغلنا</h1>
        {!W.length && <p className="mut">قريباً صور من شغل زباينا.</p>}
        <div className="wks">{W.map(w => (
          <article key={w.i} className="wk">
            <WorkGallery imgs={w.imgs} title={w.title} />
            <div className="wkb">
              <h2>{w.title}</h2>
              {w.desc && <p>{w.desc}</p>}
              {w.used.length > 0 && <>
                <b className="wku">🧩 المنتجات اللي اتستخدمت:</b>
                <div className="pvsim">{w.used.map(p => (
                  <Link key={p.id} href={productPath(p.id)}>
                    <span className="im">{images(p)[0] && <Image src={images(p)[0]} alt="" fill sizes="130px" style={{ objectFit: 'contain' }} />}</span>
                    {p.name}
                  </Link>
                ))}</div>
              </>}
            </div>
          </article>
        ))}</div>
      </main>
      <Footer site={site} />
    </>
  );
}
