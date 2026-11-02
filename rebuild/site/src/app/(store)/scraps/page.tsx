import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { ScrapSearch } from './scrap-search';

export const metadata: Metadata = {
  title: 'سوق فضلة النجارين: دوّر على حتة لوح أو خشب أو ألمونيوم | ميكانيزم',
  description: 'محتاج وش درج 70×25 وعايز تتفادى لوح كامل؟ دوّر على فضلة عند نجارين تانيين، أو ضيف الفضلة اللي عندك. ببلاش وبدون تسجيل.',
  alternates: { canonical: '/scraps' },
};

export default async function Scraps() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>سوق الفضلة</span></nav>
        <h1 className="page-h">♻️ سوق فضلة النجارين</h1>
        <p className="mut" style={{ marginTop: 0 }}>محتاج حتة صغيرة؟ متشتريش لوح كامل. دوّر على فضلة عند نجار تاني، أو بيع اللي واقف عندك. <b>ببلاش وبدون تسجيل.</b></p>
        <div className="sc-top">
          <Link className="pri" href="/scraps/add">➕ ضيف فضلتك</Link>
          <Link className="sec" href="/scraps/mine">📋 فضلتي</Link>
        </div>
        <ScrapSearch />
        <p className="pro-note" style={{ marginTop: 14 }}>ℹ️ الإعلانات من نجارين وورش، وميكانيزم بتسهّل التواصل بس. اتأكد من الحتة قبل ما تدفع أو تسافر، والاتفاق بينك وبين صاحبها.</p>
      </main>
      <Footer site={site} />
    </>
  );
}
