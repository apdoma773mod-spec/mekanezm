import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { Mine } from './mine';

export const metadata: Metadata = { title: 'فضلتي | ميكانيزم', robots: { index: false }, alternates: { canonical: '/scraps/mine' } };

export default async function MinePage() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/scraps">سوق الفضلة</Link><span>›</span><span>فضلتي</span></nav>
        <h1 className="page-h">📋 فضلتي</h1>
        <Mine />
      </main>
      <Footer site={site} />
    </>
  );
}
