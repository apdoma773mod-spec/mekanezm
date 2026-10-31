// Server-rendered pieces shared by store pages: header, socials, footer.
import Image from 'next/image';
import Link from 'next/link';
import type { Settings } from '@/lib/schema';
import { catalogUrl, shopPhones, waUrl } from '@/lib/shop';
import { SOCIAL_ICONS, SOCIAL_NAMES } from '@/lib/social-icons';
import { OpenBtn, Slider, type Slide } from './home';
import { OpenNow } from './open-now';

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

/** Promo strip. Arabic reads right-to-left, so the strip flows left-to-right: the beginning of the sentence enters first.
 *  Two identical halves (enough copies to fill the screen) make the loop seamless; speed is ~60 px per second. */
function Ticker({ text }: { text: string }) {
  const unit = text.length * 9 + 56;
  const copies = Math.max(1, Math.min(8, Math.ceil(700 / unit)));
  const half = Array.from({ length: copies }, (_, i) => <span key={i}>{text}</span>);
  return (
    <div className="ticker" role="marquee" aria-label={text} style={{ ['--mqd' as string]: `${Math.max(12, Math.round((copies * unit) / 60))}s` }}>
      <div className="tk-track" aria-hidden="true"><div>{half}</div><div>{half}</div></div>
      <p className="tk-static">{text}</p>
    </div>
  );
}

export function Header({ site, slides }: { site: Settings; slides: Slide[] }) {
  const pr = site.promo.trim();
  return (
    <header id="top">
      {site.logo && <Image className="logo-banner" src={site.logo} alt={site.name} width={1200} height={480} priority sizes="100vw" />}
      <Slider slides={slides} />
      {pr && <Ticker text={pr} />}
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
          <Link href="/quick">⚡ اطلب بالكود</Link>
          <Link href="/policy">🚚 التوصيل والاستبدال</Link>
          <Link href="/guide">📘 دليل الاختيار</Link>
          <Link href="/contact">📞 تواصل معانا</Link>
          <OpenBtn modal={{ kind: 'req' }} className="lnk">📷 اطلب منتج مش موجود</OpenBtn>
          <Link href="/orders">📦 طلباتي وتتبّع الطلب</Link>
          <Link href="/story">🎬 المنتجات بالتفصيل</Link>
          <Link href="/custom">🛠️ تجهيز المنتجات</Link>
          <Link href="/kits">🧰 أطقم جاهزة</Link>
          <Link href="/tools">🧮 حاسبات النجار</Link>
          <Link href="/works">🏗️ من شغلنا</Link>
          <Link href="/brands">🏷️ البراندات</Link>
          <Link href="/trade">💼 أسعار الجملة للنجارين والتجار</Link>
          <Link href="/about">👋 مين إحنا</Link>
          <Link href="/privacy">🔒 الخصوصية</Link>
          <Link href="/terms">📄 الشروط</Link>
        </div>
        <div><b>{site.name}</b>{site.tagline}</div>
        <div>
          <b>تواصل معنا</b>
          {site.phone && <a href={waUrl(site)} target="_blank" rel="noopener">📞 {site.phone}</a>}
          {shopPhones(site).map(n => <a key={n} href={'tel:' + n.replace(/\s/g, '')}>📞 {n}</a>)}
          {cat && <a href={cat} target="_blank" rel="noopener">📒 كتالوج الواتساب</a>}
        </div>
        {site.address && <div><b>العنوان</b><a href={site.mapUrl || '#'} target="_blank" rel="noopener">📍 {site.address}</a></div>}
        {site.hours && <div><b>مواعيد الشغل</b><span>🕒 {site.hours}</span><OpenNow /></div>}
        <div><b>تابعنا</b><Socials site={site} /></div>
      </div>
      <div className="cp">© {site.name}</div>
    </footer>
  );
}
