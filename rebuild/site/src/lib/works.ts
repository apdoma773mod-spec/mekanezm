// «من شغلنا»: the works the owner adds in the system (title, description, photos). Any product code written
// in the description (e.g. «1248» or «كود P0339») links that product to the work, and back.
import type { Product, Site } from './schema';

const tokens = (s: string) => new Set(String(s || '').toUpperCase().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).split(/[^A-Z0-9]+/).filter(Boolean));

export function worksWithProducts(site: Pick<Site, 'works' | 'products'>) {
  const byCode = new Map(site.products.filter(p => p.code).map(p => [p.code.toUpperCase(), p]));
  return site.works.filter(w => w.imgs.length).map((w, i) => {
    const t = tokens(`${w.title} ${w.desc}`);
    const used = [...t].map(c => byCode.get(c)).filter((p): p is Product => !!p);
    // Hide the codes from the text shown to customers when they are on their own line like «المنتجات: 1248, P0339».
    const desc = w.desc.split('\n').filter(l => !/^\s*(المنتجات|الأكواد|الاكواد)\s*[:：]/.test(l)).join('\n').trim();
    return { i, title: w.title, desc, imgs: w.imgs, used };
  });
}

export const worksUsing = (site: Pick<Site, 'works' | 'products'>, p: Product) => worksWithProducts(site).filter(w => w.used.some(u => u.id === p.id));
