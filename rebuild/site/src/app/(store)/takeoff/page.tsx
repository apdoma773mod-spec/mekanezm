import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings } from '@/lib/catalog';
import { toItem, waUrl } from '@/lib/shop';
import { Takeoff } from './takeoff';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'ارفع رسمتك نطلعلك الإكسسوارات بالعدد — حصر مفصلات ومجر وتكايات | ميكانيزم',
  description: 'ارفع رسمة المطبخ أو الدريسنج أو الدولاب (PDF، صورة، Excel، أوتوكاد) والموقع يحصرلك كل الإكسسوارات المطلوبة بالعدد: مفصلات، مجر أدراج، تكايات رف، زوايا تجميع، تعليقات، جرار… ومع كل رقم سببه.',
  alternates: { canonical: '/takeoff' },
};

export default async function TakeoffPage() {
  const [site, { site: full, ok }] = await Promise.all([getSettings(), getCatalog()]);
  // Only what matching needs (name + keywords), so the page stays light with a big catalog.
  const products = full.products.filter(p => !p.hidden).map(p => ({ ...toItem(p, ok(p)), tags: p.tags, top: !!p.top }));
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>حصر الإكسسوارات</span></nav>
        <h1 className="page-h">📐 ارفع رسمتك… نطلعلك الإكسسوارات بالعدد</h1>
        <Takeoff products={products} wa={waUrl(site, 'السلام عليكم، عايز حصر إكسسوارات لرسمة عندي')} />
        <p className="mut" style={{ marginTop: 18 }}>عايز تحسب حاجة بنفسك؟ <Link href="/tools">الحاسبات</Link> · <Link href="/kits">الأطقم الجاهزة</Link></p>
      </main>
      <Footer site={site} />
    </>
  );
}
