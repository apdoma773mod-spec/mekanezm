// Reading the files the owner drops into the admin: CSV / TSV / pasted Excel cells / JSON / real .xlsx.
// No libraries: .xlsx is a zip of XML files, read with the browser's own DecompressionStream.

export type Table = { headers: string[]; rows: string[][] };

/** CSV or TSV text → table. Delimiter is detected from the first line; quoted cells and line breaks inside quotes work. */
export function parseDelimited(text: string): Table {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return toTable(rows);
}

function toTable(raw: string[][]): Table {
  const rows = raw.filter(r => r.some(c => String(c ?? '').trim() !== '')).map(r => r.map(c => String(c ?? '').trim()));
  if (!rows.length) return { headers: [], rows: [] };
  const w = Math.max(...rows.map(r => r.length));
  const pad = (r: string[]) => Array.from({ length: w }, (_, i) => r[i] ?? '');
  return { headers: pad(rows[0]).map((h, i) => h || `عمود ${i + 1}`), rows: rows.slice(1).map(pad) };
}

/** JSON: an array of objects, or a site backup ({products:[…]}). */
export function parseJson(text: string): Table {
  const j = JSON.parse(text);
  const arr: unknown[] = Array.isArray(j) ? j : Array.isArray(j?.products) ? j.products : [];
  const objs = arr.filter(x => x && typeof x === 'object') as Record<string, unknown>[];
  const headers = [...new Set(objs.flatMap(o => Object.keys(o)))];
  const cell = (v: unknown) => (Array.isArray(v) ? v.join(' | ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
  return { headers, rows: objs.map(o => headers.map(h => cell(o[h]))) };
}

const u32 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);

async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(buf), out = new Map<string, Uint8Array>();
  let e = b.length - 22;
  while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('الملف مش Excel صالح');
  let p = u32(b, e + 16);
  const n = u16(b, e + 10);
  for (let i = 0; i < n; i++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(name)) continue;
    const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    const data = b.subarray(start, start + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
  }
  return out;
}

/** The first sheet of an .xlsx file → table. */
export async function parseXlsx(buf: ArrayBuffer): Promise<Table> {
  const files = await unzip(buf);
  const dom = (name: string) => { const d = files.get(name); return d ? new DOMParser().parseFromString(new TextDecoder().decode(d), 'application/xml') : null; };
  const ss = dom('xl/sharedStrings.xml');
  const strings = ss ? [...ss.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent ?? '').join('')) : [];
  const sheetName = [...files.keys()].filter(k => k.startsWith('xl/worksheets/')).sort((a, c) => a.localeCompare(c, undefined, { numeric: true }))[0];
  const sh = sheetName ? dom(sheetName) : null;
  if (!sh) throw new Error('مفيش شيت في الملف');
  const col = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const rows: string[][] = [];
  for (const r of [...sh.getElementsByTagName('row')]) {
    const row: string[] = [];
    for (const c of [...r.getElementsByTagName('c')]) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      row[col(c.getAttribute('r') ?? 'A1')] = t === 's' ? strings[+v] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent ?? '').join('') : v;
    }
    rows.push(Array.from(row, x => x ?? ''));
  }
  return toTable(rows);
}

/** Any supported file → table. */
export async function readTable(file: File): Promise<Table> {
  const n = file.name.toLowerCase();
  if (n.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer());
  if (n.endsWith('.xls')) throw new Error('ملف xls القديم مش مدعوم — احفظه من Excel كـ xlsx أو CSV');
  const text = await file.text();
  return n.endsWith('.json') ? parseJson(text) : parseDelimited(text);
}

/** Spreadsheet column names (Arabic or English) → product field. */
export const FIELD_ALIASES: Record<string, RegExp> = {
  code: /^(code|sku|كود|الكود|رقم|باركود|barcode)$/i,
  name: /^(name|title|اسم|الاسم|اسم المنتج|المنتج|الصنف|اسم الصنف)$/i,
  sec: /^(sec|section|category|قسم|القسم|الفئة|التصنيف)$/i,
  desc: /^(desc|description|وصف|الوصف|مواصفات|المواصفات)$/i,
  brand: /^(brand|البراند|ماركة|الماركة)$/i,
  tags: /^(tags|keywords|كلمات|كلمات بحث|وسوم)$/i,
  badge: /^(badge|label|شارة)$/i,
  video: /^(video|فيديو|لينك الفيديو)$/i,
  imgs: /^(imgs|images|image|img|photo|photos|صور|صورة|الصور|لينك الصورة)$/i,
  hidden: /^(hidden|مخفي|إخفاء|اخفاء)$/i,
  top: /^(top|featured|مميز)$/i,
};
export const FIELD_LABEL: Record<string, string> = {
  code: 'الكود', name: 'الاسم', sec: 'القسم', desc: 'الوصف والمواصفات', brand: 'البراند', tags: 'كلمات بحث', badge: 'شارة', video: 'فيديو', imgs: 'لينكات الصور', hidden: 'مخفي', top: 'مميز',
};
export const guessField = (header: string) => Object.keys(FIELD_ALIASES).find(k => FIELD_ALIASES[k].test(header.trim())) ?? '';
export const truthy = (v: string) => /^(1|true|yes|y|نعم|ايوه|أيوه|تمام|✓|x)$/i.test(v.trim());
