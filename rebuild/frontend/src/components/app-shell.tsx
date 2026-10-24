'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { PublicUser, ThemeSettings } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { hexToRgbChannels, ROLE_LABELS } from '@/lib/format';
import { useLogout, useMe, useSettings } from '@/lib/queries';
import { ErrorState, LoadingState } from './ui/states';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'الرئيسية', icon: '🏠' },
  { href: '/users', label: 'المستخدمين', icon: '👥', adminOnly: true },
  { href: '/audit', label: 'سجل العمليات', icon: '📜', adminOnly: true },
  { href: '/settings', label: 'الإعدادات', icon: '⚙️', adminOnly: true },
  { href: '/account', label: 'حسابي', icon: '👤' },
];

function useApplyTheme(theme: ThemeSettings | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', hexToRgbChannels(theme.primary));
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      root.classList.toggle('dark', theme.mode === 'dark' || (theme.mode === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

function Sidebar({ user, items, storeName }: { user: PublicUser; items: NavItem[]; storeName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-border bg-surface p-4 lg:flex">
      <p className="mb-6 truncate px-2 text-2xl font-bold text-primary">{storeName}</p>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-bold ${isActive(pathname, i.href) ? 'bg-primary text-on-primary' : 'hover:bg-muted'}`}
          >
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border pt-4">
        <p className="truncate px-2 font-bold">{user.name}</p>
        <p className="mb-3 px-2 text-sm text-subtle">{ROLE_LABELS[user.role]}</p>
        <button
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
          disabled={logout.isPending}
          className="min-h-11 w-full rounded-xl bg-muted font-bold hover:bg-border"
        >
          تسجيل خروج
        </button>
      </div>
    </aside>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${isActive(pathname, i.href) ? 'text-primary' : 'text-subtle'}`}
        >
          <span aria-hidden className="text-xl">
            {i.icon}
          </span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const settings = useSettings();
  useApplyTheme(settings.data?.theme);

  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <div className="p-4">
        <ErrorState message={errorMessage(me.error)} onRetry={() => me.refetch()} />
      </div>
    );
  }

  const items = NAV.filter((i) => !i.adminOnly || me.data.role === 'ADMIN');
  return (
    <div className="flex min-h-dvh">
      <Sidebar user={me.data} items={items} storeName={settings.data?.store.name ?? 'ميكانيزم'} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">{children}</main>
      <BottomNav items={items} />
    </div>
  );
}

/** Client-side guard for admin screens; the API refuses staff anyway. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.data && me.data.role !== 'ADMIN') {
    return <ErrorState message="الشاشة دي للمدير بس" />;
  }
  return <>{children}</>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-subtle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
