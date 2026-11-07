/**
 * «سوق الفضلة»: pure helpers (no database). Same rules as the site's matching (rebuild/site/src/lib/scraps.ts):
 * thickness within 0.6 mm, a piece may be turned 90° unless it has a grain direction.
 */
export type Cat = 'sheet' | 'solid' | 'alu';
export const CATS: Cat[] = ['sheet', 'solid', 'alu'];
export const COMMON_THICK = [3, 4, 5, 6, 8, 9, 10, 12, 16, 17, 18, 19, 20, 22, 25, 30, 36, 40];
const THICK_TOL = 0.6;
/** a piece up to this much (cm) smaller than wanted is still worth telling its owner about */
const NEAR_CM = 10;

export interface Piece { category: string; material: string; thick: number | null; len: number; wid: number | null; grain: boolean }
export interface Want { category: string; material: string; thick: number | null; len: number; wid: number | null }

const norm = (s: string) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

/** left-over area (cm²) if the piece covers the wanted size, else null */
export function fits(s: Pick<Piece, 'len' | 'wid' | 'grain' | 'category'>, q: { len: number; wid: number | null }, slack = 0): number | null {
  if (s.category === 'alu' && !s.wid) return s.len + slack >= q.len ? s.len - q.len : null;
  const w = q.wid ?? 0, sw = s.wid ?? 0;
  const direct = s.len + slack >= q.len && sw + slack >= w;
  const turned = !s.grain && s.len + slack >= w && sw + slack >= q.len;
  if (!direct && !turned) return null;
  return s.len * sw - q.len * w;
}

/** same kind of board (category, thickness, material when both are known) */
export function sameKind(s: Piece, q: Want): boolean {
  if (s.category !== q.category) return false;
  if (q.thick != null && s.thick != null && Math.abs(s.thick - q.thick) > THICK_TOL) return false;
  if (q.thick != null && s.thick == null && q.category !== 'alu') return false;
  if (q.material && s.material && norm(q.material) !== norm(s.material) && !/غير ذلك/.test(q.material + s.material)) return false;
  return true;
}

/** the piece fits the search, or is at most NEAR_CM short: its owner gets «حد دوّر على مقاسك» */
export const isNear = (s: Piece, q: Want) => sameKind(s, q) && fits(s, q, NEAR_CM) !== null;
/** a real hit (covers the size): the search found something, no need to ping anyone */
export const isHit = (s: Piece, q: Want) => sameKind(s, q) && fits(s, q) !== null;

// ───────────── WhatsApp text → offcut draft ─────────────

