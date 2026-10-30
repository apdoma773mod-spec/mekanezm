// Brands are read from product names/descriptions; a brand page exists only when it has products.
import type { Product } from './schema';
import { norm } from './shop';

export type Brand = { slug: string; name: string; re: RegExp; carried?: boolean };
// Add a brand here (Arabic + Latin spellings) and its page appears as soon as a product mentions it.
// carried = a main brand the shop sells; it is listed on /brands even before its products are on the site.
export const BRANDS: Brand[] = [
  { slug: 'wellmax', name: 'ويل ماكس', re: /و[يى]ل ?ماكس|well ?max/i, carried: true },
  { slug: 'blum', name: 'بلوم', re: /بلوم|\bblum\b/i, carried: true },
  { slug: 'grass', name: 'جراس', re: /جراس|\bgrass\b/i, carried: true },
  { slug: 'hettich', name: 'هيتتش', re: /ه[يى]تتش|ه[يى]ت[يى]ش|هتش|hettich/i, carried: true },
  { slug: 'hazard', name: 'هازرد', re: /هازرد|hazard/i },
  { slug: 'star-x', name: 'ستار اكس', re: /ستار ?اكس|star ?x/i },
  { slug: 'hb', name: 'هب', re: /(^|[\s(])هب([\s).،,]|$)|\bhb\b/i },
];

const text = (p: Product) => norm(`${p.name} ${p.desc}`);
export const brandOf = (p: Product) => BRANDS.find(b => b.re.test(p.name)) ?? BRANDS.find(b => b.re.test(text(p)));
export const brandBySlug = (s: string) => BRANDS.find(b => b.slug === s);
export const productsOfBrand = (all: Product[], b: Brand) => all.filter(p => brandOf(p)?.slug === b.slug);
/** Brands that have products, with counts (most first). */
export const activeBrands = (all: Product[]) =>
  BRANDS.map(b => ({ ...b, n: productsOfBrand(all, b).length })).filter(b => b.n > 0).sort((a, b) => b.n - a.n);

/** Main brands with no products on the site yet (shown as «اسأل عليه»). */
export const comingBrands = (all: Product[]) => BRANDS.filter(b => b.carried && !productsOfBrand(all, b).length);
