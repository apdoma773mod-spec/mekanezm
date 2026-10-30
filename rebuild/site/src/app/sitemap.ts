import type { MetadataRoute } from 'next';
import { getSite } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { productPath } from '@/lib/shop';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const now = new Date();
  return [
    { url: SITE_URL + '/', lastModified: now, priority: 1 },
    { url: SITE_URL + '/custom', lastModified: now },
    ...['steel', 'bamboo', 'delf'].map(k => ({ url: `${SITE_URL}/custom?k=${k}`, lastModified: now })),
    ...site.products.map(p => ({ url: SITE_URL + productPath(p.id), lastModified: now, priority: 0.8 })),
  ];
}
