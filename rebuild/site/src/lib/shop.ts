// Pure helpers shared by server and browser code (no data fetching here).
import { DEFAULT_PHONES, SITE_URL } from './config';
import type { Item, Product, Settings, Ship, Site, Stock } from './schema';

/** Arabic-friendly search text: أ/إ/آ→ا، ة→ه، ى→ي، no diacritics, Arabic digits → Latin. */
export const norm = (s: string) => String(s || '').toLowerCase()
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  // Common spellings of the same word, so «ألومنيوم» finds «المنيوم» and «دريسينج» finds «دريسنج».
  .replace(/دريسينج/g, 'دريسنج').replace(/الومنيوم|المونيوم/g, 'المنيوم').replace(/\s+/g, ' ').trim();

export const toItem = (p: Product, ok: boolean): Item => ({ id: p.id, name: p.name, code: p.code, desc: p.desc.slice(0, 120), img: images(p)[0] ?? '', ok });

export type Sort = '' | 'az' | 'av' | 'new';
/** Filter + sort products (server side). Every search word must match name, code or description. */
export function queryProducts(products: Product[], ok: (p: Product) => boolean, o: { sec?: string; q?: string; sort?: Sort; av?: boolean; f?: string }) {
  const words = norm(o.q ?? '').split(' ').filter(Boolean);
  let L = products.filter(p => (!o.sec || p.sec === o.sec) && (!o.av || ok(p)) && (!o.f || hasSpec(p, o.f)) &&
    (!words.length || (h => words.every(w => h.includes(w)))(norm(`${p.name} ${p.code} ${p.desc}`))));
  if (words.length && !o.sort) {
    // Name matches first.
    const inName = (p: Product) => words.every(w => norm(p.name).includes(w));
    L = [...L.filter(inName), ...L.filter(p => !inName(p))];
  }
  if (o.sort === 'new') L = [...L].reverse();
  if (o.sort === 'az' || o.sort === 'av') L = [...L].sort((a, b) => (o.sort === 'av' && ok(a) !== ok(b) ? (ok(a) ? -1 : 1) : a.name.localeCompare(b.name, 'ar')));
  return L;
}

/** Rooms the shop serves; sections whose names match the same room complement each other. */
export const ROOMS: [string, RegExp][] = [
  ['🍽️ مطبخ', /مطبخ|مفصل|مجر|بلوم|اوكر|مقبض|جزام/],
  ['👗 دريسنج روم', /دريسنج|جرار|دلف|مجر|مقبض|اوكر/],
  ['🚪 دولاب / غرفة نوم', /دولاب|جرار|مفصل|مقبض|اوكر|جزام/],
];

/** Products from related sections (same room) that complete the job, available ones first. */
export function complements(all: Product[], sections: { id: string; name: string }[], p: Product, ok: (p: Product) => boolean, n = 8) {
  const mine = sections.find(s => s.id === p.sec)?.name ?? '';
  const rooms = ROOMS.filter(r => r[1].test(mine));
  const secs = new Set(sections.filter(s => s.id !== p.sec && rooms.some(r => r[1].test(s.name))).map(s => s.id));
  const L = all.filter(x => secs.has(x.sec));
  return [...L.filter(ok), ...L.filter(x => !ok(x))].slice(0, n);
}

