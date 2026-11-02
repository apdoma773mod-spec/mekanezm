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
        <p className="mut">اكتب المقاس والنتيجة تطلع على طول.</p>
        <nav className="chips" aria-label="الحاسبات" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <a href="#hinges">🔩 المفصلات</a><a href="#slides">🗃️ المجرى</a><a href="#drawer">📐 عرض الدرج</a><a href="#sliding">🚪 الجرار</a><a href="#corner">🌀 الكورنر</a>
        </nav>
        <Link className="calc-hero" href="/tools/lift"><span>⤴️</span><b>حاسبة الدراعات القلاب</b><small>بلوم أفنتوس، جراس، والباكم العادي — حسب مقاس الضلفة ونوع الخشب</small></Link>
        <Calculators />
        <p className="mut" style={{ marginTop: 16 }}>عايز الطقم كله؟ <Link href="/kits">الأطقم الجاهزة</Link></p>
      </main>
      <Footer site={site} />
    </>
  );
}
