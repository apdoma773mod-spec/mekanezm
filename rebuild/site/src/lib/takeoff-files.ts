// Whatever the craftsman uploads → things the AI can read (browser only).
//   photos / screenshots (JPEG, PNG, WebP, HEIC, BMP, GIF) → resized JPEG
//   PDF            → sent as is when small, else its pages drawn to pictures (pdf.js, loaded only when needed)
//   Excel / CSV    → the table as text (cut lists, BOQs)
//   DXF            → its texts, dimensions, layers and blocks as text
//   OBJ            → the named parts with their sizes as text
//   Word (.docx)   → its text and the pictures inside it
//   SketchUp / AutoCAD DWG / 3ds Max / anything else → the preview picture stored inside the file, when there is one
// The whole request must stay under Vercel's 4.5 MB body limit, so pictures share one byte budget.
import { parseDelimited, parseXlsx } from './import-files';

export type Part = { mt: string; data: string; name: string };
export type Intake = { parts: Part[]; text: string; warnings: string[]; thumbs: string[] };

/** base64 characters allowed for all files together (≈ 2.85 MB of real bytes; JSON + text ride on top). */
const B64_BUDGET = 3_800_000;
const MAX_PARTS = 8;
const MAX_TEXT = 60_000;
const MAX_FILE = 80 * 1024 * 1024;

const ext = (n: string) => n.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
const IMG_EXT = /^(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/;

const toB64 = (b: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] || '');
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(b);
});

type Pic = { name: string; draw: (maxSide: number) => HTMLCanvasElement; w: number; h: number };

async function decode(blob: Blob): Promise<{ src: CanvasImageSource; w: number; h: number } | null> {
  try {
    const bm = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { src: bm, w: bm.width, h: bm.height };
  } catch { /* Safari with some formats, or a format the browser can't open → try <img> */ }
  const url = URL.createObjectURL(blob);
  try {
    const im = new Image();
    await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error('decode')); im.src = url; });
    return im.naturalWidth ? { src: im, w: im.naturalWidth, h: im.naturalHeight } : null;
  } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

const picFrom = (name: string, d: { src: CanvasImageSource; w: number; h: number }): Pic => ({
  name, w: d.w, h: d.h,
  draw: max => {
    const k = Math.min(1, max / Math.max(d.w, d.h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); // transparent PNG drawings → white paper, not black
    g.drawImage(d.src, 0, 0, c.width, c.height);
    return c;
  },
});

const canvasBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q));

/** JPEG no bigger than `bytes`: drawings keep their fine lines, so size drops before quality does. */
async function fit(p: Pic, bytes: number): Promise<Blob> {
  let last: Blob | null = null;
  for (const [side, q] of [[2200, 0.85], [1900, 0.82], [1600, 0.8], [1400, 0.75], [1200, 0.7], [1000, 0.62], [800, 0.55]] as const) {
    last = await canvasBlob(p.draw(side), q);
    if (last.size <= bytes) return last;
  }
  return last!;
}

/* ------------------------------------------------------------------ zip (docx) */
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
async function unzip(buf: ArrayBuffer, want: RegExp): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(buf), out = new Map<string, Uint8Array>();
  let e = b.length - 22;
  while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
  if (e < 0) return out;
  let p = u32(b, e + 16);
  const n = u16(b, e + 10);
  for (let i = 0; i < n && p + 46 <= b.length; i++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lo = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!want.test(name)) continue;
    const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    const data = b.subarray(start, start + csize);
    try {
      if (method === 0) out.set(name, data);
      else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
    } catch { /* one broken entry never stops the rest */ }
  }
  return out;
}

/* ------------------------------------------------------------------ text formats */
const tableText = (t: { headers: string[]; rows: string[][] }) => [t.headers, ...t.rows].map(r => r.join(' | ')).join('\n');