export interface Draft {
  category: Cat; material: string; brand: string; code: string; color: string;
  thick: number | null; pieces: { len: number; wid: number | null; qty: number }[];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function cleanText(t: string): string {
  return String(t || '')
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[xX*✕✖]/g, '×')
    .replace(/(\d)\s*(?:في|ف)\s*(\d)/g, '$1×$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** the message is about an offcut (the craftsman wrote «فضلة»): anything else stays a normal WhatsApp order */
export const isScrapText = (t: string) => /(?<![أاإتمي])فضل(?:[ةه]|ات)|فضايل/.test(t);

const MATERIALS: [RegExp, string][] = [
  [/ميلامين|مكسي|melamine/i, 'MDF مكسي (ميلامين)'],
  [/\bhdf\b|اتش دي اف/i, 'HDF'],
  [/\bmdf\b|ام دي اف|إم دي إف/i, 'MDF خام'],
  [/حبيبي|شيب ?بورد|chip/i, 'حبيبي (شيب بورد)'],
  [/بلوك ?بورد|بلوكبورد/i, 'بلوكبورد'],
  [/[أا]بلكاش|بلايوود|plywood/i, 'أبلكاش (بلايوود)'],
  [/كونتر|فورميكا|hpl/i, 'كونتر / فورميكا (HPL)'],
  [/هاي ?جلوس|بولي ?لاك|high ?gloss/i, 'بولي لاك / هاي جلوس'],
  [/[أا]كريليك/i, 'أكريليك'],
  [/قشر[ةه]/i, 'قشرة طبيعية'],
];
const SPECIES = ['زان', 'أرو', 'موسكي', 'سويدي', 'صنوبر', 'ماهوجني', 'ساج', 'بامبو'];
const ALU: [RegExp, string][] = [
  [/دلف/, 'قطاع دلف'], [/[إا]طار|ضلف/, 'قطاع إطار / ضلفة'], [/زاوي[ةه]/, 'زاوية'], [/ماسور/, 'ماسورة'], [/شيت|لوح/, 'شيت / لوح ألمونيوم'],
];
const BRANDS: [RegExp, string][] = [
  [/جود ?وود/, 'جودوود'], [/توب ?وود/, 'توبوود'], [/الشرقاوي/, 'الشرقاوي'], [/[إا]يجر|egger/i, 'إيجر (Egger)'],
  [/كرونوسبان|kronospan/i, 'كرونوسبان'], [/كاستامونو|kastamonu/i, 'كاستامونو'],
];
const FILLER = new Set(['فضله', 'فضلة', 'فضلات', 'فضايل', 'عندي', 'عندنا', 'في', 'حته', 'حتة', 'حتت', 'لوح', 'الواح', 'ألواح', 'مقاس', 'مقاسات', 'سمك', 'مم', 'ملي', 'مللي', 'سم', 'سنتي', 'متر', 'عدد', 'و', 'من', 'خشب', 'ال', 'قطعه', 'قطعة', 'حتتين', 'ألمونيوم', 'الومنيوم', 'المونيوم', 'قطاع', 'للبيع', 'بيع', 'ببلاش', 'جديده', 'جديدة', 'مستعمله', 'مستعملة']);

export function parseScrapText(raw: string): Draft {
  let t = cleanText(raw);
  const category: Cat = /[أا]لمونيوم|الومنيوم|المنيوم|قطاع/.test(t) ? 'alu' : SPECIES.some((s) => t.includes(s)) && !MATERIALS.some(([r]) => r.test(t)) ? 'solid' : 'sheet';
  const pieces: Draft['pieces'] = [];
  let thick: number | null = null;

  // thickness written with its unit: «18 مم», «18مل», «سمك 18»
  const tu = /(?:سمك\s*)?(\d+(?:\.\d+)?)\s*(?:مم|ملي|مللي|مل)(?![a-z؀-ۿ])|سمك\s*(\d+(?:\.\d+)?)/.exec(t);
  if (tu) { thick = Number(tu[1] ?? tu[2]); t = t.replace(tu[0], ' '); }

  if (category !== 'alu') {
    const re = /(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)(?:\s*×\s*(\d{1,3})(?!\d|\s*×))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) pieces.push({ len: Number(m[1]), wid: Number(m[2]), qty: Math.max(1, Math.min(999, Number(m[3] || 1))) });
    t = t.replace(re, ' ');
    // «عدد 2» / «2 حتة» after a single size
    const q = /عدد\s*(\d{1,3})|(\d{1,3})\s*(?:حت[ةهت]|قطع)/.exec(t);
    if (q && pieces.length === 1 && pieces[0].qty === 1) { pieces[0].qty = Number(q[1] ?? q[2]); t = t.replace(q[0], ' '); }
    if (thick == null) {
      const lone = (t.match(/(?<![\d.])\d+(?:\.\d+)?(?![\d.])/g) || []).map(Number).find((n) => COMMON_THICK.includes(n));
      if (lone != null) { thick = lone; t = t.replace(new RegExp(`(?<![\\d.])${lone}(?![\\d.])`), ' '); }
    }
  } else {
    // aluminium: a length (cm, or metres when written «متر») and an optional count «× 3»
    const m = /(\d+(?:\.\d+)?)\s*(متر|م\b|سم|سنتي)?(?:\s*×\s*(\d{1,3}))?/.exec(t);
    if (m) {
      const n = Number(m[1]);
      pieces.push({ len: m[2] && /^م/.test(m[2]) && n < 10 ? n * 100 : n, wid: null, qty: Math.max(1, Number(m[3] || 1)) });
      t = t.replace(m[0], ' ');
    }
  }

  let material = '';
  if (category === 'sheet') material = MATERIALS.find(([r]) => r.test(t))?.[1] ?? '';
  else if (category === 'solid') material = SPECIES.find((s) => t.includes(s)) ?? '';
  else material = ALU.find(([r]) => r.test(t))?.[1] ?? '';
  const brand = BRANDS.find(([r]) => r.test(t))?.[1] ?? '';

  // a colour code like H1180, U702, 0207 (letters + 3-5 digits)
  let code = '';
  const cm = /(?<![\w\d])([A-Za-z]{0,3}\d{3,5}[A-Za-z]{0,2})(?![\w\d])/.exec(t);
  if (cm && category === 'sheet') { code = cm[1].toUpperCase(); t = t.replace(cm[0], ' '); }

  // whatever words are left (not a known word) are the colour: «جوزي», «أبيض لامع»
  for (const [r] of [...MATERIALS, ...BRANDS, ...ALU]) t = t.replace(new RegExp(r.source, 'gi'), ' ');
  for (const s of SPECIES) t = t.split(s).join(' ');
  const color = t
    .replace(/[\d.×,،:;؛\-_/()+#!?؟"'«»]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !FILLER.has(w))
    .join(' ')
    .slice(0, 40);
  return { category, material, brand, code, color, thick, pieces };
}

/** what is still missing before the offcut can be listed (one short question at a time) */
export function missing(d: Draft): 'size' | 'thick' | null {
  if (!d.pieces.length) return 'size';
  if (d.category !== 'alu' && d.thick == null) return 'thick';
  return null;
}

const CAT_NAME: Record<Cat, string> = { sheet: 'لوح', solid: 'خشب', alu: 'ألمونيوم' };
/** one line per piece for the WhatsApp reply */
export function describe(d: Pick<Draft, 'category' | 'material' | 'color' | 'code' | 'thick'>, p: { len: number; wid: number | null; qty: number }): string {
  const what = [d.material || CAT_NAME[d.category], d.thick != null ? `${d.thick}مم` : '', d.color, d.code].filter(Boolean).join(' ');
  const size = p.wid ? `${p.len}×${p.wid} سم` : `${p.len} سم`;
  return `• ${what} — ${size}${p.qty > 1 ? ` (${p.qty} حتت)` : ''}`;
}
