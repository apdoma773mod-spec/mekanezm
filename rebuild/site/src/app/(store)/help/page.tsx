import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { HelpForm } from './help-form';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'محتاج حد يركّب أو يصلّح؟ احكيلنا مشكلتك | ميكانيزم',
  description: 'مجرة دولاب وقعت؟ مطبخ جديد؟ دريسنج روم؟ جزامة؟ صيانة في البيت؟ احكيلنا ونرشّحلك نجار أو مهندس مراجَع شغله.',
  alternates: { canonical: '/help' },
};

export default async function Help() {
  const site = await getSettings();
  // Only what the form needs to suggest people after sending (small list, no private fields besides the phone he published).
  const pros = site.pros.map(p => ({ id: p.id, name: p.name, kind: p.kind, skills: p.skills, areas: p.areas, phone: p.phone, years: p.years, photo: p.photo || p.imgs[0] || '', imgs: p.imgs.length }));
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>احكيلنا مشكلتك</span></nav>
        <h1 className="page-h">🙋 محتاج حد يركّب أو يصلّح أو يصمّم؟</h1>
        <p className="pro-note">ميكانيزم بتبيع الإكسسوارات ومبتركّبش، بس مش هنسيبك. احكيلنا محتاج إيه وهنرشّحلك صنايعي أو مهندس راجعنا شغله.</p>
        <div className="info-cards" style={{ marginBottom: 12 }}>
          <div>
            <h2>🗃️ مجرة الدولاب أو الدرج القديمة بايظة؟</h2>
            أكتر مشكلة بنسمعها: المجرة القديمة مبقتش موجودة في السوق والجديدة مقاسها مختلف. <b>صوّرها وابعتها</b> هنا وهنقولك البديل المناسب ونرشّحلك حد يركّبها. ولو عايز تقيس بنفسك: <Link href="/guide/old-slide">إزاي تقيس وتغيّر المجرة القديمة</Link>.
          </div>
        </div>
        <HelpForm pros={pros} />
      </main>
      <Footer site={site} />
    </>
  );
}
