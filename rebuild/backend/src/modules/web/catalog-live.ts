import type { PrismaClient } from '@prisma/client';
import { buildFlipbook, buildProCatalog, mergeCfg, type CatCfg, type CatInput, type CatProduct } from '@mk/shared/catalog-pro';

/**
 * 📖 الكتالوج «الحي»: السيرفر بيبنيه بنفسه من آخر إعدادات اتحفظت (catalogCfg) وآخر بيانات المنتجات —
 * نفس اللي شاشة الكتالوج بتعمله بالظبط. كده:
 *  - أي تعديل في شكل الكتالوج يوصل فورًا (مش مستني الشاشة تتحدّث على Vercel)
 *  - الكتالوج اللي على الموقع دايمًا محدّث (توفر، منتجات جديدة، صور) من غير «انشره» كل مرة
 */
const NEW_MS = 45 * 864e5;
type SiteProduct = { code?: string; name?: string; desc?: string; imgs?: string[]; sec?: string; top?: boolean; video?: string; dimImg?: string };
type SiteData = { products?: SiteProduct[]; sections?: { id: string; name: string }[]; phones?: string[]; tagline?: string; address?: string; catalogCfg?: Partial<CatCfg> };

export async function liveCatalogInput(db: PrismaClient): Promise<CatInput> {
  const doc = (await db.setting.findUnique({ where: { key: 'site_content' } }))?.value as { data?: SiteData } | null;
  const data: SiteData = doc?.data ?? {};
  const cfg = mergeCfg(data.catalogCfg);
  const prods = await db.product.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true, category: true, qty: true, unit: true, createdAt: true } });
  const byCode = new Map(prods.map((p) => [p.code, p]));
  const top = new Set((data.products ?? []).filter((p) => p.top).map((p) => String(p.code)));
  let products: CatProduct[];
  if (cfg.source === 'stock') {
    const infos = new Map((await db.productInfo.findMany()).map((i) => [i.productId, i]));
    const siteBy = new Map((data.products ?? []).map((p) => [String(p.code), p]));
    products = prods
      .map((p) => {
        const inf = infos.get(p.id);
        const sp = siteBy.get(p.code);
        const infImgs = Array.isArray(inf?.imgs) ? (inf!.imgs as string[]) : [];
        const imgs = infImgs.length ? infImgs : sp?.imgs ?? [];
        return {
          code: p.code,
          name: sp?.name || p.name,
          desc: [sp?.desc || inf?.descr || '', inf?.specs || ''].filter(Boolean).join('\n'),
          imgs,
          dimImg: String(sp?.dimImg ?? ''),
          section: p.category || 'منتجات متنوعة',
          inStock: Number(p.qty) > 0,
          featured: top.has(p.code),
          isNew: Date.now() - p.createdAt.getTime() < NEW_MS,
          brand: inf?.brand || '',
          size: inf?.size || '',
          finish: inf?.finish || '',
          unit: p.unit,
        } satisfies CatProduct;
      })
      .filter((p) => p.imgs.length);
  } else {
    const secName = Object.fromEntries((data.sections ?? []).map((s) => [s.id, s.name]));
    products = (data.products ?? [])
      .filter((p) => p.imgs?.length)
      .map((p) => {
        const sp = byCode.get(String(p.code));
        return {
          code: String(p.code || ''),
          name: p.name || String(p.code),
          desc: p.desc,
          imgs: p.imgs ?? [],
          dimImg: String(p.dimImg ?? ''),
          section: secName[p.sec ?? ''] ?? '',
          inStock: Number(sp?.qty ?? 0) > 0,
          featured: !!p.top,
          isNew: sp ? Date.now() - sp.createdAt.getTime() < NEW_MS : false,
          video: p.video,
        } satisfies CatProduct;
      });
  }
  return { shop: 'ميكانيزم', tagline: String(data.tagline ?? ''), phones: data.phones ?? [], address: String(data.address ?? ''), cfg: { ...cfg, gift: undefined }, products };
}

/** كاش دقيقة: الكتالوج بيتبني مرة في الدقيقة على الأكتر مهما اتفتح */
let cache: { at: number; book: string; print: string } | null = null;
export async function liveCatalog(db: PrismaClient, kind: 'book' | 'print', urls: { pdfUrl: string; hitUrl: string }): Promise<string> {
  if (!cache || Date.now() - cache.at > 60_000) {
    const inp = await liveCatalogInput(db);
    cache = { at: Date.now(), book: buildFlipbook(inp, { pdfUrl: '__PDF__', hitUrl: '__HIT__' }), print: buildProCatalog(inp, { autoPrint: true }) };
  }
  return (kind === 'book' ? cache.book : cache.print).replaceAll('__PDF__', urls.pdfUrl).replaceAll('__HIT__', urls.hitUrl);
}
/** بعد أي حفظ لإعدادات الكتالوج أو الموقع: يتبني من جديد في الفتحة الجاية */
export const dropLiveCatalog = () => void (cache = null);
