import type { MetadataRoute } from 'next';
import { getSite } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { images, productPath, sectionPath } from '@/lib/shop';

export const revalidate = 3600;

const abs = (u: string) => (/^https?:/.test(u) ? u : SITE_URL + u);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const now = new Date();
  const withProducts = new Set(site.products.map(p => p.sec));
  return [
    { url: SITE_URL + '/', lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: SITE_URL + '/search', lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ...site.sections.filter(s => withProducts.has(s.id)).map(s => ({ url: SITE_URL + sectionPath(s.id), lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 })),
    { url: SITE_URL + '/custom', lastModified: now },
    ...['steel', 'bamboo', 'delf'].map(k => ({ url: `${SITE_URL}/custom?k=${k}`, lastModified: now })),
    ...site.products.map(p => ({ url: SITE_URL + productPath(p.id), lastModified: now, priority: 0.8, images: images(p).slice(0, 3).map(abs) })),
  ];
}
