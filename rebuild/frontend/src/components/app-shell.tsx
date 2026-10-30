'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import type { ThemeSettings } from '@mk/shared';
import { I } from '@/legacy/pro-art';
import { errorMessage } from '@/lib/api';
import { darken, fontStack, mix, rgba, textOn } from '@/lib/format';
import { useLogout, useMe, useSettings } from '@/lib/queries';
import { useInboxCounts } from '@/lib/inbox-queries';
import { useWebOrderCount } from '@/lib/web-queries';
import { BgFx, NotifyBar, MkMini, pageIdOf, proOn, ProIcon, ProLogo, Ticker, useProBody } from './pro';
import { Icon, type IconName } from './icon';
import { ModalHost, useModal } from './modals/modal-host';
import { ErrorBox, Loading } from './ui/states';
import { PunchCatcher } from './punch-catcher';

interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: IconName | string;
  adminOnly?: boolean;
  staffOnly?: boolean;
  mobile?: boolean;
  /** The old sidebar named some screens differently for staff (e.g. «حضوري»). */
  staffLabel?: string;
  /** «ميكانيزم برو» icon key when it differs from the page id. */
  pro?: string;
  /** Live count shown as a badge (the inbox screens). */
  badge?: 'sms' | 'waOrders' | 'waPhotos' | 'web';
}

/** Same groups, names, order and icons as the old sidebar. */
const MAIN: NavItem[] = [
  { href: '/', label: 'لوحة التحكم', short: 'الرئيسية', icon: 'grid', mobile: true },
  { href: '/products', label: 'المنتجات والمخزون', short: 'المخزون', icon: 'box', adminOnly: true, mobile: true },
  { href: '/count', label: 'الجرد', icon: '🧮', adminOnly: true },
  { href: '/purchases', label: 'المشتريات', icon: 'down', mobile: true },
  // Order read from the old system as it runs today (2026-10-29), after «ميكانيزم برو» moved the work screens.
  // «فلوس فودافون كاش» is not in the old sidebar: it opens from the top alerts bar.
  { href: '/daybook', label: 'يومية المحل', icon: '📒' },
  { href: '/transfers', label: 'تحويلات الواتساب', icon: '🖼', adminOnly: true, badge: 'waPhotos', pro: 'tf' },
  { href: '/work?k=ord', label: 'أنظمة الشغل', icon: '🛠', adminOnly: true, pro: 'mkSideWk' },
  { href: '/work?k=steel', label: 'حاسبة الاستانلس', icon: '🔩', adminOnly: true, pro: 'mkSideSt' },
  { href: '/work?k=forf', label: 'عود الفرفورجيه', icon: '🔥', adminOnly: true, pro: 'mkSideFf' },
  { href: '/sales', label: 'المبيعات', icon: 'up', mobile: true },
  { href: '/weborders', label: 'طلبات الموقع', icon: 'file', adminOnly: true, badge: 'web' },
  { href: '/site-content', label: 'محتوى الموقع', icon: '🌐', adminOnly: true },
  { href: '/quotes', label: 'عروض الأسعار', icon: '📝' },
  { href: '/waorders', label: 'طلبات الواتساب', icon: '💬', adminOnly: true, badge: 'waOrders' },
  { href: '/shipping', label: 'الشحن والتوصيل', icon: '🚚' },
  { href: '/returns', label: 'المرتجعات', icon: 'return', adminOnly: true, mobile: true },
  { href: '/contacts', label: 'العملاء والموردين', icon: 'users', adminOnly: true },
  { href: '/debts', label: 'الديون والتذكير', icon: '💰', adminOnly: true },
  { href: '/reorder', label: 'اقتراحات الطلب', icon: '📦', adminOnly: true },
  { href: '/cash', label: 'الخزنة والمصروفات', icon: 'wallet', adminOnly: true },
  { href: '/reports', label: 'التقارير', icon: 'chart', adminOnly: true, mobile: true },
  { href: '/staff', label: 'العمالة والمرتبات', staffLabel: 'حضوري', icon: '👷' },
  { href: '/kits', label: 'الأطقم والتركيبات', icon: '🧩', adminOnly: true },
  { href: '/terms', label: 'أسعار وحدود العملاء', icon: '🏷️', adminOnly: true, pro: 'custTerms' },
  { href: '/samples', label: 'العينات', icon: '🧪' },
];
/** The old bottom bar's own order (sales before purchases, unlike the sidebar). */
const MOBILE_ORDER = ['/', '/products', '/sales', '/purchases', '/returns', '/reports', '/hy', '/settings', '/account'];
/** «الشركات» at the bottom of the sidebar, as the old one. */
/** The old side-items script appended bamboo, display goods and offcuts to the last group (الشركات). */
const COMPANIES: NavItem[] = [
  { href: '/hy', label: 'هيدرولك', icon: '🏢', mobile: true },
  { href: '/work?k=bamboo', label: 'بامبو', icon: '🎍', adminOnly: true },
  { href: '/work?k=disp', label: 'بضاعة العرض', icon: '🏬', adminOnly: true },
  { href: '/work?k=off', label: 'الفضل', icon: '🧰', adminOnly: true },
  { href: '/keywords', label: 'كلمات الواتساب المفتاحية', icon: '🔑', adminOnly: true, pro: 'mkSideKw' },
  { href: '/biz', label: 'تحليلات ذكية', icon: '📈', adminOnly: true },
];
const SYSTEM: NavItem[] = [{ href: '/account', label: 'حسابي', icon: '👤', staffOnly: true, mobile: true }];
/** «الإعدادات والخروج»: «ميكانيزم برو» moved theme, settings and logout to the end of the sidebar. */
const END: NavItem[] = [
  { href: '/theme', label: 'المظهر والتخصيص', icon: 'palette', adminOnly: true },
  { href: '/settings', label: 'الإدارة والإعدادات', short: 'الإدارة', icon: 'gear', adminOnly: true, mobile: true },
];

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  return icon.length <= 2 ? <span style={{ fontSize: 18 }}>{icon}</span> : <Icon name={icon as IconName} />;
}

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/** Same variables the old applyTheme() set, from the saved theme. */
function useApplyTheme(T: ThemeSettings | undefined) {
  useEffect(() => {
    if (!T) return;
    const r = document.documentElement.style;
    r.setProperty('--topgap', `${T.topGap}px`);
    r.setProperty('--blue', T.primary);
    r.setProperty('--blue2', darken(T.primary, 0.75));
    r.setProperty('--gold', T.accent);
    r.setProperty('--bg', T.bg);
    r.setProperty('--text', T.text);
    r.setProperty('--tint', mix(T.primary, 0.12));
    r.setProperty('--tint2', mix(T.primary, 0.06));
    r.setProperty('--tintb', mix(T.primary, 0.25));
    r.setProperty('--ring', rgba(T.primary, 0.12));
    r.setProperty('--onblue', textOn(T.primary));
    r.setProperty('--onaccent', textOn(T.accent));
    r.setProperty('--font', fontStack(T.font));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', T.primary);
  }, [T]);
}

