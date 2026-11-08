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
        <div className="svc-g ct-g">
          <a className="svc-t main ct-wide" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم')}><span className="ic" aria-hidden="true">💬</span><b>كلّمنا واتساب</b><small>{site.phone} — أسرع رد</small></a>
          {shopPhones(site).map(n => <a key={n} className="svc-t" href={'tel:' + n.replace(/\s/g, '')}><span className="ic" aria-hidden="true">📞</span><b>اتصل</b><small>{n}</small></a>)}
          <a className="svc-t" href={site.mapUrl || MAP_URL} target="_blank" rel="noopener"><span className="ic" aria-hidden="true">📍</span><b>الخريطة</b><small>{site.address || 'أرض اللواء – الجيزة'}</small></a>
          <Link className="svc-t" href="/directions"><span className="ic" aria-hidden="true">🧭</span><b>تجيلنا إزاي</b><small>خطوة بخطوة</small></Link>
          <OpenBtn modal={{ kind: 'track' }} className="svc-t"><span className="ic" aria-hidden="true">📦</span><b>تتبّع طلبك</b><small>برقم موبايلك</small></OpenBtn>
          <OpenBtn modal={{ kind: 'req' }} className="svc-t"><span className="ic" aria-hidden="true">📷</span><b>منتج مش موجود</b><small>صوّره وابعته</small></OpenBtn>
          {cat && <a className="svc-t" href={cat} target="_blank" rel="noopener"><span className="ic" aria-hidden="true">📒</span><b>كتالوج واتساب</b><small>كل الأصناف</small></a>}
        </div>
        <div className="ct-hrs"><span>🕒 {site.hours}</span><OpenNow /></div>
        <div className="ct-soc"><b>تابعنا</b><Socials site={site} /></div>
      </main>
      <Footer site={site} />
    </>
  );
}
