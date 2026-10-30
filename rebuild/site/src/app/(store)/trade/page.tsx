import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { TradeForm } from './trade-form';

export const metadata: Metadata = {
  title: 'أسعار خاصة للنجارين والتجار والورش | ميكانيزم',
  description: 'سجّل ورشتك أو محلك في ميكانيزم واحصل على أسعار جملة ومتابعة خاصة لطلباتك: مفصلات، مجر، جرارات، إكسسوارات مطابخ ودريسنج.',
  alternates: { canonical: '/trade' },
};

export default async function Trade() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>الجملة</span></nav>
        <h1 className="page-h">🧰 أسعار خاصة للنجارين والتجار</h1>
        <div className="info-cards">
          <div>
            <h2>ليه تسجّل معانا؟</h2>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>أسعار جملة على حسب الكميات.</li>
              <li>رقم واتساب مباشر للطلبات بالكود.</li>
              <li>بنحجزلك البضاعة الناقصة ونبلغك أول ما توصل.</li>
              <li>توصيل للورشة في القاهرة والجيزة، وشحن لكل المحافظات.</li>
            </ul>
          </div>
        </div>
        <TradeForm />
        <p className="mut" style={{ marginTop: 12 }}>عندك الأكواد؟ <Link href="/quick">اطلب بالكود على طول</Link>.</p>
      </main>
      <Footer site={site} />
    </>
  );
}
