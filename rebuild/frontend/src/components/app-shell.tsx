'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { ThemeSettings } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { darken, fontStack, mix, rgba, textOn } from '@/lib/format';
import { useMe, useSettings } from '@/lib/queries';
import { Icon, type IconName } from './icon';
import { ModalHost, useModal } from './modals/modal-host';
import { ErrorBox, Loading } from './ui/states';

interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: IconName | string;
  adminOnly?: boolean;
  staffOnly?: boolean;
  mobile?: boolean;
}

/** Same groups, names, order and icons as the old sidebar. */
const MAIN: NavItem[] = [
  { href: '/', label: 'لوحة التحكم', short: 'الرئيسية', icon: 'grid', mobile: true },
  { href: '/products', label: 'المنتجات والمخزون', short: 'المخزون', icon: 'box', adminOnly: true, mobile: true },
  { href: '/count', label: 'الجرد', icon: '🧮', adminOnly: true },
  { href: '/purchases', label: 'المشتريات', icon: 'down', mobile: true },
  { href: '/daybook', label: 'يومية المحل', icon: '📒' },
  { href: '/sales', label: 'المبيعات', icon: 'up', mobile: true },
  { href: '/returns', label: 'المرتجعات', icon: 'return', adminOnly: true, mobile: true },
  { href: '/contacts', label: 'العملاء والموردون', icon: 'users', adminOnly: true },
  { href: '/cash', label: 'الخزنة والمصروفات', icon: 'wallet', adminOnly: true },
  { href: '/reports', label: 'التقارير', icon: 'chart', adminOnly: true, mobile: true },
];
/** The old bottom bar's own order (sales before purchases, unlike the sidebar). */
const MOBILE_ORDER = ['/', '/products', '/sales', '/purchases', '/returns', '/reports', '/settings', '/account'];
const SYSTEM: NavItem[] = [
  { href: '/theme', label: 'المظهر والتخصيص', icon: 'palette', adminOnly: true },
  { href: '/settings', label: 'الإدارة والإعدادات', short: 'الإدارة', icon: 'gear', adminOnly: true, mobile: true },
  { href: '/account', label: 'حسابي', icon: '👤', staffOnly: true, mobile: true },
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
  const T = settings.data?.theme;
  useApplyTheme(T);

  if (me.isPending) return <Loading />;
  if (me.isError) return <ErrorBox message={errorMessage(me.error)} onRetry={() => me.refetch()} />;

  const admin = me.data.role === 'ADMIN';
  const allowed = (i: NavItem) => (!i.adminOnly || admin) && (!i.staffOnly || !admin);
  const main = MAIN.filter(allowed);
  const system = SYSTEM.filter(allowed);
  const mobile = [...main, ...system]
    .filter((i) => i.mobile)
    .sort((a, b) => MOBILE_ORDER.indexOf(a.href) - MOBILE_ORDER.indexOf(b.href));

  return (
    <div className="app">
      {T && <BackgroundLayer T={T} />}
      <header className="top">
        <div className="brand">
          {T?.logoHeader && T.logo && <img src={T.logo} alt="" />}
          <div>
            ميكانيزم <span>| MEKANIZM</span>
          </div>
        </div>
        <div className="top-actions">
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
        </div>
      </header>
      <div className="layout">
        <aside>
          <div className="nav-title">الرئيسية</div>
          <nav className="nav">
            {main.map((i) => (
              <Link key={i.href} href={i.href} className={isActive(pathname, i.href) ? 'active' : ''}>
                <NavIcon icon={i.icon} /> <span>{i.label}</span>
              </Link>
            ))}
          </nav>
          <div className="nav-title">النظام</div>
          <nav className="nav">
            {system.map((i) => (
              <Link key={i.href} href={i.href} className={isActive(pathname, i.href) ? 'active' : ''}>
                <NavIcon icon={i.icon} /> <span>{i.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
      <button type="button" className="fab" onClick={() => open({ kind: 'quick' })} aria-label="إضافة عملية">
        <Icon name="plus" />
      </button>
      <nav className="mobile-nav">
        {mobile.map((i) => (
          <Link key={i.href} href={i.href} className={isActive(pathname, i.href) ? 'active' : ''}>
            <NavIcon icon={i.icon} />
            <span>{i.short ?? i.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
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
