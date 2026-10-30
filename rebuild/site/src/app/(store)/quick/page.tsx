import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { QuickOrder } from '@/components/tools';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'اطلب بالكود | ميكانيزم',
  description: 'للنجارين والورش: اكتب أكواد الأصناف والكميات واطلبهم مرة واحدة من ميكانيزم.',
  alternates: { canonical: '/quick' },
};

export default async function QuickPage() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>اطلب بالكود</span></nav>
        <h1 className="page-h">⚡ اطلب بالكود</h1>
        <QuickOrder />
      </main>
      <Footer site={site} />
    </>
  );
}
