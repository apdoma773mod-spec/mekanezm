'use client';
import { useEffect, useState } from 'react';

type BIP = Event & { prompt: () => Promise<unknown> };
/** «ثبّت فضلة على الشاشة»: Android installs with one tap; iPhone gets the two-step hint. Hidden once installed. */
export function InstallScrap() {
  const [ev, setEv] = useState<BIP | null>(null), [ios, setIos] = useState(false), [hide, setHide] = useState(true), [tip, setTip] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    setHide(!!standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setEv(e as BIP); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (hide) return null;
  return (
    <div style={{ margin: '0 0 10px' }}>
      <button type="button" className="sc-chip on" onClick={() => { if (ev) ev.prompt(); else setTip(t => !t); }}>📲 ثبّت «فضلة» على شاشة موبايلك</button>
      {tip && <p className="mut" style={{ margin: '6px 0 0' }}>{ios ? 'من سفاري: دوس زرار المشاركة (المربع والسهم) ثم «إضافة إلى الشاشة الرئيسية».' : 'من قايمة المتصفح (⋮): اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'}</p>}
    </div>
  );
}