/** Background image in its own fixed layer, as the old system did for iPhone scrolling speed. */
function BackgroundLayer({ T }: { T: ThemeSettings }) {
  if (!T.bgImg) return null;
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -2,
          pointerEvents: 'none',
          backgroundImage: `url(${T.bgImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', background: T.bg, opacity: 1 - T.bgClarity / 100 }} />
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const settings = useSettings();
  const { open } = useModal();
  const router = useRouter();
  const counts = useInboxCounts(!!me.data && me.data.role === 'ADMIN');
  const webCount = useWebOrderCount(!!me.data && me.data.role === 'ADMIN');
  const logout = useLogout();
  const T = settings.data?.theme;
  useApplyTheme(T);
  const [pro, setPro] = useState(false);
  useEffect(() => setPro(proOn()), []);
  // the old body.emp: staff get the same trimmed screen and an orange user button
  const role = me.data?.role;
  useEffect(() => {
    if (role) document.body.classList.toggle('emp', role !== 'ADMIN');
  }, [role]);

  if (me.isPending) return <Loading />;
  if (me.isError) return <ErrorBox message={errorMessage(me.error)} onRetry={() => me.refetch()} />;

  const admin = me.data.role === 'ADMIN';
  const allowed = (i: NavItem) => (!i.adminOnly || admin) && (!i.staffOnly || !admin);
  const main = MAIN.filter(allowed);
  const system = SYSTEM.filter(allowed);
  const companies = COMPANIES.filter(allowed);
  const end = END.filter(allowed);
  const mobile = [...main, ...system, ...companies, ...end]
    .filter((i) => i.mobile)
    .sort((a, b) => MOBILE_ORDER.indexOf(a.href) - MOBILE_ORDER.indexOf(b.href));
  const navClose = () => document.body.classList.remove('navon');
  const navBtn = (
    <button
      type="button"
      id="navBtn"
      aria-label="القايمة"
      onClick={(e) => {
        e.stopPropagation();
        document.body.classList.add('navon');
      }}
    >
      ☰
    </button>
  );
  const item = (i: NavItem, short?: boolean) => {
    const k = i.pro ?? pageIdOf(i.href.split('?')[0]);
    return (
      <Link
        key={i.href}
        href={i.href}
        data-page={k}
        className={isActive(pathname, i.href) ? 'active' : ''}
        onClick={(e) => {
          navClose();
          // like the old system, «العملاء والموردين» opens a chooser: customers or suppliers
          if (i.href === '/contacts') {
            e.preventDefault();
            open({ kind: 'ctChooser' });
          }
          // «محتوى الموقع» is a window, not a page
          if (i.href === '/site-content') {
            e.preventDefault();
            open({ kind: 'siteAdmin' });
          }
        }}
      >
        {pro && I[k] ? <ProIcon k={k} /> : <NavIcon icon={i.icon} />} {short ? null : ' '}
        <span>{short ? (i.short ?? i.label) : !admin && i.staffLabel ? i.staffLabel : i.label}</span>
        {i.badge === 'web' ? webCount.data ? <span className="badge">{webCount.data}</span> : null : i.badge && counts.data?.[i.badge] ? <span className="badge">{counts.data[i.badge]}</span> : null}
      </Link>
    );
  };

  return (
    <div className="app">
      {T && <BackgroundLayer T={T} />}
      {pro && <BgFx />}
      <Suspense fallback={null}>
        <ProBody />
      </Suspense>
      {admin && <NotifyBar waPhotos={counts.data?.waPhotos ?? 0} sms={counts.data?.sms ?? 0} />}
      <PunchCatcher />
      <header className="top">
        <div className="brand">
          {!pro && navBtn}
          {T?.logoHeader && T.logo && <img src={T.logo} alt="" />}
          <div>
            ميكانيزم <span>| MEKANIZM</span>
          </div>
          {pro && <ProLogo />}
        </div>
        <div className="top-actions">
          {pro && navBtn}
          <button
            type="button"
            className="icon-btn"
            id="whoBtn"
            title="خروج / تبديل المستخدم"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
          >
            👤 {me.data.name} — خروج
          </button>
          <button type="button" className="icon-btn" onClick={() => open({ kind: 'quick' })} title="إضافة" aria-label="إضافة">
            <Icon name="plus" />
          </button>
          {admin ? (
            <>
              <Link className="icon-btn" href="/theme" title="المظهر" aria-label="المظهر">
                <Icon name="palette" />
              </Link>
              <Link className="icon-btn" href="/settings" title="الإدارة" aria-label="الإدارة">
                <Icon name="gear" />
              </Link>
            </>
          ) : (
            <Link className="icon-btn" href="/account" title="حسابي" aria-label="حسابي">
              👤
            </Link>
          )}
          {pro && <Ticker />}
          {pro && <MkMini />}
        </div>
      </header>
      <div className="layout">
        <aside>
          <div className="navhd">
            <span>ميكانيزم</span>
            <button type="button" id="navX" aria-label="قفل" onClick={navClose}>
              ✕
            </button>
          </div>
          <div className="nav-title">الرئيسية</div>
          <nav className="nav">{main.map((i) => item(i))}</nav>
          {system.length > 0 && (
            <>
              <div className="nav-title">النظام</div>
              <nav className="nav">{system.map((i) => item(i))}</nav>
            </>
          )}
          <div className="nav-title" style={{ marginTop: 16 }}>
            الشركات
          </div>
          <nav className="nav">{companies.map((i) => item(i))}</nav>
          <div className="nav-title" id="mkNavEndT">
            الإعدادات والخروج
          </div>
          <nav className="nav" id="mkNavEnd">
            {end.map((i) => item(i))}
            <button
              type="button"
              className="own"
              id="outBtn"
              style={{ color: '#c0392b' }}
              disabled={logout.isPending}
              onClick={(e) => {
                e.stopPropagation();
                navClose();
                logout.mutate(undefined, { onSettled: () => router.replace('/login') });
              }}
            >
              {pro ? <ProIcon k="logout" /> : <span style={{ width: '1.15em', textAlign: 'center' }}>🚪</span>} <span>تسجيل الخروج</span>
            </button>
          </nav>
        </aside>
        <main>
          <section id={pageIdOf(pathname)} className="page active">
            {children}
          </section>
        </main>
      </div>
      <div id="navBg" onClick={navClose} />
      <button type="button" className="fab" onClick={() => open({ kind: 'quick' })} aria-label="إضافة عملية">
        <Icon name="plus" />
      </button>
      <nav className="mobile-nav">{mobile.map((i) => item(i, true))}</nav>
    </div>
  );
}

/** Keeps the old body classes (screen color, dark ground, sticky header) in step with the route. */
function ProBody() {
  const pathname = usePathname();
  const k = useSearchParams().get('k');
  useProBody(pageIdOf(pathname, k));
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ModalHost>
      <Shell>{children}</Shell>
    </ModalHost>
  );
}

/** Client-side guard for admin screens; the API refuses staff anyway. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.data && me.data.role !== 'ADMIN') return <ErrorBox message="الشاشة دي للمدير بس" />;
  return <>{children}</>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="title-row">
      <div className="title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
