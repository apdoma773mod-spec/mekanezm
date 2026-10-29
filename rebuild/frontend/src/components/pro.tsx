'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { I, IL, logoSVG } from '@/legacy/pro-art';
import { money } from '@/lib/format';
import { useProducts, useToday } from '@/lib/trade-queries';
import { useToast } from './ui/toast';
import { useIsAdmin } from './use-role';

/**
 * «✨ ميكانيزم برو» — the old system's last design layer (index.html 8938-9258), redone as React:
 * one fixed color + drawing per screen, the big launcher tiles, the moving logo, the alerts ticker
 * under the logo, and the background / sidebar colors from «المظهر».
 */

const SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">';

/** New route → the old page id (it picks the icon, the screen color and the CSS that targets #id). */
export function pageIdOf(pathname: string, k?: string | null): string {
  if (pathname === '/') return 'dashboard';
  const p = pathname.split('/')[1] ?? '';
  if (p === 'work') return { ord: 'wkOrd', new: 'wkLeaf', steel: 'wkSteel', rods: 'wkRods', forf: 'wkForf', disp: 'wkDisp', exp: 'wkExp', off: 'wkOff' }[k ?? 'ord'] ?? 'wkOrd';
  return p;
}

export function proOn(): boolean {
  try {
    return localStorage.getItem('mk_pro') !== '0';
  } catch {
    return true;
  }
}

export function ProIcon({ k }: { k: string }) {
  const d = I[k];
  if (!d) return null;
  return <span className="mkic" style={{ '--c': d[0] } as CSSProperties} dangerouslySetInnerHTML={{ __html: `${SVG}${d[1]}</svg>` }} />;
}

