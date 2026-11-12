import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { Calculators } from './calculators';

export const metadata: Metadata = {
  title: 'حاسبات النجار: عدد المفصلات وطول المجرى وعرض الدرج | ميكانيزم',
  description: 'احسب عدد المفصلات حسب طول الضلفة، وطول المجرى حسب عمق الدولاب، وعرض الدرج، ومقاسات الماجيك كورنر والدولاب الجرار.',
  alternates: { canonical: '/tools' },
};

export default async function Tools() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>الحاسبات</span></nav>
        <h1 className="page-h">🧮 حاسبات النجار</h1>
        <Link className="calc-hero" href="/takeoff"><span>📐</span><b>ارفع رسمتك… نطلعلك الإكسسوارات بالعدد</b><small>PDF أو صورة أو Excel — مفصلات ومجر وتكايات وزوايا، من غير ما تكتب حاجة</small></Link>
        <Calculators />
        <Link className="calc-hero" href="/tools/lift"><span>⤴️</span><b>حاسبة الدراعات القلاب</b><small>بلوم أفنتوس، جراس، والباكم العادي — حسب مقاس الضلفة ونوع الخشب</small></Link>
        <p className="mut" style={{ marginTop: 16 }}>عايز الطقم كله؟ <Link href="/kits">الأطقم الجاهزة</Link></p>
      </main>
      <Footer site={site} />
    </>
  );
}
