import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { waUrl } from '@/lib/shop';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | ميكانيزم',
  description: 'إيه البيانات اللي موقع ميكانيزم بياخدها، بنستخدمها في إيه، وإزاي تطلب مسحها.',
  alternates: { canonical: '/privacy' },
};

export default async function Privacy() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow guide">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>الخصوصية</span></nav>
        <h1 className="page-h">🔒 سياسة الخصوصية</h1>
        <section>
          <h2>بناخد إيه؟</h2>
          <ul>
            <li>لما تبعت طلب أو تطلب سعر أو تسجّل جملة: اسمك ورقم موبايلك، والعنوان لو طلبت توصيل أو شحن.</li>
            <li>الصور اللي بتبعتها في «مش لاقي اللي بتدور عليه» أو طلبات التفصيل.</li>
            <li>رأيك وتقييمك لو كتبته.</li>
          </ul>
        </section>
        <section>
          <h2>بنستخدمها في إيه؟</h2>
          <p>بس عشان نكلمك ونجهّز طلبك ونوصّله، ونبعتلك السعر أو نبلغك لما منتج يتوفر. مش بنبيع بياناتك ولا بنديها لحد، غير شركة الشحن اللي هتوصل طلبك (الاسم والرقم والعنوان بس).</p>
        </section>
        <section>
          <h2>على موبايلك</h2>
          <p>الموقع بيحفظ على جهازك السلة والمفضلة وآخر حاجات شفتها وطلباتك واسمك ورقمك، عشان ما تكتبهمش كل مرة. الحاجات دي على جهازك انت بس، وتقدر تمسحها من إعدادات المتصفح.</p>
        </section>
        <section>
          <h2>الإحصائيات</h2>
          <p>بنستخدم Google Analytics و Facebook Pixel عشان نعرف الصفحات اللي بتتشاف أكتر ونحسّن الموقع والإعلانات. الأدوات دي ممكن تحط كوكيز على متصفحك، وتقدر تقفلها من إعدادات المتصفح.</p>
        </section>
        <section>
          <h2>عايز تمسح بياناتك؟</h2>
          <p>ابعتلنا على الواتساب برقمك وهنمسح بياناتك من عندنا.</p>
          <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أمسح بياناتي من موقع ميكانيزم')}>💬 اطلب مسح بياناتك</a>
        </section>
      </main>
      <Footer site={site} />
    </>
  );
}
