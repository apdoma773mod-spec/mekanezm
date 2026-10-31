import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { LiftCalc } from './lift-calc';

export const metadata: Metadata = {
  title: 'حاسبة الدراعات القلاب: بلوم أفنتوس وجراس والباكم | ميكانيزم',
  description: 'اكتب مقاس الدولاب والضلفة ونوع الخشب، والحاسبة تحسب وزن الضلفة ومعامل القوة وتقولك الدراع المناسب: بلوم أفنتوس HK-XS وHK-S وHK top وHL وHS وHF، وجراس كينفارو، والباكم العادي.',
  alternates: { canonical: '/tools/lift' },
};

export default async function LiftPage() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/tools">الحاسبات</Link><span>›</span><span>الدراعات القلاب</span></nav>
        <h1 className="page-h">⤴️ حاسبة الدراعات القلاب</h1>
        <p className="mut">قولنا الضلفة بتفتح إزاي ومقاسها ونوع الخشب، ونقولك الدراع المناسب بالظبط زي ما مهندس بلوم بيحسبه.</p>
        <LiftCalc />
      </main>
      <Footer site={site} />
    </>
  );
}
