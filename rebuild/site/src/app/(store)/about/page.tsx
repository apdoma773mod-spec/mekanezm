import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Works } from '@/components/home';
import { OpenNow } from '@/components/open-now';
import { Footer, Socials } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { MAP_URL, sectionPath, shopPhones, waUrl } from '@/lib/shop';

export const metadata: Metadata = {
  title: 'مين إحنا | ميكانيزم — إكسسوارات المطابخ والدريسنج روم',
  description: 'ميكانيزم: محل إكسسوارات مطابخ ودريسنج روم وأبواب خشب في أرض اللواء بالجيزة. مفصلات، مجر، جرارات، ماجيك كورنر، وتصنيع أدراج ودلف بالمقاس.',
  alternates: { canonical: '/about' },
};

// Owner's own photos of the shop/team go in public/about/ and are listed here (empty = section hidden).
const PHOTOS: { src: string; alt: string }[] = [];

export default async function About() {
  const site = await getSettings();
  const secs = site.sections.filter(s => site.counts[s.id]);
  const phones = [site.phone, ...shopPhones(site)].filter((x, i, a) => x && a.indexOf(x) === i);
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>مين إحنا</span></nav>
        <h1 className="page-h">👋 مين إحنا</h1>
        {site.hero && <div className="about-hero"><Image src={site.hero} alt={site.name} fill sizes="(max-width:900px) 100vw, 860px" priority style={{ objectFit: 'cover' }} /></div>}
        <div className="info-cards">
          <div>
            <h2>{site.name}</h2>
            {site.tagline && <p style={{ margin: '0 0 6px' }}>{site.tagline}</p>}
            <p style={{ margin: 0 }}>محل متخصص في إكسسوارات المطابخ والدريسنج روم وأبواب الخشب. بنساعد النجار والزبون يختاروا القطعة الصح بالمقاس الصح، وبنوصّل لحد الباب أو بنشحن لأي محافظة.</p>
          </div>
          {secs.length > 0 && (
            <div>
              <h2>🧰 بنبيع إيه؟</h2>
              <div className="chips" style={{ flexWrap: 'wrap' }}>{secs.map(s => <Link key={s.id} href={sectionPath(s.id)}>{s.name}</Link>)}</div>
            </div>
          )}
          <div>
            <h2>📐 شغل بالمقاس</h2>
            بنصنّع أدراج استانلس وبامبو ودلف ألمنيوم على مقاسك. ابعت المقاسات من صفحة <Link href="/custom">التفصيل</Link> وهنراجعها معاك قبل التصنيع.
          </div>
          <div>
            <h2>📍 تلاقينا فين؟</h2>
            {site.address}{site.hours && <div>🕒 {site.hours}</div>}
            <div style={{ margin: '6px 0' }}><OpenNow /></div>
            {phones.length > 0 && <div dir="ltr" style={{ textAlign: 'right' }}>{phones.map(p => <a key={p} href={'tel:' + p} style={{ marginInlineEnd: 12 }}>{p}</a>)}</div>}
            <div className="row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <a className="sec" style={{ flex: 1, textAlign: 'center' }} target="_blank" rel="noopener" href={site.mapUrl || MAP_URL}>🗺️ الخريطة</a>
              <a className="btn-g" style={{ flex: 1, textAlign: 'center' }} target="_blank" rel="noopener" href={waUrl(site)}>💬 واتساب</a>
            </div>
          </div>
          {PHOTOS.length > 0 && (
            <div>
              <h2>📸 من المحل</h2>
              <div className="about-ph">{PHOTOS.map(p => <span key={p.src}><Image src={p.src} alt={p.alt} fill sizes="(max-width:720px) 50vw, 280px" style={{ objectFit: 'cover' }} /></span>)}</div>
            </div>
          )}
        </div>
        <Works />
        <Socials site={site} />
      </main>
      <Footer site={site} />
    </>
  );
}
