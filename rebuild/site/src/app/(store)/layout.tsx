import { Suspense, type ReactNode } from 'react';
import { Chrome } from '@/components/chrome';
import { ShopProvider } from '@/components/shop-provider';
import { TopBar } from '@/components/topbar';
import { getSettings } from '@/lib/catalog';
import { cssVars } from '@/lib/theme';

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  // Colors chosen by the owner in /admin; only valid hex values are used (see lib/theme.ts).
  const vars = cssVars(site.theme as Record<string, unknown>);
  return (
    <ShopProvider site={site}>
      {vars && <style>{`:root{${vars}}`}</style>}
      <a className="skip" href="#main">تخطّي للمحتوى</a>
      <Suspense fallback={<div className="tb" />}><TopBar /></Suspense>
      {children}
      <Suspense fallback={null}><Chrome /></Suspense>
    </ShopProvider>
  );
}
