import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { HelpForm } from './help-form';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'محتاج حد ينفّذ أو يركّب أو يصلّح؟ نرشّحلك | ميكانيزم',
  description: 'ميكانيزم بتبيع الإكسسوارات ومبتركّبش ومعندهاش فنيين. احكيلنا محتاج إيه ونرشّحلك نجار أو مهندس مستقل راجعنا شغله.',
  alternates: { canonical: '/help' },
};

export default async function Help() {
  const site = await getSettings();
  // Only what the form needs to suggest people after sending (small list, no private fields besides the phone he published).
  const pros = site.pros.map(p => ({ id: p.id, name: p.name, kind: p.kind, skills: p.skills, areas: p.areas, phone: p.phone, years: p.years, photo: p.photo || p.imgs[0] || '', imgs: p.imgs.length }));
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>محتاج حد ينفّذ؟</span></nav>
        <h1 className="page-h">🙋 محتاج حد ينفّذ الشغل؟</h1>
        <div className="info-cards" style={{ marginBottom: 12 }}>
          <div>
            <h2>الأول، إحنا مين وبنعمل إيه؟</h2>
            ميكانيزم بتبيع <b>الإكسسوارات والخامات</b> بس. <b>مبنركّبش ومبنشتغلش بنفسنا، ومعندناش فنيين ولا صنايعية تبعنا.</b> علشان كده لو بتعمل حاجة جديدة أو محتاج تصلّح أو تغيّر حاجة في بيتك، بنساعدك نوصل لحد يعملهالك.
          </div>
          <div>
            <h2>بنساعدك إزاي؟</h2>
            احكيلنا محتاج إيه (تنفيذ جديد، تغيير أو إصلاح، تصميم، أو أي حاجة تانية) وفي أنهي منطقة، وبنرشّحلك نجارين ومهندسين <b>مستقلين</b> راجعنا شغلهم. بتكلمهم مباشرة وتتفق معاهم على السعر والميعاد، وإحنا مش طرف في الاتفاق. وكمان بنقولك على الإكسسوارات المناسبة لشغلك لو حبيت.
          </div>
        </div>
        <HelpForm pros={pros} />
      </main>
      <Footer site={site} />
    </>
  );
}
