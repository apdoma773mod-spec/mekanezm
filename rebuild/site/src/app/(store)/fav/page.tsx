import type { Metadata } from 'next';
import Link from 'next/link';
import { FavList, Recent } from '@/components/home';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = { title: 'المفضلة | ميكانيزم', robots: { index: false } };

export default async function FavPage() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>المفضلة</span></nav>
        <h1 className="page-h">♥ المفضلة</h1>
        <FavList />
      </main>
      <Recent />
      <Footer site={site} />
    </>
  );
}
