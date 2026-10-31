// Reading the shop's catalog. This file (with api.ts for writes) is the only place that knows
// where data comes from: to move to the new backend, change these functions and nothing else.
import 'server-only';
import { cache } from 'react';
import { REVALIDATE, SB_KEY, SB_URL } from './config';
import { siteSchema, type Product, type Settings, type Site, type Stock } from './schema';
import { queryProducts, stockOk, withCover, type Sort } from './shop';

const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

const EMPTY: Site = siteSchema.parse({});

/** The whole public shop content (name, phones, sections, products…). Cache tag `site`. */
export const getSite = cache(async (): Promise<Site> => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/site_content?id=eq.main&select=data`, {
      headers,
      next: { revalidate: REVALIDATE, tags: ['site'] },
    });
    if (!r.ok) throw new Error(`site_content ${r.status}`);
    const rows = (await r.json()) as { data: unknown }[];
    const s = siteSchema.parse(rows[0]?.data ?? {});
    s.products = s.products.filter(p => !p.hidden).map(withCover);
    return s;
  } catch (e) {
    console.error('getSite failed', e);
    return EMPTY;
  }
});

/** Live stock from the system: product code → available. Cache tag `stock`. */
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

const FRESH = 12;

/** Catalog + availability and «new» checks, for server components. */
export const getCatalog = cache(async () => {
  const [site, stock] = await Promise.all([getSite(), getStock()]);
  const ok = (p: Product) => stockOk(p, stock);
  // The newest products (end of the list) get a «جديد» badge — only once the catalog is big enough to mean something.
  const freshIds = new Set(site.products.length > FRESH * 2 ? site.products.slice(-FRESH).map(p => p.id) : []);
  const fresh = (p: Product) => freshIds.has(p.id);
  return { site, ok, fresh };
});

/** Everything except the product list, plus how many products each section has. */
export const getSettings = cache(async (): Promise<Settings> => {
  const { products, ...rest } = await getSite();
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.sec] = (counts[p.sec] ?? 0) + 1;
  return { ...rest, counts };
});

export async function getProduct(id: string) {
  const { site, ok } = await getCatalog();
  const product = site.products.find(p => p.id === id);
  return product ? { site, product, ok } : null;
}

export const PAGE = 20;

/** One page of products for a section / search (page 2 = products 21–40). */
export async function listProducts(o: { sec?: string; q?: string; sort?: Sort; av?: boolean; f?: string; page?: number }) {
  const { site, ok, fresh } = await getCatalog();
  const all = queryProducts(site.products, ok, o);
  const pages = Math.max(1, Math.ceil(all.length / PAGE)), page = Math.min(pages, Math.max(1, o.page ?? 1));
  return { total: all.length, page, pages, items: all.slice((page - 1) * PAGE, page * PAGE).map(p => ({ p, ok: ok(p), fresh: fresh(p) })) };
}
