// Pure helpers shared by server and browser code (no data fetching here).
import { DEFAULT_PHONES, SITE_URL } from './config';
import type { Product, Ship, Site, Stock } from './schema';

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

export const shopPhones = (site: Site) => (site.phones ?? DEFAULT_PHONES).filter(x => String(x || '').trim());

/** WhatsApp Business catalog link (unless the owner turned it off). */
export const catalogUrl = (site: Site) => {
  if (site.catalog === false) return '';
  const ph = intl(site.phone);
  return ph ? `https://wa.me/c/${ph}` : '';
};

export const productPath = (id: string) => `/p/${encodeURIComponent(id)}`;
export const productUrl = (id: string) => SITE_URL + productPath(id);

export const sectionOf = (site: Site, p: Product) => site.sections.find(s => s.id === p.sec);

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
export function parseSpecs(d: string): { text: string; rows: [string, string][] } {
  d = String(d || '').trim();
  if (!d) return { text: '', rows: [] };
  const L = d.split(/\r?\n|[•●]/).map(x => x.trim()).filter(Boolean);
  const kv = L.filter(x => /^[^:：]{1,30}[:：]\s*\S/.test(x));
  if (kv.length >= 2 && kv.length >= L.length / 2) {
    const rest = L.filter(x => !kv.includes(x));
    return {
      text: rest.join('\n'),
      rows: kv.map(x => {
        const i = x.search(/[:：]/);
        return [x.slice(0, i).trim(), x.slice(i + 1).trim()];
      }),
    };
  }
  return { text: d, rows: [] };
}

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
