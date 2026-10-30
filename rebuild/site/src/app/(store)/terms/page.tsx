import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'شروط الاستخدام والطلب | ميكانيزم',
  description: 'إزاي الطلب من موقع ميكانيزم بيتأكد، الأسعار، الحجز، التوصيل، والتفصيل بالمقاس.',
  alternates: { canonical: '/terms' },
};

export default async function Terms() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow guide">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>الشروط</span></nav>
        <h1 className="page-h">📄 شروط الاستخدام والطلب</h1>
        <section>
          <h2>الطلب</h2>
          <p>الطلب اللي بتبعته من الموقع بيتسجل عندنا كطلب مبدئي. بنكلمك على الواتساب أو التليفون نأكد معاك الأصناف والسعر والميعاد، والطلب بيتأكد بعد المكالمة دي.</p>
        </section>
        <section>
          <h2>الأسعار</h2>
          <p>الأسعار مش معروضة على الموقع. بنبعتهالك لما تطلبها، وبتتأكد وقت تأكيد الطلب، وممكن تختلف على حسب الكمية.</p>
        </section>
        <section>
          <h2>المنتجات اللي بالحجز</h2>
          <p>المنتج المكتوب عليه «بالحجز» مش موجود في المخزن دلوقتي. تقدر تطلبه عادي، وهنقولك ميعاد وصوله قبل ما نأكد.</p>
        </section>
        <section>
          <h2>التوصيل والشحن</h2>
          <p>التوصيل داخل القاهرة والجيزة والشحن لباقي المحافظات بمصاريف بنقولك عليها قبل التأكيد. التفاصيل في صفحة <Link href="/policy">التوصيل والاستبدال</Link>.</p>
        </section>
        <section>
          <h2>التفصيل بالمقاس</h2>
          <p>في الأدراج والدلف المتفصلة، بنراجع المقاسات معاك قبل التصنيع، والتصنيع بيبدأ بعد موافقتك عليها، فاتأكد منها كويس.</p>
        </section>
        <section>
          <h2>الاستبدال والاسترجاع</h2>
          <p>{site.policy.trim() || 'على حسب سياسة المحل المكتوبة في صفحة التوصيل والاستبدال.'}</p>
        </section>
        <section>
          <h2>الصور والمحتوى</h2>
          <p>الصور للتوضيح، وممكن يبقى في فرق بسيط في اللون حسب الشاشة. صور ومحتوى الموقع ملك ميكانيزم.</p>
        </section>
      </main>
      <Footer site={site} />
    </>
  );
}
