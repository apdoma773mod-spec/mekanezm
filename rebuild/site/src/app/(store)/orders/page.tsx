import type { Metadata } from 'next';
import Link from 'next/link';
import { OrdersList } from '@/components/orders';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = { title: 'طلباتي | ميكانيزم', robots: { index: false } };

export default async function OrdersPage() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>طلباتي</span></nav>
        <h1 className="page-h">📦 طلباتي</h1>
        <OrdersList />
      </main>
      <Footer site={site} />
    </>
  );
}