export function ProIll({ k }: { k: string }) {
  const s = IL[k];
  const d = I[k];
  if (!s || !d) return <ProIcon k={k} />;
  return (
    <span
      className="mkill"
      style={{ '--c': d[0] } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 64 64" aria-hidden="true">${s}</svg>` }}
    />
  );
}

// ══ الأرضية: لون من «المظهر» + الألوان المتداخلة شغالة/مقفولة + لون القايمة الجانبية ══
const BGP: [string, string][] = [
  ['#f7f6fb', 'أبيض متداخل'],
  ['#ffffff', 'أبيض سادة'],
  ['#fff4cc', 'أصفر منجاوي فاتح'],
  ['#ffe08a', 'أصفر'],
  ['#eaf0ff', 'لبني'],
  ['#e9f7ef', 'أخضر فاتح'],
  ['#fde8f1', 'بمبي فاتح'],
  ['#eceef2', 'رمادي فاتح'],
  ['#0B1650', 'كحلي غامق'],
  ['#0e1114', 'أسود'],
];
const SDP: [string, string][] = [
  ['', 'تلقائي (زي الأرضية)'],
  ['#ffffff', 'أبيض'],
  ['#0e1114', 'أسود'],
  ['#0B1650', 'كحلي'],
  ['#1F3FB8', 'أزرق'],
  ['#FFBE0B', 'منجاوي'],
  ['#14532d', 'أخضر غامق'],
  ['#3b0764', 'بنفسجي غامق'],
  ['#374151', 'رمادي غامق'],
];
interface Bg {
  c: string;
  fx: boolean;
  side: string;
}
const HEX = /^#[0-9a-f]{6}$/i;
function bgGet(): Bg {
  let o: Bg = { c: '#f7f6fb', fx: true, side: '' };
  try {
    const v = JSON.parse(localStorage.getItem('mk_bg') || 'null');
    if (v && HEX.test(v.c)) o = { c: v.c, fx: v.fx !== 0, side: HEX.test(v.side || '') ? v.side : '' };
  } catch {
    /* default */
  }
  return o;
}
function lum(h: string) {
  const n = parseInt(h.slice(1), 16);
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function bgApply() {
  const o = bgGet();
  const B = document.body;
  B.style.setProperty('--bgc', o.c);
  B.classList.toggle('mkdark', lum(o.c) < 0.32 && B.classList.contains('mkpro'));
  B.classList.toggle('mk-nofx', !o.fx);
  if (o.side) {
    B.style.setProperty('--sideBg', o.side);
    B.classList.add('mkside');
    B.classList.toggle('mkside-dk', lum(o.side) < 0.32);
  } else B.classList.remove('mkside', 'mkside-dk');
}
function bgSet(c: string | null, fx: boolean | null, side: string | null) {
  const o = bgGet();
  if (c) o.c = c;
  if (fx != null) o.fx = fx;
  if (side != null) o.side = side;
  try {
    localStorage.setItem('mk_bg', JSON.stringify({ c: o.c, fx: o.fx ? 1 : 0, side: o.side }));
  } catch {
    /* private mode */
  }
  bgApply();
  return o;
}

/** كل شاشة بلونها (نفس لون أيقونتها)، والمزدحمة شريط عنوان كامل بلونها. */
const STRONG = ['daybook', 'count', 'sales', 'waorders', 'weborders', 'shipping'];

/** body classes and variables the old Pro script kept up to date. */
export function useProBody(pageId: string) {
  useEffect(() => {
    const B = document.body;
    B.classList.toggle('mkpro', proOn());
    bgApply();
  }, []);
  useEffect(() => {
    const B = document.body;
    const c = I[pageId]?.[0];
    if (c) B.style.setProperty('--pg', c);
    else B.style.removeProperty('--pg');
    B.classList.toggle('pg-on', !!c && pageId !== 'dashboard');
    B.classList.toggle('pg-strong', !!c && STRONG.includes(pageId));
    B.dataset.pg = pageId;
    B.classList.remove('navon');
  }, [pageId]);
  // الشريط الجانبي بيمشي مع الشريط العلوي، واسم ميكانيزم الصغير يظهر لما اللوجو الكبير يطلع لفوق
  useEffect(() => {
    let q = 0;
    let lastT = -1;
    let lastS: boolean | null = null;
    const hdr = () => {
      q = 0;
      const t = document.querySelector('header.top');
      const b = t?.querySelector('.brand');
      if (!t || !b) return;
      const v = Math.max(0, Math.round(t.getBoundingClientRect().bottom));
      if (v !== lastT) {
        lastT = v;
        document.documentElement.style.setProperty('--asTop', `${v}px`);
      }
      const st = b.getBoundingClientRect().bottom <= 6;
      if (st !== lastS) {
        lastS = st;
        t.classList.toggle('stuck', st);
      }
    };
    const on = () => {
      if (!q) {
        q = 1;
        requestAnimationFrame(hdr);
      }
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    const vis = () => document.body.classList.toggle('mk-bgd', document.hidden);
    document.addEventListener('visibilitychange', vis);
    hdr();
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
}

/** The moving background blobs (hidden by the v2 CSS unless «mk-rich» is on, as in the old system). */
export function BgFx() {
  return (
    <div id="mkBgFx" aria-hidden="true">
      <i className="pg" />
      <i className="b b1" />
      <i className="b b2" />
      <i className="b b3" />
      <i className="b b4" />
      <i className="b b5" />
    </div>
  );
}

/** لوجو ميكانيزم المتحرك تحت الشريط العلوي. */
export function ProLogo({ logo }: { logo?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = ref.current;
    if (!w) return;
    w.innerHTML = `${logoSVG()}<div class="mkbrand" role="img" aria-label="ميكانيزم"><i></i></div>`;
    const svg = w.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;
    const bi = w.querySelector('.mkbrand i') as HTMLElement | null;
    if (logo && bi) {
      bi.style.webkitMaskImage = `url(${logo})`;
      bi.style.maskImage = `url(${logo})`;
    }
    const mq = window.matchMedia('(max-width:700px)');
    const fit = () => svg.setAttribute('viewBox', mq.matches ? '400 0 900 200' : '0 0 1700 200');
    fit();
    mq.addEventListener('change', fit);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    let io: IntersectionObserver | null = null;
    if (still) svg.pauseAnimations();
    else {
      io = new IntersectionObserver((es) => es.forEach((x) => (x.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations())));
      io.observe(w);
    }
    const vis = () => (document.hidden || still ? svg.pauseAnimations() : svg.unpauseAnimations());
    document.addEventListener('visibilitychange', vis);
    return () => {
      mq.removeEventListener('change', fit);
      io?.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, [logo]);
  return <div id="mkLogo" ref={ref} />;
}

export function MkMini() {
  return (
    <span id="mkMini" aria-hidden="true">
      <i />
      ميكانيزم
    </span>
  );
}

type Tick = [string, string, (() => void) | null, string];

/** شريط التنبيهات الماشي تحت اللوجو: نواقص المحل، الفلوس اللي برة... وكل تنبيه بيفتح شاشته. */
export function Ticker() {
  const router = useRouter();
  const admin = useIsAdmin();
  const out = useProducts({ stock: 'out', pageSize: 5, sort: 'name' });
  const low = useProducts({ stock: 'low', pageSize: 5, sort: 'name' });
  const today = useToday();
  const inn = useRef<HTMLDivElement>(null);

  const nm = (L: { name: string }[], total: number) => L.slice(0, 4).map((p) => p.name).join('، ') + (total > 4 ? ` و${total - 4} كمان` : '');
  const A: Tick[] = [];
  const go = (href: string) => () => router.push(href);
  if (admin && out.data?.total) A.push(['❌', `خلص من المحل (${out.data.total}): ${nm(out.data.items, out.data.total)}`, go('/reorder'), 'bad']);
  if (admin && low.data?.total) A.push(['⚠️', `قرّب يخلص (${low.data.total}): ${nm(low.data.items, low.data.total)}`, go('/reorder'), 'warn']);
  if (today.data && today.data.receivables > 0) A.push(['💰', `فلوس عند العملاء: ${money(today.data.receivables)}`, go(admin ? '/debts' : '/contacts'), 'gold']);
  if (!A.length) A.push(['✅', 'كله تمام — مفيش تنبيهات دلوقتي', null, 'ok']);
  const sig = A.map((x) => x[1]).join('|');

  useEffect(() => {
    const el = inn.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth || 600;
      el.style.animationDuration = `${Math.max(16, w / 55).toFixed(1)}s`;
    });
  }, [sig]);

  const one = (hidden?: boolean) => (
    <span className="mkt-run" aria-hidden={hidden || undefined}>
      {A.map((x, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <button type="button" className={`mkt-i ${x[3]}`} onClick={() => x[2]?.()} tabIndex={hidden ? -1 : undefined}>
            <b>{x[0]}</b>
            {x[1]}
          </button>
          <i className="mkt-s">◆</i>
        </span>
      ))}
    </span>
  );
  return (
    <div id="mkTicker" role="marquee" aria-label="تنبيهات مهمة">
      <div className="mkt-in" ref={inn}>
        {one()}
        {one(true)}
      </div>
    </div>
  );
}

/** مربعات كبيرة: الشاشات اللي بتتفتح طول اليوم. [key, title, sub, href, adminOnly] */
const TILES: [string, string, string, string, boolean][] = [
  ['daybook', 'يومية المحل', 'اكتب البيعة على طول', '/daybook', false],
  ['wkOrd', 'الأوردرات', 'خط سير كل أوردر', '/work?k=ord', true],
  ['wkLeaf', 'أوردر دلفة', 'دلفة جديدة برسمة', '/work?k=new', true],
  ['wkSteel', 'الاستانلس', 'حاسبة وتقطيع', '/work?k=steel', true],
  ['wkRods', 'حاسبة الأعواد', 'الدرف هتاخد كام عود', '/work?k=rods', true],
  ['wkForf', 'الفرفورجيه', 'خط سير العود', '/work?k=forf', true],
  ['products', 'الأصناف والمخزون', 'بحث ورصيد وأسعار', '/products', false],
  ['contacts', 'العملاء والموردين', 'الحسابات والأرصدة', '/contacts', false],
  ['debts', 'الديون والتذكير', 'مين عليه فلوس', '/debts', true],
  ['shipping', 'الشحن والتوصيل', 'الطلبات اللي خارجة', '/shipping', false],
];

export function Launch() {
  const router = useRouter();
  const admin = useIsAdmin();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(proOn()), []);
  if (!on) return null;
  // The new system hides products/contacts from staff, so the tiles follow the sidebar.
  const L = TILES.filter((t) => admin || (!t[4] && t[0] !== 'products' && t[0] !== 'contacts'));
  return (
    <div id="mkLaunch" className="mkLaunch">
      {L.map((t) => (
        <button key={t[0]} type="button" style={{ '--c': I[t[0]][0] } as CSSProperties} onClick={() => router.push(t[3])}>
          <ProIll k={t[0]} />
          <span>
            {t[1]}
            <small>{t[2]}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** مفتاح التشغيل/الإيقاف ولون الأرضية والقايمة في شاشة المظهر. */
export function ProThemeCard() {
  const toast = useToast();
  const [pro, setPro] = useState(true);
  const [o, setO] = useState<Bg>({ c: '#f7f6fb', fx: true, side: '' });
  useEffect(() => {
    setPro(document.body.classList.contains('mkpro'));
    setO(bgGet());
  }, []);
  const set = (c: string | null, fx: boolean | null, side: string | null) => setO({ ...bgSet(c, fx, side) });
  const chip = (c: string, label: string, sel: boolean, onClick: () => void, sw?: string) => (
    <button
      key={label}
      type="button"
      className={sel ? 'on' : ''}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, border: '2px solid var(--ln2)', background: 'var(--card)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}
    >
      <i style={{ width: 22, height: 22, borderRadius: 7, background: sw ?? c, border: '1px solid rgba(0,0,0,.18)', display: 'inline-block' }} />
      {label}
    </button>
  );
  return (
    <div className="card" id="mkProCard" style={{ marginBottom: 14 }}>
      <h3>✨ تصميم ميكانيزم برو</h3>
      <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>
        لوجو ميكانيزم المتحرك، كل شاشة ليها لون ثابت مايتكررش، رسومات مجسّمة للحاجات اللي بتتفتح كتير، وكل خانة في اليومية بلون.
      </p>
      <label className="chk">
        <input
          type="checkbox"
          checked={pro}
          onChange={(e) => {
            try {
              localStorage.setItem('mk_pro', e.target.checked ? '1' : '0');
            } catch {
              toast('مقدرتش أحفظ الاختيار', 'bad');
            }
            location.reload();
          }}
        />{' '}
        شغّال
      </label>
      <h3 style={{ margin: '18px 0 8px' }}>🎨 لون الأرضية</h3>
      <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>اختار لون من دول أو أي لون من المربع. لو اخترت لون غامق السيستم كله بيقلب غامق لوحده.</p>
      <div id="mkBgP" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {BGP.map((p) => chip(p[0], p[1], p[0] === o.c, () => set(p[0], null, null)))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          لون براحتك{' '}
          <input type="color" id="mkBgC" value={o.c} onChange={(e) => set(e.target.value, null, null)} style={{ width: 54, height: 38, padding: 2, borderRadius: 10, cursor: 'pointer' }} />
        </label>
        <label className="chk">
          <input type="checkbox" checked={o.fx} onChange={(e) => set(null, e.target.checked, null)} /> ألوان متداخلة بتتحرك فوق الأرضية
        </label>
      </div>
      <h3 style={{ margin: '18px 0 8px' }}>🧭 لون القايمة الجانبية</h3>
      <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>تقدر تخلّي القايمة اللي على الجنب بلون غير الأرضية.</p>
      <div id="mkSdP" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SDP.map((p) => chip(p[0], p[1], p[0] === o.side, () => set(null, null, p[0]), p[0] || 'linear-gradient(135deg,#fff 50%,#0e1114 50%)'))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginTop: 12 }}>
        لون براحتك{' '}
        <input type="color" id="mkSdC" value={o.side || '#0B1650'} onChange={(e) => set(null, null, e.target.value)} style={{ width: 54, height: 38, padding: 2, borderRadius: 10, cursor: 'pointer' }} />
      </label>
      <style>{'#mkBgP button.on,#mkSdP button.on{border-color:#FFBE0B!important;box-shadow:0 0 0 3px rgba(255,190,11,.3)}'}</style>
    </div>
  );
}
