// Server-rendered pieces shared by store pages: header, socials, footer.
import Image from 'next/image';
import Link from 'next/link';
import type { Settings } from '@/lib/schema';
import { catalogUrl, MAP_URL, shopPhones, waUrl } from '@/lib/shop';
import { SOCIAL_ICONS, SOCIAL_NAMES } from '@/lib/social-icons';
import type { ReactNode } from 'react';
import { OpenBtn } from './home';
import { FtGroup } from './ft-group';
import { CatalogFooterLink } from './catalog-link';
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

export function Header({ site, children }: { site: Settings; children?: ReactNode }) {
  const pr = site.promo.trim();
  return (
    <header id="top">
      {site.logo && <Image className="logo-banner" src={site.logo} alt={site.name} width={1200} height={480} priority sizes="100vw" />}
      {children}
      {pr && <Ticker text={pr} />}
    </header>
  );
}

export function Footer({ site }: { site: Settings }) {
  const cat = catalogUrl(site);
  return (
    <footer className="ft">
      <div className="ft-top"><b>{site.name}</b>{site.tagline && <span>{site.tagline}</span>}</div>
      <div className="ft-ct">
        {site.phone && <a href={waUrl(site)} target="_blank" rel="noopener">💬 واتساب {site.phone}</a>}
        {shopPhones(site).map(n => <a key={n} href={'tel:' + n.replace(/\s/g, '')}>📞 {n}</a>)}
        {site.address && <a href={site.mapUrl || MAP_URL} target="_blank" rel="noopener">📍 {site.address}</a>}
        {cat && <a href={cat} target="_blank" rel="noopener">📒 كتالوج الواتساب</a>}
        {site.hours && <span>🕒 {site.hours} · <OpenNow /></span>}
      </div>
      <div className="ft-gs">
        <FtGroup title="🛍️ التسوق">
          <Link href="/">الرئيسية</Link>
          <Link href="/#cats">الأقسام</Link>
          <Link href="/search">كل المنتجات</Link>
          <Link href="/fav">♥ المفضلة</Link>
          <Link href="/quick">⚡ اطلب بالكود</Link>
          <OpenBtn modal={{ kind: 'req' }} className="lnk">📷 منتج مش موجود</OpenBtn>
          <Link href="/orders">📦 طلباتي والتتبّع</Link>
          <CatalogFooterLink />
          <Link href="/story">🎬 المنتجات بالتفصيل</Link>
        </FtGroup>
        <FtGroup title="🛠️ الخدمات">
          <Link href="/custom">🛠️ تجهيز بمقاسك</Link>
          <Link href="/kits">🧰 أطقم جاهزة</Link>
          <Link href="/tools">🧮 حاسبات النجار</Link>
          <Link href="/scraps">♻️ فضلة</Link>
          <Link href="/works">🏗️ من شغلنا</Link>
          <Link href="/brands">🏷️ البراندات</Link>
          <Link href="/help">🙋 محتاج فني؟</Link>
          <Link href="/pros">🧰 فنيين نرشّحهم</Link>
          <Link href="/trade">💼 أسعار الجملة</Link>
        </FtGroup>
        <FtGroup title="ℹ️ عن ميكانيزم">
          <Link href="/guide">📘 دليل الاختيار</Link>
          <Link href="/policy">🚚 التوصيل والاستبدال</Link>
          <Link href="/contact">📞 تواصل معانا</Link>
          <Link href="/directions">🗺️ تجيلنا إزاي</Link>
          <Link href="/about">👋 مين إحنا</Link>
          <Link href="/privacy">🔒 الخصوصية</Link>
          <Link href="/terms">📄 الشروط</Link>
        </FtGroup>
      </div>
      <div className="ft-so"><Socials site={site} /></div>
      <div className="cp">© {site.name}</div>
    </footer>
  );
}
