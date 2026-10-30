import { Suspense, type ReactNode } from 'react';
import { Chrome } from '@/components/chrome';
import { ShopProvider } from '@/components/shop-provider';
import { TopBar } from '@/components/topbar';
import { getSettings } from '@/lib/catalog';

export const revalidate = 300;

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const site = await getSettings();
  const accent = /^#[0-9a-f]{3,8}$/i.test(site.theme.accent ?? '') ? site.theme.accent : '';
  return (
    <ShopProvider site={site}>
      {accent && <style>{`:root{--accent:${accent}}`}</style>}
      <a className="skip" href="#main">تخطّي للمحتوى</a>
      <Suspense fallback={<div className="tb" />}><TopBar /></Suspense>
      {children}
      <Suspense fallback={null}><Chrome /></Suspense>
    </ShopProvider>
  );
}
