import type { Metadata } from 'next';
import Link from 'next/link';
import { OpenBtn } from '@/components/home';
import { OpenNow } from '@/components/open-now';
import { Footer, Socials } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { catalogUrl, MAP_URL, shopPhones, waUrl } from '@/lib/shop';

export const metadata: Metadata = {
  title: 'تواصل معانا | ميكانيزم',
  description: 'أرقام ميكانيزم، واتساب، العنوان في أرض اللواء – الجيزة، ومواعيد الشغل.',
  alternates: { canonical: '/contact' },
};

export default async function Contact() {
  const site = await getSettings();
  const cat = catalogUrl(site);
  const ld = {
    '@context': 'https://schema.org', '@type': 'ContactPage', url: SITE_URL + '/contact',
    mainEntity: { '@type': 'HardwareStore', name: site.name, telephone: site.phone, address: site.address, url: SITE_URL + '/' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>تواصل معانا</span></nav>
        <h1 className="page-h">📞 تواصل معانا</h1>
        <div className="info-cards">
          <div>
            <h2>💬 واتساب</h2>
            <p style={{ margin: 0 }}>أسرع طريقة — بنرد ونقولك السعر والتوفر.</p>
            <a className="btn-g" style={{ marginTop: 8 }} target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم')}>💬 كلّمنا واتساب {site.phone}</a>
            {cat && <a style={{ display: 'block', marginTop: 8 }} href={cat} target="_blank" rel="noopener">📒 كتالوج الواتساب</a>}
          </div>
          <div>
            <h2>☎️ تليفونات</h2>
            {shopPhones(site).map(n => <a key={n} style={{ display: 'block' }} href={'tel:' + n.replace(/\s/g, '')}>📞 {n}</a>)}
          </div>
          <div>
            <h2>📍 العنوان</h2>
            <p style={{ margin: 0 }}>{site.address || 'أرض اللواء – الجيزة'}</p>
            <a href={site.mapUrl || MAP_URL} target="_blank" rel="noopener">🗺️ افتح على الخريطة</a>
          </div>
          <div>
            <h2>🕒 مواعيد الشغل</h2>
            <p style={{ margin: 0 }}>{site.hours}</p>
            <OpenNow />
          </div>
          <div>
            <h2>📦 طلبك</h2>
            <OpenBtn modal={{ kind: 'track' }} className="sec">📦 تتبّع طلبك</OpenBtn>{' '}
            <OpenBtn modal={{ kind: 'req' }} className="sec">📷 اطلب منتج مش موجود</OpenBtn>
          </div>
          <div><h2>تابعنا</h2><Socials site={site} /></div>
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
