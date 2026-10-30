// Server-rendered pieces shared by store pages: header, socials, footer.
import Image from 'next/image';
import Link from 'next/link';
import type { Settings } from '@/lib/schema';
import { catalogUrl, shopPhones, waUrl } from '@/lib/shop';
import { SOCIAL_ICONS, SOCIAL_NAMES } from '@/lib/social-icons';
import { OpenBtn, Slider, type Slide } from './home';

export function Socials({ site }: { site: Settings }) {
  const keys = (['fb', 'ig', 'tt', 'yt'] as const).filter(k => /^https?:\/\//i.test(site.socials[k] ?? ''));
  if (!keys.length) return null;
  return (
    <div className="socs">
      {keys.map(k => (
        <a key={k} className={k} href={site.socials[k]} target="_blank" rel="noopener" aria-label={SOCIAL_NAMES[k]} title={SOCIAL_NAMES[k]}
          dangerouslySetInnerHTML={{ __html: SOCIAL_ICONS[k] }} />
      ))}
    </div>
  );
}

export function Header({ site, slides }: { site: Settings; slides: Slide[] }) {
  const pr = site.promo.trim();
  return (
    <header id="top">
      {site.logo && <Image className="logo-banner" src={site.logo} alt={site.name} width={1200} height={480} priority sizes="100vw" />}
      <Slider slides={slides} />
      {pr && <div className="ticker" aria-label={pr}><span aria-hidden="true">{pr} &nbsp;•&nbsp; {pr} &nbsp;•&nbsp; {pr}</span></div>}
    </header>
  );
}

export function Footer({ site }: { site: Settings }) {
  const cat = catalogUrl(site);
  return (
    <footer className="ft">
      <div className="fc">
        <div>
          <b>روابط سريعة</b>
          <Link href="/#top">الرئيسية</Link>
          <Link href="/#cats">الأقسام</Link>
          <Link href="/search">كل المنتجات</Link>
          <Link href="/fav">♥ المفضلة</Link>
          <Link href="/#info">التوصيل والاستبدال</Link>
          <OpenBtn modal={{ kind: 'req' }} className="lnk">📷 اطلب منتج مش موجود</OpenBtn>
          <OpenBtn modal={{ kind: 'track' }} className="lnk">📦 تتبّع طلبك</OpenBtn>
          <Link href="/story">🎬 المنتجات بالتفصيل</Link>
          <Link href="/custom">🛠️ تجهيز المنتجات</Link>
        </div>
        <div><b>{site.name}</b>{site.tagline}</div>
        <div>
          <b>تواصل معنا</b>
          {site.phone && <a href={waUrl(site)} target="_blank" rel="noopener">📞 {site.phone}</a>}
          {shopPhones(site).map(n => <a key={n} href={'tel:' + n.replace(/\s/g, '')}>📞 {n}</a>)}
          {cat && <a href={cat} target="_blank" rel="noopener">📒 كتالوج الواتساب</a>}
        </div>
        {site.address && <div><b>العنوان</b><a href={site.mapUrl || '#'} target="_blank" rel="noopener">📍 {site.address}</a></div>}
        {site.hours && <div><b>مواعيد الشغل</b><span>🕒 {site.hours}</span></div>}
        <div><b>تابعنا</b><Socials site={site} /></div>
      </div>
      <div className="cp">© {site.name}</div>
    </footer>
  );
}
