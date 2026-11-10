/**
 * استيراد يومية البيع من إكسل — المنطق نفسه بتاع القديم (parseAoa / groupRows / matchAll):
 * بيدوّر على صف العناوين (الصنف + العدد + السعر)، وبيقرا التاريخ، وبيطابق الأصناف بالاسم أو بأقرب اسم.
 */

/** Same normalizer as the old VN(): Arabic letters, digits and punctuation made comparable. */
export const vn = (s: unknown) =>
  String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[,،؟?!:;()]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const A = (s: unknown) => String(s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const nv = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(A(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.'));
  return Number.isNaN(n) ? 0 : n;
};
/** A header cell: normalised, and without the invisible marks Excel/WhatsApp sometimes leave in a title. */
const hv = (s: unknown) => vn(String(s ?? '').replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, ' ').replace(/[*#:：.\-_/\\]+/g, ' '));
const HD: Record<string, string[]> = {
  prod: ['الصنف', 'اسم الصنف', 'المنتج', 'اسم المنتج', 'الاصناف', 'البيان', 'الوصف'],
  qty: ['عدد', 'العدد', 'الكمية', 'كمية'],
  price: ['سعر', 'السعر', 'سعر الوحدة', 'سعر القطعة', 'سعر البيع', 'الفئة'],
  total: ['الاجمالي', 'اجمالي', 'المجموع', 'القيمة', 'الجملة'],
  pay: ['طريقة الدفع', 'الدفع', 'نوع الدفع'],
  note: ['ملاحظات', 'ملاحظة'],
  cust: ['اسم العميل', 'العميل'],
};
const HN: Record<string, string[]> = {};
for (const k in HD) HN[k] = HD[k].map((x) => hv(x));
export const COL_NAMES: Record<string, string> = { prod: 'الصنف', qty: 'عدد', price: 'سعر' };
const z2 = (v: number) => String(v).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${z2(m)}-${z2(d)}`;
const valid = (y: number, m: number, d: number) => {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(y, m - 1, d);
  return t.getMonth() === m - 1 && t.getDate() === d;
};
/** JS weekday (0 = الأحد) written in the sheet title («اليوم / الاتنين»), or -1. */
const DAYS: [RegExp, number][] = [
  [/الاحد|الحد/, 0],
  [/الاتنين|الاثنين/, 1],
  [/التلات|الثلاث/, 2],
  [/الاربع/, 3],
  [/الخميس/, 4],
  [/الجمعه/, 5],
  [/السبت/, 6],
];
const weekdayIn = (t: string) => {
  const n = vn(t);
  for (const [re, d] of DAYS) if (re.test(n)) return d;
  return -1;
};
const dowOf = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).getDay();
export const DAY_NAMES = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

/** «9-11-2026.xlsx» → 2026-11-09 (the way the shop names each day's file). */
export function dateFromName(name: string): string {
  const m = A(name).match(/(\d{1,2})\s*[-_.]\s*(\d{1,2})\s*[-_.]\s*(\d{4})/);
  if (!m) return '';
  return valid(+m[3], +m[2], +m[1]) ? ymd(+m[3], +m[2], +m[1]) : '';
}

export type PayVia = '' | 'INSTAPAY' | 'TRANSFER';
export interface ImpRow {
  prod: string;
  qty: number;
  price: number;
  mism: boolean;
  /** the sheet's own total cell for this line is empty/zero, so the sheet's grand total misses it */
  zero?: boolean;
  pay: 'cash' | 'credit';
  /** paid, but not into the drawer: انستا باي / تحويل */
  via?: PayVia;
  note: string;
  cust: string;
  pid: string;
  hint: string;
  isNew?: boolean;
}
export interface ImpSheet {
  name: string;
  iso: string;
  rows: ImpRow[];
  /** «مرتجع» lines of the sheet (written with a minus): not sales — offered as returns */
  returns?: ImpRow[];
  /** why the date might be wrong (shown above the date box) */
  dateNote?: string;
  /** the total written in the sheet itself, to compare with what was read */
  sheetTotal?: number;
}
/** What a sheet looked like: a filled table, a table with no lines yet, or not a daily table at all. */
export interface SheetScan {
  kind: 'ok' | 'empty' | 'none';
  iso: string;
  dateNote: string;
  rows: ImpRow[];
  sheetTotal: number;
  returns: ImpRow[];
  /** of الصنف / عدد / سعر: the ones this sheet does have (for the «مش لاقي عمود …» message) */
  found: string[];
  missing: string[];
}

function findHeader(aoa: unknown[][]) {
  let best: { r: number; c: Record<string, number>; n: number } | null = null;
  for (let r = 0; r < Math.min(aoa.length, 80); r++) {
    const c: Record<string, number> = {};
    (aoa[r] || []).forEach((v, j) => {
      if (v == null || v === '' || typeof v === 'number' || v instanceof Date) return;
      const t = hv(v);
      if (!t || t.length > 24) return;
      for (const k in HN) if (c[k] == null && HN[k].includes(t)) return void (c[k] = j);
      // «سعر القطعه بالجنيه» / «العدد المباع»: a title that starts with one of the known words
      for (const k in HN) if (c[k] == null && HN[k].some((w) => t.startsWith(`${w} `))) return void (c[k] = j);
    });
    const full = c.prod != null && c.qty != null && (c.price != null || c.total != null);
    if (full) return { r, c, full: true as const };
    const n = ['prod', 'qty', 'price'].filter((k) => c[k] != null).length;
    if (n >= 1 && c.prod != null && (!best || n > best.n)) best = { r, c, n };
  }
  return best ? { r: best.r, c: best.c, full: false as const } : null;
}

/** The sheet's date: a real date cell, or text like 9/11/2026 — checked against the weekday written next to it and the file name. */
function findDate(aoa: unknown[][], upTo: number, fileName: string): { iso: string; note: string } {
  let dow = -1;
  const cands: string[] = [];
  for (let r = 0; r < upTo; r++) {
    for (const v of aoa[r] || []) {
      if (v instanceof Date && !Number.isNaN(v.getTime())) {
        // Excel dates come out a few seconds before midnight of the day before (SheetJS + local-mean-time zones): move to midday first
        const t = new Date(v.getTime() + 12 * 3600e3);
        if (valid(t.getFullYear(), t.getMonth() + 1, t.getDate())) cands.push(ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()));
      } else if (typeof v === 'string' && v.trim()) {
        if (dow < 0) dow = weekdayIn(v);
        const m = A(v).match(/(\d{1,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,4})/);
        if (!m) continue;
        const [a, b, c] = [+m[1], +m[2], +m[3]];
        if (m[1].length === 4) {
          if (valid(a, b, c)) cands.push(ymd(a, b, c));
          continue;
        }
        const y = m[3].length <= 2 ? 2000 + c : c;
        // day/month the Egyptian way first; month/day too (Excel shows 11/9/26 on an English Windows)
        if (valid(y, b, a)) cands.push(ymd(y, b, a));
        if (valid(y, a, b) && a !== b) cands.push(ymd(y, a, b));
      }
    }
  }
  const fromName = dateFromName(fileName);
  const fits = (iso: string) => dow < 0 || dowOf(iso) === dow;
  const sheet = cands.find(fits) ?? cands[0] ?? '';
  if (!sheet) return { iso: fromName, note: fromName ? '' : 'مفيش تاريخ في الورقة — اتأكد من التاريخ' };
  if (fromName && fromName !== sheet) {
    // the day's file is a copy of an older one: when the cell and the file name disagree, the one that fits the written weekday wins;
    // if that does not settle it, the file name does (unless it is a future day or another year — then it is the name that has the typo)
    const now = new Date();
    const today = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const nameWins = dow >= 0 && fits(fromName) !== fits(sheet) ? fits(fromName) : fromName <= today && fromName.slice(0, 4) === sheet.slice(0, 4);
    const pick = nameWins ? fromName : sheet;
    return { iso: pick, note: `التاريخ المكتوب جوه الورقة ${sheet} واسم الملف بيقول ${fromName} — خدت ${pick}، راجعه قبل ما تأكد` };
  }
  if (!fits(sheet)) return { iso: sheet, note: `التاريخ ${sheet} بيطلع ${DAY_NAMES[dowOf(sheet)]} بس مكتوب في الورقة ${DAY_NAMES[dow]} — راجع التاريخ` };
  return { iso: sheet, note: '' };
}

export function scanAoa(aoa: unknown[][], fileName = ''): SheetScan {
  const h = findHeader(aoa);
  const need = ['prod', 'qty', 'price'];
  if (!h || !h.full) {
    const c = h?.c ?? {};
    return { kind: 'none', iso: '', dateNote: '', rows: [], returns: [], sheetTotal: 0, found: need.filter((k) => c[k] != null).map((k) => COL_NAMES[k]), missing: need.filter((k) => c[k] == null).map((k) => COL_NAMES[k]) };
  }
  const { r: hi, c: col } = h;
  const { iso, note: dateNote } = findDate(aoa, hi, fileName);
  // the day's total, written above the table under the «الاجمالي» column
  let sheetTotal = 0;
  if (col.total != null) for (let r = 0; r < hi; r++) if (typeof aoa[r]?.[col.total] === 'number') sheetTotal = aoa[r][col.total] as number;
  const rows: ImpRow[] = [];
  const returns: ImpRow[] = [];
  for (let r = hi + 1; r < aoa.length; r++) {
    const a = aoa[r] || [];
    const g = (k: string) => (col[k] == null ? '' : a[col[k]]);
    const prod = String(g('prod') ?? '').replace(/\s+/g, ' ').trim();
    const q0 = nv(g('qty'));
    if (!prod || !q0) continue;
    const p0 = col.price != null ? nv(g('price')) : 0;
    const t0 = col.total != null ? nv(g('total')) : 0;
    // «مرتجع»: the shop writes it as a line with a minus (on the price, the total or the quantity)
    const back = q0 < 0 || p0 < 0 || t0 < 0;
    const qty = Math.abs(q0);
    let price = Math.abs(p0);
    const total = Math.abs(t0);
    let mism = false;
    if (total && price && Math.abs(total - qty * price) > 0.01) {
      price = total / qty;
      mism = true;
    } else if (!price && total) price = total / qty;
    const zero = col.total != null && col.price != null && !total && price > 0;
    const pr = String(g('pay') ?? '').trim();
    const pn = vn(pr);
    const pay: 'cash' | 'credit' = pn.includes('اجل') ? 'credit' : 'cash';
    const via: PayVia = pay === 'credit' ? '' : /انست|انسا|insta/.test(pn) ? 'INSTAPAY' : /تحويل|فودافون|محفظ|كاش موبايل|بنك/.test(pn) ? 'TRANSFER' : '';
    const extra = pr && !pn.includes('اجل') && !pn.includes('نقد') && !/^كاش$/.test(pn) ? pr : '';
    const note = [String(g('note') ?? '').trim(), extra].filter(Boolean).join(' - ');
    const row: ImpRow = { prod, qty, price: +price.toFixed(4), mism, ...(zero ? { zero } : {}), pay, via, note, cust: String(g('cust') ?? '').replace(/\s+/g, ' ').trim(), pid: '', hint: '' };
    if (back) {
      if (price > 0) returns.push(row);
    } else rows.push(row);
  }
  return { kind: rows.length || returns.length ? 'ok' : 'empty', iso, dateNote, rows, returns, sheetTotal, found: need.map((k) => COL_NAMES[k]), missing: [] };
}

/** Old entry point (kept for callers that only want the rows): null when the sheet has no daily table. */
export function parseAoa(aoa: unknown[][], fileName = ''): { iso: string; rows: ImpRow[] } | null {
  const s = scanAoa(aoa, fileName);
  return s.kind === 'none' ? null : { iso: s.iso, rows: s.rows };
}

/** What the sheet's own total should be from what was read: sales − returns, without the lines whose total cell is empty. */
export function readTotals(rows: ImpRow[], returns: ImpRow[] = []) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sales = r2(rows.reduce((s, r) => s + r.qty * r.price, 0));
  const zero = r2(rows.filter((r) => r.zero).reduce((s, r) => s + r.qty * r.price, 0));
  const back = r2(returns.filter((r) => !r.zero).reduce((s, r) => s + r.qty * r.price, 0));
  return { sales, zero, back, expect: r2(sales - zero - back) };
}

/** Cells copied from Excel and pasted as text (tabs between cells, quotes around a cell that has a line break). */
export function pastedToAoa(text: string): unknown[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && !cell) q = true;
    else if (ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/**
 * A pasted table. When only the lines were copied (no title row), they are read in the shop's own column order:
 * [م]، الصنف، عدد، سعر، الاجمالي، طريقة الدفع، ملاحظات، اسم العميل.
 */
export function scanPasted(text: string): SheetScan {
  const aoa = pastedToAoa(text).filter((r) => r.some((c) => String(c ?? '').trim()));
  const first = scanAoa(aoa);
  if (first.kind !== 'none' || !aoa.length) return first;
  const isNum = (v: unknown) => /^-?[\d٠-٩.,٫٬\s]+$/.test(String(v ?? '').trim()) && /[\d٠-٩]/.test(String(v ?? ''));
  const cols = ['الصنف', 'عدد', 'سعر', 'الاجمالي', 'طريقة الدفع', 'ملاحظات', 'اسم العميل'];
  const probe = aoa.find((r) => r.filter((c) => String(c ?? '').trim()).length >= 3) ?? aoa[0];
  const head = isNum(probe[0]) && !isNum(probe[1]) ? ['م', ...cols] : !isNum(probe[0]) && isNum(probe[1]) ? cols : null;
  if (!head) return first;
  const guess = scanAoa([head, ...aoa]);
  return guess.kind === 'ok' ? { ...guess, dateNote: 'اللي لصقته من غير صف العناوين — قريته بترتيب أعمدة اليومية المعتاد، راجع الأصناف والتاريخ' } : first;
}

export interface ImpGroup {
  cust: string;
  idx: number[];
}
export function groupRows(rows: ImpRow[], mode: 'each' | 'one'): ImpGroup[] {
  const m = new Map<string, ImpGroup>();
  rows.forEach((r, i) => {
    const nm = vn(r.cust);
    const k = nm || (mode === 'one' ? '' : `#${i}`);
    if (!m.has(k)) m.set(k, { cust: r.cust, idx: [] });
    const g = m.get(k)!;
    if (!g.cust && r.cust) g.cust = r.cust;
    g.idx.push(i);
  });
  return [...m.values()];
}

const dice = (a: string, b: string) => {
  const ta = new Set(vn(a).split(' '));
  const tb = new Set(vn(b).split(' '));
  let c = 0;
  ta.forEach((t) => {
    if (tb.has(t)) c++;
  });
  return (2 * c) / (ta.size + tb.size || 1);
};

/** Match every row to a product by exact name, else suggest the closest one (hint). */
export function matchAll(rows: ImpRow[], products: { id: string; name: string }[]) {
  const idx = new Map<string, { id: string; name: string }>();
  products.forEach((p) => {
    const k = vn(p.name);
    if (!idx.has(k)) idx.set(k, p);
  });
  rows.forEach((r) => {
    const p = idx.get(vn(r.prod));
    r.pid = p ? p.id : '';
    r.hint = '';
    if (!p) {
      let best = 0;
      let bp: { id: string } | null = null;
      products.forEach((q) => {
        const d = dice(r.prod, q.name);
        if (d > best) {
          best = d;
          bp = q;
        }
      });
      if (bp && best >= 0.5) r.hint = (bp as { id: string }).id;
    }
  });
}

/** Same fingerprint idea as the old file check: date + every line's name, quantity and price. */
export function fingerprint(iso: string, rows: ImpRow[]): string {
  const sig = `${iso}|${rows.map((r) => `${vn(r.prod)}:${r.qty}:${r.price}`).join('|')}`;
  let h = 0;
  for (let k = 0; k < sig.length; k++) h = (h * 31 + sig.charCodeAt(k)) | 0;
  return `d${(h >>> 0).toString(36)}_${rows.length}`;
}
