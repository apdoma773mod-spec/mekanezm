'use client';
// Things that float over every store page: bottom nav, WhatsApp button, "continue order" bar,
// back-to-top, scroll progress, toast, offline notice, install-app button.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { bumpVisit } from '@/lib/api';
import { waUrl } from '@/lib/shop';
import { Modals } from './modals';
import { useShop } from './shop-provider';

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
  const { site, cartCount, fav, favOn, setFavOn, open, toast, say } = useShop();
  const path = usePathname();
  const router = useRouter();
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
  useEffect(() => { bumpVisit('shop'); }, []);
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
  // ?track=REF opens tracking (links from the custom-order page and old shop.html?track=).
  useEffect(() => { if (qs.has('track')) open({ kind: 'track', ref: qs.get('track') ?? '' }); }, [qs, open]);

  const go = (hash: string) => {
    if (path === '/') document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    else router.push('/#' + hash);
  };

  return (
    <>
      <div className="prog" aria-hidden="true"><i style={{ width: prog + '%' }} /></div>
      {offline && <div className="offline" role="status">⚠️ مفيش إنترنت — بعض الحاجات ممكن ماتشتغلش</div>}
      <a className={'wa-fab' + (y > 260 || onProduct ? ' mini' : '')} style={onProduct ? { bottom: 'calc(84px + var(--safe-b))' } : undefined}
        target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أطلب من ميكانيزم')}>💬 اطلب على الواتساب</a>
      {!onProduct && <button className={'to-top' + (y > 700 ? ' on' : '')} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} aria-label="لفوق">↑</button>}
      {!onProduct && cartCount > 0 && (
        <button className="go-cart" onClick={() => open({ kind: 'cart' })}><span>🛒 عندك {cartCount} في طلبك</span><span>كمّل الطلب ←</span></button>
      )}
      {inst && <button className="inst" onClick={async () => { inst.prompt(); try { await inst.userChoice; } catch { /* */ } setInst(null); }}>⬇️ ثبّت التطبيق</button>}
      <div className={'toast' + (toast ? ' on' : '')} role="status">
        <span>{toast?.msg}</span>
        {toast?.undo && <button type="button" onClick={toast.undo}>تراجع</button>}
      </div>
      {!onProduct && (
        <nav className="nv" aria-label="التنقل">
          <button onClick={() => { setFavOn(false); if (path === '/') scrollTo({ top: 0, behavior: 'smooth' }); else router.push('/'); }}><b>🏠</b>الرئيسية</button>
          <button onClick={() => go('cats')}><b>▦</b>الأقسام</button>
          <button onClick={() => { setFavOn(false); go('prods0'); }}><b>🛍</b>المنتجات</button>
          <button className={favOn ? 'on' : ''} onClick={() => { setFavOn(!favOn); go('prods0'); }}><b>♥</b>المفضلة{fav.size > 0 && <i>{fav.size}</i>}</button>
          <button onClick={() => open({ kind: 'cart' })}><b>🛒</b>السلة{cartCount > 0 && <i>{cartCount}</i>}</button>
        </nav>
      )}
      <Modals />
    </>
  );
}
