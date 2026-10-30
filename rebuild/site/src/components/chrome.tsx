'use client';
// Things that float over every store page: bottom nav, WhatsApp button, "continue order" bar,
// back-to-top, scroll progress, toast, offline notice, install-app button.
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { bumpVisit } from '@/lib/api';
import { ev, reportError } from '@/lib/track';
import { waUrl } from '@/lib/shop';
import { Modals } from './modals';
import { useMounted, useShop } from './shop-provider';

const useScrollY = () => {
  const [y, setY] = useState(0);
  useEffect(() => {
    let t = 0;
    const f = () => { if (!t) t = requestAnimationFrame(() => { t = 0; setY(scrollY); }); };
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);
  return y;
};

type BIP = Event & { prompt: () => void; userChoice: Promise<unknown> };

export function Chrome() {
  const { site, cartCount: cc, fav, open, toast, say } = useShop();
  const mounted = useMounted();
  const cartCount = mounted ? cc : 0;
  const favN = mounted ? Object.keys(fav).length : 0;
  const path = usePathname();
  const qs = useSearchParams();
  const y = useScrollY();
  const onProduct = path.startsWith('/p/');
  const [prog, setProg] = useState(0);
  const [offline, setOffline] = useState(false);
  const [inst, setInst] = useState<BIP | null>(null);

  useEffect(() => {
    const h = document.documentElement, m = h.scrollHeight - innerHeight;
    setProg(m > 0 ? (y / m) * 100 : 0);
  }, [y]);
  useEffect(() => {
    bumpVisit('shop');
    // Count WhatsApp / phone taps as contacts in analytics.
    const tap = (e: MouseEvent) => { const a = (e.target as Element)?.closest?.('a[href*="wa.me"],a[href^="tel:"]'); if (a) ev('contact', 'Contact', { method: a.getAttribute('href')!.startsWith('tel:') ? 'phone' : 'whatsapp' }); };
    document.addEventListener('click', tap, true);
    // Offline support + fast repeat visits (see public/sw.js).
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Script errors on customers' phones go to /api/log (see reportError).
    addEventListener('error', e => reportError(e.message, e.error?.stack));
    addEventListener('unhandledrejection', e => reportError(String(e.reason?.message ?? e.reason), e.reason?.stack));
  }, []);
  useEffect(() => {
    const f = () => setOffline(!navigator.onLine);
    f(); addEventListener('online', f); addEventListener('offline', f);
    const b = (e: Event) => { e.preventDefault(); setInst(e as BIP); };
    const done = () => setInst(null);
    addEventListener('beforeinstallprompt', b); addEventListener('appinstalled', done);
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      const ios = /iphone|ipad/i.test(navigator.userAgent), sa = (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !sa && !localStorage.getItem('mk_ioshint')) t = setTimeout(() => { say('📲 ثبّت الموقع: اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية»'); localStorage.setItem('mk_ioshint', '1'); }, 9000);
    } catch { /* */ }
    return () => { removeEventListener('online', f); removeEventListener('offline', f); removeEventListener('beforeinstallprompt', b); removeEventListener('appinstalled', done); clearTimeout(t); };
  }, [say]);
  // Returning visitor with a saved cart: remind once per visit.
  useEffect(() => {
    if (!mounted || !cc) return;
    try { if (sessionStorage.getItem('mk_remind')) return; sessionStorage.setItem('mk_remind', '1'); } catch { return; }
    const t = setTimeout(() => say(`🛒 لسه عندك ${cc} في طلبك`, () => open({ kind: 'cart' }), 'كمّل الطلب'), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, cc > 0]);
  // ?track=REF opens tracking (links from the custom-order page and old shop.html?track=).
  useEffect(() => { if (qs.has('track')) open({ kind: 'track', ref: qs.get('track') ?? '' }); }, [qs, open]);


  return (
    <>
      <div className="prog" aria-hidden="true"><i style={{ width: prog + '%' }} /></div>
      {offline && <div className="offline" role="status">⚠️ مفيش إنترنت — بعض الحاجات ممكن ماتشتغلش</div>}
      <a className={'wa-fab' + (y > 120 || path !== '/' ? ' mini' : '')} style={onProduct ? { bottom: 'calc(84px + var(--safe-b))' } : undefined} aria-label="كلّمنا على الواتساب"
        target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أطلب من ميكانيزم')}
        onClick={e => {
          // Mention what the customer is looking at (product or section).
          const h = document.querySelector('main h1, .pvi h1')?.textContent?.trim();
          if (h && (onProduct || path.startsWith('/c/'))) e.currentTarget.href = waUrl(site, `السلام عليكم، بسأل عن: ${h}
${location.href}`);
        }}>💬 اطلب على الواتساب</a>
      {!onProduct && <button className={'to-top' + (y > 700 ? ' on' : '')} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} aria-label="لفوق">↑</button>}
      {!onProduct && cartCount > 0 && (
        <button className="go-cart" onClick={() => open({ kind: 'cart' })}><span>🛒 عندك {cartCount} في طلبك</span><span>كمّل الطلب ←</span></button>
      )}
      {inst && <button className="inst" onClick={async () => { inst.prompt(); try { await inst.userChoice; } catch { /* */ } setInst(null); }}>⬇️ ثبّت التطبيق</button>}
      <div className={'toast' + (toast ? ' on' : '')} role="status">
        <span>{toast?.msg}</span>
        {toast?.undo && <button type="button" onClick={toast.undo}>{toast.label ?? 'تراجع'}</button>}
      </div>
      {!onProduct && (
        <nav className="nv" aria-label="التنقل">
          <Link href="/" className={path === "/" ? "on" : ""} onClick={() => path === "/" && scrollTo({ top: 0, behavior: "smooth" })}><b>🏠</b>الرئيسية</Link>
          <Link href="/#cats" className={path.startsWith("/c/") ? "on" : ""}><b>▦</b>الأقسام</Link>
          <Link href="/search" className={path === "/search" ? "on" : ""}><b>🛍</b>المنتجات</Link>
          <Link href="/fav" className={path === "/fav" ? "on" : ""}><b>♥</b>المفضلة{favN > 0 && <i>{favN}</i>}</Link>
          <button onClick={() => open({ kind: "cart" })}><b>🛒</b>السلة{cartCount > 0 && <i>{cartCount}</i>}</button>
        </nav>
      )}
      <Modals />
    </>
  );
}