/** DXF → what a person would read off the drawing: written texts, dimension values, layer and block names with counts, overall size. */
export function dxfText(src: string): string {
  const L = src.split(/\r?\n/);
  const texts: string[] = [], dims: string[] = [];
  const layers = new Map<string, number>(), blocks = new Map<string, number>(), ents = new Map<string, number>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let type = '', inEnt = false;
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = L[i].trim(), val = L[i + 1].trim();
    if (code === '0') {
      type = val;
      if (val === 'SECTION') inEnt = L[i + 3]?.trim() === 'ENTITIES' || L[i + 3]?.trim() === 'BLOCKS';
      if (inEnt && val !== 'SECTION' && val !== 'ENDSEC' && val !== 'SEQEND' && val !== 'VERTEX') ents.set(val, (ents.get(val) ?? 0) + 1);
      continue;
    }
    if (!inEnt) continue;
    if (code === '8') layers.set(val, (layers.get(val) ?? 0) + 1);
    else if (code === '2' && type === 'INSERT') blocks.set(val, (blocks.get(val) ?? 0) + 1);
    else if ((code === '1' || code === '3') && (type === 'TEXT' || type === 'MTEXT' || type === 'ATTRIB' || type === 'ATTDEF')) {
      const t = val.replace(/\\[A-Za-z][^;]*;|[{}]|\\P/g, ' ').replace(/\s+/g, ' ').trim();
      if (t) texts.push(t);
    } else if (type === 'DIMENSION' && code === '42') { const n = Math.abs(parseFloat(val)); if (isFinite(n) && n > 0) dims.push(String(Math.round(n * 10) / 10)); }
    else if (type === 'DIMENSION' && code === '1' && val && val !== '<>') dims.push(val);
    else if ((code === '10' || code === '11') && (type === 'LINE' || type === 'LWPOLYLINE' || type === 'INSERT')) { const n = parseFloat(val); if (isFinite(n)) { minX = Math.min(minX, n); maxX = Math.max(maxX, n); } }
    else if ((code === '20' || code === '21') && (type === 'LINE' || type === 'LWPOLYLINE' || type === 'INSERT')) { const n = parseFloat(val); if (isFinite(n)) { minY = Math.min(minY, n); maxY = Math.max(maxY, n); } }
  }
  const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ×${v}`).join('، ');
  const out = ['ملف DXF (رسم أوتوكاد). الوحدات غالبًا بالمليمتر.'];
  if (isFinite(minX) && isFinite(minY)) out.push(`حدود الرسم: ${Math.round(maxX - minX)} × ${Math.round(maxY - minY)}`);
  if (layers.size) out.push('الليرات (الاسم × عدد العناصر): ' + top(layers, 60));
  if (blocks.size) out.push('البلوكات المتكررة (الاسم × العدد): ' + top(blocks, 80));
  if (ents.size) out.push('أنواع العناصر: ' + top(ents, 20));
  if (dims.length) out.push('قيم الأبعاد المكتوبة: ' + dims.slice(0, 400).join('، '));
  if (texts.length) out.push('النصوص المكتوبة في الرسم:\n' + [...new Set(texts)].slice(0, 500).join('\n'));
  return out.join('\n');
}

/** OBJ → every named part with its box size (the names usually say door / drawer / shelf). */
export function objText(src: string): string {
  const V: [number, number, number][] = [];
  const parts = new Map<string, [number, number, number, number, number, number]>();
  let cur = 'model';
  for (const line of src.split(/\r?\n/)) {
    if (line.startsWith('v ')) { const a = line.split(/\s+/); V.push([+a[1], +a[2], +a[3]]); }
    else if (line.startsWith('o ') || line.startsWith('g ')) cur = line.slice(2).trim() || cur;
    else if (line.startsWith('f ')) {
      let b = parts.get(cur);
      if (!b) parts.set(cur, (b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]));
      for (const t of line.split(/\s+/).slice(1)) {
        const i = parseInt(t, 10), v = V[i < 0 ? V.length + i : i - 1];
        if (!v) continue;
        for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], v[k]); b[k + 3] = Math.max(b[k + 3], v[k]); }
      }
    }
  }
  const rows = [...parts].filter(([, b]) => isFinite(b[0])).slice(0, 600).map(([n, b]) => `${n}: ${[b[3] - b[0], b[4] - b[1], b[5] - b[2]].map(x => Math.round(x * 10) / 10).sort((a, c) => c - a).join(' × ')}`);
  return rows.length ? 'ملف 3D (OBJ): القطع بأسمائها ومقاس كل قطعة (الأكبر أولًا، بوحدات الملف):\n' + rows.join('\n') : '';
}

/* ------------------------------------------------------------------ pictures stored inside other files */
/** Every JPEG / PNG stored inside a binary file (SketchUp, DWG, 3ds Max… keep a preview of the model). */
function embeddedImages(b: Uint8Array): Blob[] {
  const out: Blob[] = [];
  const find = (sig: number[], from: number) => { outer: for (let i = from; i <= b.length - sig.length; i++) { for (let k = 0; k < sig.length; k++) if (b[i + k] !== sig[k]) continue outer; return i; } return -1; };
  for (let i = find([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); i >= 0 && out.length < 12; ) {
    const end = find([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], i + 8);
    if (end < 0) break;
    if (end - i > 1500) out.push(new Blob([b.slice(i, end + 8)], { type: 'image/png' }));
    i = find([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], end + 8);
  }
  for (let i = find([0xff, 0xd8, 0xff], 0); i >= 0 && out.length < 24; ) {
    const end = find([0xff, 0xd9], i + 3);
    if (end < 0) break;
    if (end - i > 6000) out.push(new Blob([b.slice(i, end + 2)], { type: 'image/jpeg' }));
    i = find([0xff, 0xd8, 0xff], Math.max(end + 2, i + 3));
  }
  return out;
}

/* ------------------------------------------------------------------ PDF pages */
async function pdfPages(buf: ArrayBuffer, name: string, max: number, warn: (s: string) => void): Promise<Pic[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  if (doc.numPages > max) warn(`«${name}» فيه ${doc.numPages} صفحة — قرينا أول ${max} بس. لو الباقي مهم ارفعه لوحده.`);
  const out: Pic[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const page = await doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(3, 2200 / Math.max(v1.width, v1.height)) });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    out.push(picFrom(`${name} — صفحة ${n}`, { src: c, w: c.width, h: c.height }));
  }
  return out;
}

/* ------------------------------------------------------------------ the intake */
const HELP_3D = 'افتحه في البرنامج واعمل Export لـ PDF أو خد سكرين شوت للواجهة والمسقط وارفعهم.';

export async function intake(files: File[], onStep?: (s: string) => void): Promise<Intake> {
  const warnings: string[] = [], texts: string[] = [], pics: Pic[] = [], raw: { mt: string; blob: Blob; name: string }[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };

  for (const f of files) {
    const e = ext(f.name), isImg = f.type.startsWith('image/') || IMG_EXT.test(e);
    onStep?.(`بنجهّز «${f.name}»…`);
    if (f.size > MAX_FILE) { warn(`«${f.name}» أكبر من 80 ميجا — ابعته على الواتساب أو ارفع صور منه.`); continue; }
    try {
      if (isImg) {
        const d = await decode(f);
        if (d) pics.push(picFrom(f.name, d));
        // The browser can't open it (HEIC on Windows Chrome…) but the AI can: send the file itself when it is small enough.
        else if (/^(heic|heif)$/.test(e) && f.size < 2_600_000) raw.push({ mt: 'image/' + e, blob: f, name: f.name });
        else warn(`مقدرناش نفتح الصورة «${f.name}» على الجهاز ده — خد لها سكرين شوت وارفعه.`);
      } else if (e === 'pdf' || f.type === 'application/pdf') {
        // Always as pictures: the result marks every drawer and door on the page the craftsman uploaded.
        pics.push(...await pdfPages(await f.arrayBuffer(), f.name, MAX_PARTS, warn));
      } else if (e === 'xlsx' || e === 'xlsm') {
        texts.push(`جدول Excel «${f.name}»:\n` + tableText(await parseXlsx(await f.arrayBuffer())));
      } else if (e === 'csv' || e === 'tsv' || e === 'txt') {
        const t = await f.text();
        texts.push(`ملف «${f.name}»:\n` + (e === 'txt' ? t : tableText(parseDelimited(t))));
      } else if (e === 'dxf') {
        texts.push(`«${f.name}»:\n` + dxfText(await f.text()));
      } else if (e === 'obj') {
        const t = objText(await f.text());
        if (t) texts.push(`«${f.name}»:\n` + t); else warn(`«${f.name}» مفيهوش قطع مقروءة. ${HELP_3D}`);
      } else if (e === 'docx') {
        const z = await unzip(await f.arrayBuffer(), /^word\/(document\.xml|media\/.+\.(png|jpe?g))$/i);
        const doc = z.get('word/document.xml');
        if (doc) texts.push(`ملف Word «${f.name}»:\n` + new TextDecoder().decode(doc).replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
        for (const [n, data] of z) if (n !== 'word/document.xml') { const d = await decode(new Blob([data as BlobPart])); if (d && d.w > 300) pics.push(picFrom(f.name, d)); }
      } else if (e === 'xls' || e === 'doc') {
        warn(`«${f.name}» بصيغة قديمة — احفظه ${e === 'xls' ? 'xlsx' : 'docx'} أو PDF وارفعه تاني.`);
      } else {
        // SketchUp, DWG, 3ds Max, Kitchen Draw, PolyBoard… : closed formats. Use the preview picture saved inside the file.
        const found: Pic[] = [];
        for (const b of embeddedImages(new Uint8Array(await f.slice(0, 40 * 1024 * 1024).arrayBuffer()))) { const d = await decode(b); if (d && Math.max(d.w, d.h) >= 200) found.push(picFrom(f.name, d)); }
        found.sort((a, b) => b.w * b.h - a.w * a.h);
        if (found.length) {
          pics.push(...found.slice(0, 2));
          warn(`«${f.name}» ملف ${e.toUpperCase() || '3D'} مقفول: قرينا الصورة المصغّرة اللي جواه بس، فالحصر ممكن يكون ناقص. للدقة: ${HELP_3D}`);
        } else warn(`مقدرناش نقرا «${f.name}»${e ? ` (${e.toUpperCase()})` : ''}. ${HELP_3D}`);
      }
    } catch {
      warn(`حصلت مشكلة في قراءة «${f.name}» — جرّب ترفعه PDF أو صورة.`);
    }
  }

  if (pics.length + raw.length > MAX_PARTS) warn(`قرينا أول ${MAX_PARTS} صفحات/صور بس — لو فيه رسومات تانية مهمة ارفعها في مرة تانية.`);
  const rawKeep = raw.slice(0, MAX_PARTS), picKeep = pics.slice(0, MAX_PARTS - rawKeep.length);
  const parts: Part[] = [], thumbs: string[] = [];
  let left = B64_BUDGET;
  // `thumbs` lines up with `parts` (same index = same page), '' where the browser could not draw the file.
  for (const r of rawKeep) { const data = await toB64(r.blob); left -= data.length; parts.push({ mt: r.mt, data, name: r.name }); thumbs.push(''); }
  for (let i = 0; i < picKeep.length; i++) {
    onStep?.(`بنجهّز الصور (${i + 1} من ${picKeep.length})…`);
    const share = Math.floor((left / (picKeep.length - i)) * 0.75); // base64 chars → bytes
    const blob = await fit(picKeep[i], Math.max(120_000, share));
    const data = await toB64(blob);
    left -= data.length;
    parts.push({ mt: 'image/jpeg', data, name: picKeep[i].name });
    try { thumbs.push(picKeep[i].draw(760).toDataURL('image/jpeg', 0.6)); } catch { thumbs.push(''); }
  }
  let text = texts.join('\n\n');
  if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); warn('الجدول/النص طويل — قرينا أول جزء منه بس.'); }
  return { parts, text, warnings, thumbs };
}
