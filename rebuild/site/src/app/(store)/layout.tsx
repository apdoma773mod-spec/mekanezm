import { Suspense, type ReactNode } from 'react';
import { Chrome } from '@/components/chrome';
import { ShopProvider } from '@/components/shop-provider';
import { TopBar } from '@/components/topbar';
import { getSettings } from '@/lib/catalog';

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  // Colors chosen by the owner in /admin (accent, bg, fg, card); anything that is not a plain hex color is ignored.
  const vars = (['accent', 'bg', 'fg', 'card'] as const)
    .map(k => [k, String((site.theme as Record<string, unknown>)[k] ?? '')] as const)
    .filter(([, v]) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)).map(([k, v]) => `--${k}:${v}`).join(';');
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
