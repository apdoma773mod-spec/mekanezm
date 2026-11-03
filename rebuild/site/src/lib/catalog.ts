// Reading the shop's catalog. This file (with api.ts for writes) is the only place that knows
// where data comes from: to move to the new backend, change these functions and nothing else.
import 'server-only';
import { cache } from 'react';
import { REVALIDATE, SB_KEY, SB_URL } from './config';
import { siteSchema, type Product, type Settings, type Site, type Stock } from './schema';
import { queryProducts, stockOk, withCover, type Sort } from './shop';

const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

const EMPTY: Site = siteSchema.parse({});

/** NEXT_PUBLIC_NEW_BACKEND=1 reads the catalog/stock from the new backend instead of Supabase. */
const NEW = process.env.NEXT_PUBLIC_NEW_BACKEND === '1';
const nbUrl = (path: string) => `${(process.env.BACKEND_URL ?? '').replace(/\/$/, '')}/api/v1/web/public/${path}`;
const nbHeaders = { 'ngrok-skip-browser-warning': '1' };
// Last good copies, so a short backend outage doesn't empty the shop.
let lastSite: unknown = null;
let lastStock: Stock | null = null;

async function readSiteData(): Promise<unknown> {
  if (NEW) {
    try {
      const r = await fetch(nbUrl('site'), { headers: nbHeaders, next: { revalidate: REVALIDATE, tags: ['site'] }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`site ${r.status}`);
      const j = (await r.json()) as { site?: { data?: unknown } };
      if (!j?.site?.data) throw new Error('site empty');
      return (lastSite = j.site.data);
    } catch (e) {
      if (lastSite) { console.error('getSite: backend down, using last copy', e); return lastSite; }
      throw e;
    }
  }
  const r = await fetch(`${SB_URL}/rest/v1/site_content?id=eq.main&select=data`, {
    headers,
    next: { revalidate: REVALIDATE, tags: ['site'] },
  });
  if (!r.ok) throw new Error(`site_content ${r.status}`);
  return ((await r.json()) as { data: unknown }[])[0]?.data ?? {};
}

/** The whole public shop content (name, phones, sections, products…). Cache tag `site`. */
export const getSite = cache(async (): Promise<Site> => {
  try {
    const s = siteSchema.parse(await readSiteData());
    s.pros = s.pros.filter(x => !x.hidden && x.name.trim() && x.phone.trim());
    const today = new Date().toISOString().slice(0, 10);
    s.products = s.products.filter(p => !p.hidden && !(p.from && today < p.from) && !(p.until && today > p.until)).map(withCover);
    return s;
  } catch (e) {
    console.error('getSite failed', e);
    return EMPTY;
  }
});

/** Live stock from the system: product code → available. Cache tag `stock`. */
export const getStock = cache(async (): Promise<Stock> => {
  if (NEW) {
    try {
      const r = await fetch(nbUrl('stock'), { headers: nbHeaders, next: { revalidate: 60, tags: ['stock'] }, signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      if (r.ok && j && typeof j === 'object' && !Array.isArray(j)) return (lastStock = j as Stock);
    } catch { /* fall through to the last copy */ }
    return lastStock ?? {};
  }
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
