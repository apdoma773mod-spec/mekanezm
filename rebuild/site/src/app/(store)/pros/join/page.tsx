import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { PROS } from '@/lib/config';
import { JoinForm } from './join-form';

export const metadata: Metadata = {
  title: 'قدّم لتكون ضمن النجارين والفنيين المرشّحين | ميكانيزم',
  description: 'نجار أو فني تركيب أو مهندس ديكور؟ اعرف شروط ظهورك في قايمة ميكانيزم وقدّم بصور شغلك.',
  alternates: { canonical: '/pros/join' },
};

export default async function Join() {
  const site = await getSettings();
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/pros">فنيين نرشّحهم</Link><span>›</span><span>قدّم</span></nav>
        <h1 className="page-h">🔨 قدّم لتكون ضمن المرشّحين</h1>
        <p className="mut" style={{ marginTop: 0 }}>زباين ميكانيزم بيسألونا كتير على حد يركّب أو يصلّح أو يصمّم. بنرشّح بس اللي نثق في شغله، علشان كده في شروط.</p>
        <div className="info-cards">
          <div>
            <h2>✅ الشروط</h2>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>خبرة <b>{PROS.minYears} سنين</b> على الأقل في الشغل.</li>
              <li><b>{PROS.minPhotos} صور</b> على الأقل لشغل حقيقي نفّذته انت بإيدك (مش من النت)، وبنطلب منك صور أكتر على الواتساب.</li>
              <li>رقم واتساب شغال بإسمك، ومنطقة أو مناطق واضحة بتشتغل فيها.</li>
              <li><b>مرجع نكلمه:</b> عميل اشتغلتله قبل كده، أو محل أو ورشة تعرفك.</li>
              <li>بنكلمك ونتأكد من شغلك قبل ما نظهرك. مفيش حد بيظهر من غير مراجعة.</li>
            </ul>
          </div>
          <div>
            <h2>🤝 التزاماتك لو اتقبلت</h2>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>ترد على العميل في خلال {PROS.replyHours} ساعة.</li>
              <li>سعر واضح وميعاد محدد قبل ما تبدأ، من غير مفاجآت.</li>
              <li>تحترم المواعيد وتسيب المكان نضيف، وتشتغل بالمقاسات اللي اتفقتوا عليها.</li>
              <li>الاتفاق والدفع بينك وبين العميل مباشرة. ميكانيزم بتعرّف الزباين بيك بس ومش طرف في الشغل.</li>
              <li>ممنوع تقول إنك تبع ميكانيزم أو تستخدم اسمها في إعلانات من نفسك.</li>
            </ul>
          </div>
          <div>
            <h2>🚫 إمتى بنشيل الاسم؟</h2>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>شكوى مثبتة من عميل (شغل ناقص، تأخير كبير، تعامل وحش).</li>
              <li>عدم الرد على الزباين أو على مراجعتنا.</li>
              <li>بيانات أو صور مش حقيقية.</li>
              <li>بنراجع القايمة كل {PROS.recheckMonths} شهور.</li>
            </ul>
          </div>
        </div>
        <JoinForm />
      </main>
      <Footer site={site} />
    </>
  );
}
