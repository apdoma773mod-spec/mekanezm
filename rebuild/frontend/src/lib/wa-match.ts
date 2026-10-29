/**
 * محرك مطابقة كلمات الواتساب: نسخة حرفية من الجسر القديم (wa-filter.js v2) عشان شاشة «جرّب رسالة»
 * تقول نفس النتيجة اللي الجسر هيعملها بالظبط.
 */

export interface WaRule {
  name?: string;
  phrases: string[];
  not?: string[];
  type: string;
  scope: 'both' | 'shop' | 'owner';
  mode: 'contains' | 'starts' | 'exact';
  fuzzy?: boolean;
  on?: boolean;
}

export interface WaRules {
  enabled: boolean;
  windowMin: number;
  phoneNotes: Record<string, string>;
  ownerPhones: string[];
  blockPhones: string[];
  allowPhones: string[];
  ignoreSaved: boolean;
  never: string[];
  photos: { byCaption: boolean; byWindow: boolean; fromKnown: boolean };
  rules: WaRule[];
}

export const DEFAULT_RULES: WaRules = {
  enabled: true,
  windowMin: 10,
  phoneNotes: {},
  ownerPhones: [],
  blockPhones: [],
  allowPhones: [],
  ignoreSaved: false,
  never: [],
  photos: { byCaption: true, byWindow: true, fromKnown: true },
  rules: [
    { phrases: ['طلب', 'اوردر', 'order'], type: 'طلب', scope: 'both', mode: 'contains', on: true },
    { phrases: ['تحويل', 'حولت', 'حولتلك', 'ايصال تحويل', 'انستاباي', 'instapay'], type: 'تحويل', scope: 'both', mode: 'contains', on: true },
  ],
};

export const WA_TYPES = ['طلب', 'دلف', 'استانلس', 'بامبو', 'تحويل', 'استفسار سعر', 'استفسار توفّر', 'استفسار صور', 'استفسار أسعار', 'غيره'];

export const PRESETS: { n: string; phrases: string[]; type: string }[] = [
  { n: 'استانلس', phrases: ['استانلس', 'ستانلس', 'استلس', 'ستنلس', 'استيل', 'ستيل'], type: 'استانلس' },
  { n: 'دلف', phrases: ['دلف', 'دلفة', 'دلفه', 'دلف مطبخ'], type: 'دلف' },
  { n: 'بامبو', phrases: ['بامبو', 'بامبوا'], type: 'بامبو' },
  { n: 'طلب / أوردر', phrases: ['طلب', 'اوردر', 'order', 'عايز', 'محتاج', 'ابعتلي'], type: 'طلب' },
  { n: 'تحويل فلوس', phrases: ['تحويل', 'حولت', 'حولتلك', 'ايصال تحويل', 'انستاباي', 'instapay'], type: 'تحويل' },
  { n: 'سؤال عن السعر', phrases: ['بكام', 'سعر', 'اسعار', 'بكم', 'كام سعر'], type: 'استفسار سعر' },
  { n: 'سؤال عن التوفّر', phrases: ['متوفر', 'متاح', 'موجود عندكم', 'عندكم'], type: 'استفسار توفّر' },
  { n: 'طلب صورة', phrases: ['صورة', 'صور', 'ابعتلي صورة'], type: 'استفسار صور' },
];

