'use client';

import { useEffect, useState } from 'react';

/** 📱 تحكم في القايمة السفلية للموبايل (حجم / شكل / ألوان / أسماء): محفوظ على الجهاز ده بس، زي القديم. */
const K = 'mk_nav';
interface Nav {
  sz: 'S' | 'M' | 'L';
  shape: 'round' | 'soft' | 'square';
  lab: 0 | 1;
  mono: 0 | 1;
}
const D: Nav = { sz: 'M', shape: 'soft', lab: 1, mono: 0 };
const SZ: Record<Nav['sz'], [string, number]> = { S: ['صغيرة', 30], M: ['متوسطة', 36], L: ['كبيرة', 46] };
const SH: Record<Nav['shape'], [string, number]> = { round: ['دائرة', 1], soft: ['مستدير', 0.33], square: ['مربع', 0.12] };

function get(): Nav {
  try {
    return { ...D, ...(JSON.parse(localStorage.getItem(K) || '{}') as Partial<Nav>) };
  } catch {
    return { ...D };
  }
}

function apply(o: Nav) {
  const S = SZ[o.sz][1];
  const I = Math.round(S * 0.58);
  const sh = SH[o.shape][1];
  const R = sh === 1 ? '50%' : `${Math.round(S * sh)}px`;
  const css =
    `body.mkpro .mobile-nav .mkic,body.mkpro.mkdark .mobile-nav .mkic{width:${S}px!important;height:${S}px!important;border-radius:${R}!important}` +
    `body.mkpro .mobile-nav .mkic svg,body.mkpro.mkdark .mobile-nav .mkic svg{width:${I}px!important;height:${I}px!important}` +
    (o.mono ? 'body.mkpro .mobile-nav .mkic,body.mkpro.mkdark .mobile-nav .mkic{filter:grayscale(1)!important}' : '') +
    (o.lab ? '' : 'body.mkpro .mobile-nav button span:not(.mkic),body.mkpro .mobile-nav a span:not(.mkic){display:none!important}');
  let st = document.getElementById('mkNavSt');
  if (!st) {
    st = document.createElement('style');
    st.id = 'mkNavSt';
    document.head.appendChild(st);
  }
  st.textContent = css;
}

/** Applies the saved choice on every screen (mounted once in the shell). */
export function NavApply() {
  useEffect(() => apply(get()), []);
  return null;
}

export function NavCard() {
  const [o, setO] = useState<Nav>(D);
  useEffect(() => setO(get()), []);
  const put = (patch: Partial<Nav>) => {
    const n = { ...o, ...patch };
    setO(n);
    try {
      localStorage.setItem(K, JSON.stringify(n));
    } catch {
      /* private mode */
    }
    apply(n);
  };
  const btn = (label: string, on: boolean, f: () => void) => (
    <button
      type="button"
      key={label}
      onClick={f}
      style={{ padding: '9px 12px', borderRadius: 12, border: `2px solid ${on ? '#FFBE0B' : 'var(--ln2)'}`, background: 'var(--card)', color: 'var(--tx)', fontWeight: 700, boxShadow: on ? '0 0 0 3px rgba(255,190,11,.3)' : undefined }}
    >
      {label}
    </button>
  );
  const row = { display: 'flex', gap: 8, flexWrap: 'wrap' as const };
  const h = { fontWeight: 700, margin: '12px 0 6px' };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 6px' }}>📱 القايمة السفلية (الموبايل)</h3>
      <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>غيّر حجم الأيقونات وشكلها. التغيير بيتطبق فوراً على الجهاز ده.</p>
      <div style={h}>الحجم</div>
      <div style={row}>{(Object.keys(SZ) as Nav['sz'][]).map((k) => btn(SZ[k][0], o.sz === k, () => put({ sz: k })))}</div>
      <div style={h}>الشكل</div>
      <div style={row}>{(Object.keys(SH) as Nav['shape'][]).map((k) => btn(SH[k][0], o.shape === k, () => put({ shape: k })))}</div>
      <div style={h}>الألوان</div>
      <div style={row}>
        {btn('ملوّنة', !o.mono, () => put({ mono: 0 }))}
        {btn('أبيض ورمادي', !!o.mono, () => put({ mono: 1 }))}
      </div>
      <div style={h}>الأسماء تحت الأيقونات</div>
      <div style={row}>
        {btn('ظاهرة', !!o.lab, () => put({ lab: 1 }))}
        {btn('مخفية', !o.lab, () => put({ lab: 0 }))}
      </div>
    </div>
  );
}

/** 🔄 رقم النسخة + «حدّث السيستم دلوقتي»: يمسح الكاش وخدمة التطبيق ويحمّل آخر نسخة (الآيفون بيحتفظ بنسخة قديمة). */
export function VersionCard() {
  const [ver, setVer] = useState('?');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const s = Array.from(document.scripts).map((x) => x.src).find((x) => /main-app-/.test(x));
    const m = s && /main-app-([\w-]+)\.js/.exec(s);
    if (m) setVer(m[1].slice(0, 8));
  }, []);
  const go = async () => {
    setBusy(true);
    setMsg('⏳ بجيب آخر نسخة…');
    try {
      const rs = await navigator.serviceWorker.getRegistrations();
      for (const r of rs) await r.unregister();
    } catch {
      /* no service worker */
    }
    try {
      for (const k of await caches.keys()) await caches.delete(k);
    } catch {
      /* no cache storage */
    }
    location.replace(`${location.pathname}?v=${Date.now()}`);
  };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🔄 النسخة</h3>
      <p style={{ margin: '0 0 10px', lineHeight: 2 }}>
        رقم النسخة عندك: <b dir="ltr" style={{ fontSize: 17 }}>{ver}</b>
      </p>
      <button type="button" className="primary" disabled={busy} onClick={go} style={{ width: '100%', minHeight: 52 }}>
        🔄 حدّث السيستم دلوقتي
      </button>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{msg}</div>
    </div>
  );
}
