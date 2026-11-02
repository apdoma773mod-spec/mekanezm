import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { KITS } from '@/lib/kits';

export const metadata: Metadata = {
  title: 'أطقم جاهزة: جهّز مطبخك أو دريسنج | ميكانيزم',
  description: 'قولنا عدد الضلف والأدراج ونجهزلك طقم الإكسسوارات كامل: مفصلات ومجر ومقابض وكورنر وجرارات.',
  alternates: { canonical: '/kits' },
};

export default async function Kits() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>الأطقم</span></nav>
        <h1 className="page-h">🧰 أطقم جاهزة</h1>
        <p className="mut">مش عارف تبدأ منين؟ اختار نوع الشغل، وقولنا العدد، والطقم يطلعلك كامل.</p>
        <div className="glist">{KITS.map(k => <Link key={k.slug} href={`/kits/${k.slug}`}><span>{k.emoji}</span><b>{k.title}</b><small>{k.desc}</small></Link>)}</div>
      </main>
      <Footer site={site} />
    </>
  );
}
