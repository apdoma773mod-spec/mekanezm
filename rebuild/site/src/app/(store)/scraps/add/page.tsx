import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { AddForm } from './add-form';

export const metadata: Metadata = {
  title: 'ضيف فضلتك: ألواح وخشب وألمونيوم | ميكانيزم',
  description: 'عندك فضلة واقفة في الورشة؟ سجّلها في سوق فضلة النجارين ببلاش وغيرك هيلاقيها بالمقاس.',
  alternates: { canonical: '/scraps/add' },
};

export default async function Add() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/scraps">سوق الفضلة</Link><span>›</span><span>ضيف فضلتك</span></nav>
        <h1 className="page-h">➕ ضيف فضلتك</h1>
        <p className="mut" style={{ marginTop: 0 }}>بدون تسجيل. بتكتب اسمك ورقمك وبس. الرقم مش بيظهر في الصفحة، بيظهر لمن حد يدوس «اطلبها». الإعلان بيفضل 30 يوم.</p>
        <AddForm />
      </main>
      <Footer site={site} />
    </>
  );
}
