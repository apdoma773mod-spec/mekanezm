import { Suspense, type ReactNode } from 'react';
import { Chrome } from '@/components/chrome';
import { ShopProvider } from '@/components/shop-provider';
import { TopBar } from '@/components/topbar';
import { getSettings } from '@/lib/catalog';
import { chosenWood, cssVars, woodAreas, woodCss } from '@/lib/theme';

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  // Colors and wood chosen by the owner in /admin; only valid values are used (see lib/theme.ts).
  const theme = site.theme as Record<string, unknown>;
  const vars = cssVars(theme);
  const w = chosenWood(theme);
  const wood = w ? woodCss(w, woodAreas(theme)) : '';
  return (
    <ShopProvider site={site}>
      {(vars || wood) && <style>{`${vars ? `:root{${vars}}` : ''}${wood}`}</style>}
      <a className="skip" href="#main">تخطّي للمحتوى</a>
      <Suspense fallback={<div className="tb" />}><TopBar /></Suspense>
      {children}
      <Suspense fallback={null}><Chrome /></Suspense>
    </ShopProvider>
  );
}
