// Reading the shop's catalog. This file (with api.ts for writes) is the only place that knows
// where data comes from: to move to the new backend, change these functions and nothing else.
import 'server-only';
import { cache } from 'react';
import { REVALIDATE, SB_KEY, SB_URL } from './config';
import { siteSchema, type Product, type Site, type Stock } from './schema';
import { withCover } from './shop';

const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

const EMPTY: Site = siteSchema.parse({});

/** The whole public shop content (name, phones, sections, products…). */
export const getSite = cache(async (): Promise<Site> => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/site_content?id=eq.main&select=data`, {
      headers,
      next: { revalidate: REVALIDATE, tags: ['site'] },
    });
    if (!r.ok) throw new Error(`site_content ${r.status}`);
    const rows = (await r.json()) as { data: unknown }[];
    const s = siteSchema.parse(rows[0]?.data ?? {});
    s.products = s.products.map(withCover);
    return s;
  } catch (e) {
    console.error('getSite failed', e);
    return EMPTY;
  }
});

/** Live stock from the system: product code → available. */
export const getStock = cache(async (): Promise<Stock> => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/site_stock`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      next: { revalidate: 60, tags: ['stock'] },
    });
    const j = await r.json();
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Stock) : {};
  } catch {
    return {};
  }
});

export async function getProduct(id: string): Promise<{ site: Site; product: Product } | null> {
  const site = await getSite();
  const product = site.products.find(p => p.id === id);
  return product ? { site, product } : null;
}
