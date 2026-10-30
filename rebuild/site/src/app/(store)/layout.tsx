import { Suspense, type ReactNode } from 'react';
import { Chrome } from '@/components/chrome';
import { ShopProvider } from '@/components/shop-provider';
import { getSite, getStock } from '@/lib/catalog';

export const revalidate = 300;

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [site, stock] = await Promise.all([getSite(), getStock()]);
  const accent = /^#[0-9a-f]{3,8}$/i.test(site.theme.accent ?? '') ? site.theme.accent : '';
  return (
    <ShopProvider site={site} stock={stock}>
      {accent && <style>{`:root{--accent:${accent}}`}</style>}
      <a className="skip" href="#prods0">تخطّي للمنتجات</a>
      {children}
      <Suspense fallback={null}><Chrome /></Suspense>
    </ShopProvider>
  );
}
