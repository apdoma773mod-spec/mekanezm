import type { MetadataRoute } from 'next';
import { getSite } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { activeBrands } from '@/lib/brands';
import { proPath } from '@/lib/pros';
import { GUIDES } from '@/lib/guides';
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
    ...['/guide', ...GUIDES.map(g => '/guide/' + g.slug)].map(u => ({ url: SITE_URL + u, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...['/kits', '/kits/kitchen', '/kits/dressing', '/tools', '/tools/lift', '/works', '/brands', ...activeBrands(site.products).map(b => '/brand/' + b.slug)].map(u => ({ url: SITE_URL + u, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...['/pros', '/pros/join', '/help', '/contact', '/policy', '/quick', '/trade', '/about', '/privacy', '/terms'].map(u => ({ url: SITE_URL + u, lastModified: now, priority: 0.5 })),
    ...['steel', 'bamboo', 'delf'].map(k => ({ url: `${SITE_URL}/custom?k=${k}`, lastModified: now })),
    ...site.pros.map(p => ({ url: SITE_URL + proPath(p.id), lastModified: now, priority: 0.5 })),
    ...site.products.map(p => ({ url: SITE_URL + productPath(p.id), lastModified: now, priority: 0.8, images: images(p).slice(0, 3).map(abs) })),
  ];
}
