import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { GUIDES } from '@/lib/guides';

export const metadata: Metadata = {
  title: 'دليل الاختيار: مفصلات ومجر ودريسنج ومطابخ | ميكانيزم',
  description: 'مقالات قصيرة تساعدك تختار المفصلة والمجرى وإكسسوارات الدريسنج والمطبخ بالمقاس الصح قبل ما تشتري.',
  alternates: { canonical: '/guide' },
};

export default async function Guides() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>دليل الاختيار</span></nav>
        <h1 className="page-h">📘 دليل الاختيار</h1>
        <p className="mut">قبل ما تشتري: اعرف تاخد إيه وبأنهي مقاس.</p>
        <div className="glist">{GUIDES.map(g => (
          <Link key={g.slug} href={`/guide/${g.slug}`}><span>{g.emoji}</span><b>{g.title}</b><small>{g.desc}</small></Link>
        ))}</div>
      </main>
      <Footer site={site} />
    </>
  );
}
