// «سوق الفضلة»: carpenters list offcuts (boards, solid wood, aluminium) and search each other's by size.
// Pure helpers (types, lists, matching) — safe on both server and browser. Data calls: scraps-server.ts / api.ts.
import { norm } from './shop';

export type Cat = 'sheet' | 'solid' | 'alu';

export type Scrap = {
  id: string; category: Cat; material: string; brand: string; code: string; color: string;
  thick: number | null; len: number; wid: number | null; qty: number;
  cond: 'new' | 'used' | 'scratched'; edge: boolean; grain: boolean;
  price_mode: 'free' | 'swap' | 'ask' | 'price'; price: number | null;
  area: string; note: string; imgs: string[]; created_at: string;
};

export const CATS: [Cat, string][] = [['sheet', '🪵 ألواح ومسطحات'], ['solid', '🌳 خشب مسيف'], ['alu', '🪟 ألمونيوم']];

/** Board types (what the board is made of / its face). */
export const SHEET_MATERIALS = ['MDF خام', 'MDF مكسي (ميلامين)', 'HDF', 'حبيبي (شيب بورد)', 'بلوكبورد', 'أبلكاش (بلايوود)', 'كونتر / فورميكا (HPL)', 'بولي لاك / هاي جلوس', 'أكريليك', 'قشرة طبيعية', 'غير ذلك'];
/** Well-known makers in Egypt. A starter list only: anything else can be typed, and the owner can extend this list. */
export const SHEET_BRANDS = ['جودوود', 'توبوود', 'الشرقاوي', 'إيجر (Egger)', 'كرونوسبان', 'كاستامونو', 'فورميكا', 'بولي لاك', 'غير ذلك'];
export const SOLID_SPECIES = ['زان', 'أرو', 'موسكي', 'سويدي', 'صنوبر', 'ماهوجني', 'ساج', 'بامبو', 'غير ذلك'];
export const ALU_TYPES = ['قطاع دلف', 'قطاع إطار / ضلفة', 'زاوية', 'قطاع U', 'قطاع T', 'ماسورة', 'شيت / لوح ألمونيوم', 'غير ذلك'];
export const COMMON_THICK = [3, 4, 6, 8, 10, 12, 16, 18, 20, 25];

export const COND: Record<string, string> = { new: 'جديدة', used: 'مستعملة', scratched: 'فيها خدش' };
export const PRICE_MODE: Record<string, string> = { free: 'ببلاش', swap: 'بدل', ask: 'اتفق معاه', price: 'بسعر' };

export const CAT_NAME: Record<Cat, string> = { sheet: 'لوح', solid: 'خشب مسيف', alu: 'ألمونيوم' };

export type Query = {
  category: Cat; material?: string; brand?: string; code?: string; thick?: number;
  len: number; wid?: number; /** allow turning the piece 90° (default true; off for boards with a grain direction) */ rotate?: boolean;
};
export type Level = 1 | 2 | 3;
export type Hit = { s: Scrap; level: Level; why: string; waste: number };

const eq = (a: string, b: string) => !!a && !!b && norm(a) === norm(b);
const codeKey = (c: string) => norm(c).replace(/[\s\-_/.]/g, '');
const THICK_TOL = 0.6; // mm: 18 finds 18, not 16

/** Does the offcut cover the wanted size? Returns the fit and the left-over area (cm²) or null. */
export function fits(s: Pick<Scrap, 'len' | 'wid' | 'grain' | 'category'>, q: Pick<Query, 'len' | 'wid' | 'rotate'>): number | null {
  if (s.category === 'alu' && !s.wid) return s.len >= q.len ? s.len - q.len : null;
  const w = q.wid ?? 0, sw = s.wid ?? 0;
  const direct = s.len >= q.len && sw >= w;
  const turned = (q.rotate ?? true) && !s.grain && s.len >= w && sw >= q.len;
  if (!direct && !turned) return null;
  return s.len * sw - q.len * w;
}