export function norm(s: string): string {
  return String(s || '')
    .replace(/[ً-ٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (t: string) => t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const PRE = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'ا', 'ي', 'ت', 'ن', 'س'];

function variants(w: string): string[] {
  const out = new Set<string>([w]);
  const strip = (x: string, d: number) => {
    if (d > 2) return;
    for (const p of PRE) {
      if (x.length - p.length >= 2 && x.startsWith(p)) {
        const y = x.slice(p.length);
        if (!out.has(y)) {
          out.add(y);
          strip(y, d + 1);
        }
      }
    }
  };
  strip(w, 1);
  return [...out];
}

const skel = (x: string) => x.charAt(0) + x.slice(1).replace(/[اوي]/g, '');

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let p: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}

function wordHit(w: string, q: string, fz?: boolean): boolean {
  if (w === q) return true;
  if (q.length <= 2) return false;
  for (const v of variants(w)) {
    if (v === q) return true;
    if (v.startsWith(q) && v.length - q.length <= 5) return true;
    if (q.length >= 4) {
      const sq = skel(q);
      const sv = skel(v);
      if (sq.length >= 3 && (sv === sq || (sv.startsWith(sq) && sv.length - sq.length <= 3))) return true;
    }
    if (fz !== false && q.length >= 5) {
      const l = q.length >= 7 && v[0] === q[0] ? 2 : 1;
      if (Math.abs(v.length - q.length) <= l && lev(v, q) <= l) return true;
      if (v.length > q.length && lev(v.slice(0, q.length), q) <= l && v.length - q.length <= 4) return true;
    }
  }
  return false;
}

function phraseHit(p: string, t: string, ws: string[], mode?: string, fz?: boolean): boolean {
  const q = norm(p);
  if (!q) return false;
  if (mode === 'exact') return t === q;
  const qw = words(q);
  if (!qw.length) return false;
  if (mode === 'starts') return qw.every((x, i) => !!ws[i] && wordHit(ws[i], x, fz));
  if (qw.length === 1) return ws.some((w) => wordHit(w, qw[0], fz));
  if ((' ' + ws.join(' ') + ' ').includes(' ' + qw.join(' ') + ' ')) return true;
  for (let i = 0; i < ws.length; i++) {
    if (!wordHit(ws[i], qw[0], fz)) continue;
    const win = ws.slice(i, i + qw.length + 5);
    if (qw.every((x) => win.some((w) => wordHit(w, x, fz)))) return true;
  }
  return false;
}

/** Does a rule match this text? (same as the bridge's hit()) */
export function ruleHit(r: WaRule, text: string): boolean {
  const t = norm(text);
  const ws = words(t);
  if (!ws.length) return false;
  if ((r.not || []).some((p) => phraseHit(p, t, ws, 'contains', false))) return false;
  return (r.phrases || []).some((p) => phraseHit(p, t, ws, r.mode, r.fuzzy));
}

export function neverHit(cfg: WaRules, text: string): boolean {
  const n = norm(text);
  const ws = words(n);
  return (cfg.never || []).some((p) => phraseHit(p, n, ws, 'contains', false));
}

/** The text the test box shows: would this message be accepted, and why (same order as the bridge). */
export function evaluate(cfg: WaRules, text: string, phone: string): { ok: boolean; why: string; type?: string; more?: WaRule[] } {
  const ph = phone.replace(/\D/g, '');
  const last10 = (x: string) => x.slice(-10);
  if (ph && (cfg.blockPhones || []).some((x) => x === ph || last10(x) === last10(ph))) return { ok: false, why: 'الرقم ده في «أرقام بتتجاهل دايمًا»' };
  if (!cfg.enabled) return { ok: true, why: 'الفلتر مقفول: كل الرسايل بتتقبل' };
  if (neverHit(cfg, text)) return { ok: false, why: 'فيها عبارة من الممنوعة' };
  if (ph && (cfg.allowPhones || []).some((x) => last10(x) === last10(ph))) return { ok: true, why: 'الرقم ده في «أرقام بتدخل دايمًا»' };
  const hits = cfg.rules.filter((r) => r.on !== false && ruleHit(r, text));
  return hits.length
    ? { ok: true, why: 'اتطابقت مع قاعدة: ' + (hits[0].name || (hits[0].phrases || []).join('، ')), type: hits[0].type, more: hits.slice(1) }
    : { ok: false, why: 'مفيش قاعدة اتطابقت' };
}

/** «أرقام» box: lines like «01012345678 اسم». Returns numbers and their notes. */
export function parseNumbers(txt: string): { list: string[]; notes: Record<string, string>; bad: number } {
  const list: string[] = [];
  const notes: Record<string, string> = {};
  let bad = 0;
  for (let line of String(txt || '').split(/\n|،|;/)) {
    line = line.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).trim();
    if (!line) continue;
    const all: string[] = line.match(/\+?\d[\d\s\-]{8,}\d/g) ?? [];
    const nums = all.map((x) => x.replace(/\D/g, '')).filter((x) => x.length >= 10 && x.length <= 15);
    if (!nums.length) {
      bad++;
      continue;
    }
    if (nums.length === 1) {
      const note = line.replace(all[0] ?? '', '').replace(/^[\s\-:،]+|[\s\-:،]+$/g, '');
      if (!list.includes(nums[0])) list.push(nums[0]);
      if (note) notes[nums[0]] = note;
    } else {
      for (const n of nums) if (!list.includes(n)) list.push(n);
    }
  }
  return { list, notes, bad };
}

export const numbersText = (arr: string[], notes: Record<string, string>) => arr.map((p) => p + (notes[p] ? '  ' + notes[p] : '')).join('\n');
export const linesOf = (v: string) => v.split(/[,،\n\/]/).map((x) => x.trim()).filter(Boolean);