const STOP = new Set(['من', 'في', 'على', 'مع', 'او', 'و', 'لل', 'ال', 'سم', 'مم', 'قطعه', 'قطعة', 'طقم', 'عدد', 'نوع', 'لون']);
/** Frequent words/word pairs in product names (for quick filter chips inside a big section). */
export function topTerms(products: Product[], max = 10): string[] {
  if (products.length < 4) return [];
  const count = new Map<string, number>();
  for (const p of products) {
    const w = norm(p.name).split(' ').filter(x => x.length >= 2);
    const seen = new Set<string>();
    w.forEach((x, i) => {
      if (!STOP.has(x) && (x.length >= 3 || /\d/.test(x))) seen.add(x);
      if (i < w.length - 1 && !STOP.has(x) && !STOP.has(w[i + 1])) seen.add(x + ' ' + w[i + 1]);
    });
    seen.forEach(k => count.set(k, (count.get(k) ?? 0) + 1));
  }
  const n = products.length;
  const L = [...count].filter(([, c]) => c >= 2 && c <= n * 0.8).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const out: string[] = [];
  for (const [k] of L) {
    if (out.some(o => o.includes(k) || k.includes(o))) continue;
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

/** When nothing matches every word: products matching any word (name first). */
export function looseQuery(products: Product[], q: string, n = 12) {
  const words = norm(q).split(' ').filter(w => w.length >= 2);
  if (!words.length) return [];
  const score = (p: Product) => { const h = norm(p.name), d = norm(p.code + ' ' + p.desc); return words.reduce((s, w) => s + (h.includes(w) ? 2 : d.includes(w) ? 1 : 0) + (w.length >= 4 && h.includes(w.slice(0, -1)) ? 1 : 0), 0); };
  return products.map(p => [p, score(p)] as const).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}

export const sectionPath = (id: string) => `/c/${encodeURIComponent(id)}`;
export const visibleSections = (s: Pick<Settings, 'sections' | 'counts'>) => s.sections.filter(x => (s.counts[x.id] ?? 0) > 0);

/** Products that have a clean white-background cover photo in /public/pw. */
const COVERS = new Set(['1szsarn', '8gcncur', '8q3slf8', 'ib1jif9', 'ixm6cp4']);

export function withCover(p: Product): Product {
  const imgs = p.imgs.length ? p.imgs.slice() : p.img ? [p.img] : [];
  if (COVERS.has(p.id)) imgs.unshift(`/pw/${p.id}.webp`);
  return { ...p, imgs, img: imgs[0] ?? '' };
}

export const images = (p: Product) => (p.imgs.length ? p.imgs : p.img ? [p.img] : []);

export const stockOk = (p: Product, stock: Stock) =>
  p.code && Object.prototype.hasOwnProperty.call(stock, p.code) ? !!stock[p.code] : !p.out;

const intl = (phone: string) => {
  let ph = String(phone || '').replace(/\D/g, '');
  if (ph[0] === '0') ph = '20' + ph.slice(1);
  return ph;
};

export const waUrl = (site: Pick<Site, 'phone'>, text?: string) => {
  const ph = intl(site.phone);
  return ph ? `https://wa.me/${ph}${text ? '?text=' + encodeURIComponent(text) : ''}` : '#';
};

export const shopPhones = (site: Pick<Site, 'phones'>) => (site.phones ?? DEFAULT_PHONES).filter(x => String(x || '').trim());

/** WhatsApp Business catalog link (unless the owner turned it off). */
export const catalogUrl = (site: Pick<Site, 'catalog' | 'phone'>) => {
  if (site.catalog === false) return '';
  const ph = intl(site.phone);
  return ph ? `https://wa.me/c/${ph}` : '';
};

export const productPath = (id: string) => `/p/${encodeURIComponent(id)}`;
export const productUrl = (id: string) => SITE_URL + productPath(id);

export const sectionOf = (site: Pick<Site, 'sections'>, p: Product) => site.sections.find(s => s.id === p.sec);

export const askPriceText = (p: Product) =>
  `السلام عليكم، لو سمحت ده بكام؟\n${p.name}${p.code ? ` (كود ${p.code})` : ''}\n${productUrl(p.id)}`;
export const orderText = (p: Product) => `السلام عليكم، عايز أطلب: ${p.name}${p.code ? ` (كود ${p.code})` : ''}`;

/** Slides for the header slider: owner's banners, else the hero + product photos. */
export function slidesList(site: Site) {
  if (site.slides?.length) return site.slides.map(img => ({ img, t: site.name, s: site.tagline, c: false }));
  const a: { img: string; t: string; s: string; c: boolean }[] = [];
  if (site.hero) a.push({ img: site.hero, t: 'اكتشف مجموعتنا الجديدة', s: site.tagline, c: false });
  for (const p of site.products) {
    for (const x of p.imgs.filter(u => /^https?:/.test(u))) if (a.length < 6) a.push({ img: x, t: p.name, s: p.desc, c: true });
  }
  return a;
}

/** Description → either free text or a key/value spec table (when most lines look like «key: value»). */
/** Lines like «المقاس: 45 سم» → spec rows (short key, short value); the rest stays as text.
 *  Intro/heading lines («اسم المنتج:», «المميزات الأساسية:») are not specs. */
const NOT_SPEC = /^(اسم المنتج|التصنيف|نبذة( عن المنتج)?|المميزات( الأساسية)?|المواصفات( الفنية)?|المقاسات والمواصفات الفنية|ملحوظة|ملاحظة|تحذير.*)$/;
export function parseSpecs(d: string): { text: string; rows: [string, string][] } {
  d = String(d || '').trim();
  if (!d) return { text: '', rows: [] };
  const L = d.split(/\r?\n|[•●]/).map(x => x.replace(/^[\s\-–*✔✅◀▪️🔹🔸]+/u, '').trim()).filter(Boolean);
  const rows: [string, string][] = [];
  const text: string[] = [];
  for (const x of L) {
    const m = /^([^:：]{2,30})[:：]\s*(.+)$/.exec(x);
    const k = m?.[1].replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (m && k && !NOT_SPEC.test(k) && m[2].length <= 70) rows.push([k, m[2].trim()]);
    else text.push(x);
  }
  // Keep the old behaviour for free text with a single «x: y» in it.
  if (rows.length < 2) return { text: d, rows: [] };
  // Drop headings left with nothing under them («المواصفات الفنية:» whose lines all became rows).
  return { text: text.filter(x => !/^[^:：]{2,40}[:：]$/.test(x)).join('\n'), rows };
}

/** Spec filters for a list of products: keys found in ≥2 products with 2–8 short values. */
export function specFilters(products: Product[]) {
  const by = new Map<string, Map<string, number>>();
  for (const p of products) for (const [k, v] of parseSpecs(p.desc).rows) {
    if (v.length > 24) continue;
    const m = by.get(k) ?? new Map<string, number>(); m.set(v, (m.get(v) ?? 0) + 1); by.set(k, m);
  }
  return [...by].map(([k, m]) => ({ k, vals: [...m].sort((x, y) => y[1] - x[1]).map(([v]) => v) }))
    .filter(f => f.vals.length >= 2 && f.vals.length <= 8 && [...by.get(f.k)!.values()].reduce((a, b) => a + b, 0) >= 2).slice(0, 4);
}
export const hasSpec = (p: Product, f: string) => { const i = f.indexOf('|'); return i > 0 && parseSpecs(p.desc).rows.some(([k, v]) => k === f.slice(0, i) && v === f.slice(i + 1)); };

export type Embed = { kind: 'youtube'; id: string } | { kind: 'file'; url: string } | { kind: 'link'; url: string };
export function videoEmbed(u: string): Embed | null {
  u = String(u || '').trim();
  if (!u) return null;
  const m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  if (m) return { kind: 'youtube', id: m[1] };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: 'file', url: u };
  return { kind: 'link', url: u };
}

export const GOVS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'];

export const shipLine = (s: Ship) =>
  s.method === 'ship'
    ? `📦 شحن لـ ${s.gov}${s.area ? ' — ' + s.area : ''}`
    : s.method === 'delivery'
      ? `🛵 توصيل — ${[s.gov, s.area].filter(Boolean).join(' — ')}`
      : '🏪 هاستلم من المحل';

export const shipBits = (o?: { fee?: string; days?: string }) =>
  [o?.fee ? '💵 ' + o.fee : '', o?.days ? '⏱️ ' + o.days : ''].filter(Boolean).join(' • ');

export const deliveryFee = (fee: string) => (fee === '' || fee == null ? '' : +fee ? `${fee} ج.م` : 'مجاناً');

export function orderMsg(id: string, nm: string, ph: string, lines: string[]) {
  return `السلام عليكم، طلب جديد من موقع ميكانيزم\n${id ? 'رقم الطلب: ' + id.slice(0, 8) + '\n' : ''}${nm ? 'الاسم: ' + nm + '\n' : ''}${ph ? 'الموبايل: ' + ph + '\n' : ''}${lines.join('\n')}`;
}

export const FAQ: [string, string][] = [
  ['إزاي أطلب؟', 'اختار المنتج واضغط «أضف للطلب» أو «اطلب على الواتساب»، وهنكلمك نأكد الطلب والسعر.'],
  ['المنتج مش موجود عندكم؟', 'اضغط «مش لاقي اللي بتدوّر عليه؟» وابعت صورته، وهنرد عليك ونقولك نوفّره إمتى.'],
  ['بتوصلوا فين؟', 'توصيل للقاهرة والجيزة، وشحن لكل المحافظات. اختار طريقة الاستلام وانت بتبعت طلبك.'],
  ['أعرف السعر منين؟', 'اضغط «اسأل عن السعر» تحت أي منتج وهنرد عليك على الواتساب بالسعر الحالي.'],
  ['أقدر أعاين المنتج؟', 'أيوه، المعرض في أرض اللواء – الجيزة، ومرحب بيك تيجي تشوف المنتجات بنفسك.'],
];

export const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('ميكانيزم أرض اللواء الجيزة');