/** 1 = same code and big enough, 2 = same code but a little short (≤ 5 cm), 3 = same board type / thickness, other colour. */
export function matchScraps(list: Scrap[], q: Query): Hit[] {
  const out: Hit[] = [];
  const qc = q.code ? codeKey(q.code) : '';
  for (const s of list) {
    if (s.category !== q.category) continue;
    if (q.thick && s.thick != null && Math.abs(s.thick - q.thick) > THICK_TOL) continue;
    if (q.thick && s.thick == null && q.category !== 'alu') continue;
    if (q.material && q.category !== 'alu' && !eq(s.material, q.material) && s.material) {
      // «غير ذلك» on either side keeps the item visible as a looser match; a different known material is dropped.
      if (!/غير ذلك/.test(q.material) && !/غير ذلك/.test(s.material)) continue;
    }
    if (q.material && q.category === 'alu' && s.material && !eq(s.material, q.material) && !/غير ذلك/.test(q.material) && !/غير ذلك/.test(s.material)) continue;
    const sameCode = !!qc && codeKey(s.code) === qc;
    const sameBrand = !!q.brand && eq(s.brand, q.brand);
    const f = fits(s, q);
    if (f != null) {
      if (!qc || sameCode) out.push({ s, level: 1, why: sameCode ? 'نفس الكود' : 'المقاس مناسب', waste: f });
      else out.push({ s, level: 3, why: sameBrand ? 'نفس الشركة، لون تاني' : 'لون تاني', waste: f });
      continue;
    }
    // A little short: within 5 cm on one side (only worth showing for the same code).
    if (sameCode && s.category !== 'alu') {
      const w = q.wid ?? 0, sw = s.wid ?? 0;
      const short = Math.min(Math.max(q.len - s.len, 0) + Math.max(w - sw, 0), Math.max(w - s.len, 0) + Math.max(q.len - sw, 0));
      if (short > 0 && short <= 5) out.push({ s, level: 2, why: `أقصر بـ ${Math.ceil(short)} سم`, waste: 1e9 });
    } else if (sameCode && s.category === 'alu') {
      const short = q.len - s.len;
      if (short > 0 && short <= 5) out.push({ s, level: 2, why: `أقصر بـ ${Math.ceil(short)} سم`, waste: 1e9 });
    }
  }
  return out.sort((a, b) => a.level - b.level || a.waste - b.waste || (a.s.created_at < b.s.created_at ? 1 : -1));
}

export const sizeText = (s: Pick<Scrap, 'len' | 'wid' | 'thick' | 'category'>) =>
  `${s.len}${s.wid ? ' × ' + s.wid : ''} سم${s.thick ? ' · سمك ' + s.thick + ' مم' : ''}`;

export const titleOf = (s: Scrap) =>
  [s.category === 'sheet' ? s.material || 'لوح' : s.category === 'solid' ? 'خشب ' + (s.material || '') : s.material || 'ألمونيوم', s.brand, s.code && '#' + s.code, s.color].filter(Boolean).join(' · ');

export const priceText = (s: Pick<Scrap, 'price_mode' | 'price'>) => (s.price_mode === 'price' && s.price ? `${s.price} جنيه` : PRICE_MODE[s.price_mode] ?? '');

/** Days since the listing (for «من 3 أيام»). */
export const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'النهاردة' : d === 1 ? 'امبارح' : d < 30 ? `من ${d} يوم` : 'من شهر';
};

/** Colour codes published by Egyptian makers (suggestions while typing a code; any other code can still be typed).
 *  Sources (checked 2026-10-31): counterelsharkawy.com/en/melamine-colors (54 codes, names not published there),
 *  top-wood.net «كونتر الميلامين» (only 5 codes listed on the page; the full list is in their PDF catalogue). */
export const BRAND_CODES: { match: RegExp; brand: string; codes: string[] }[] = [
  { match: /شرقاو|sharkawy/i, brand: 'الشرقاوي', codes: ['1', '2', '7', '8', '9', '12', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '70', '71', '72', '73', '74', '75', '76', '78', '80', '85', '86', '88', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103'] },
  { match: /توب\s?وود|top\s?wood/i, brand: 'توبوود', codes: ['9009', '3031', '3026', '0310', '6015'] },
];
export const codesFor = (brand: string) => BRAND_CODES.find(b => b.match.test(brand))?.codes ?? [];
