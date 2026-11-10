/**
 * 📐 «صورة المقاسات» automatic: from the product's own photos, with no choices.
 *  1) picks the clearest photo (sharp, plain background, product big in the frame),
 *  2) cuts the product out of its background (U²-Net-small, runs in the browser, model in /models/u2netp.onnx — Apache-2.0),
 *  3) stands it on a marble slab in front of a soft wall and draws the size arrows around the product itself, like the suppliers' pictures.
 */
import { api } from '@/lib/api';

export interface Dims {
  w?: string;
  h?: string;
  d?: string;
  l?: string;
  t?: string;
  bw?: string;
  bl?: string;
}

/** The editor keeps each size in its own box; they are stored together as JSON in the product's dimTxt. */
export const DIM_FIELDS: [keyof Dims, string][] = [['h', 'الارتفاع'], ['w', 'العرض'], ['l', 'الطول'], ['t', 'التخانة'], ['bw', 'عرض القاعدة'], ['bl', 'طول القاعدة']];
export function readDimBoxes(typed: string): Dims | null {
  if (!typed.trim().startsWith('{')) return null;
  try {
    const o = JSON.parse(typed) as Record<string, unknown>;
    const out: Dims = {};
    for (const [k] of DIM_FIELDS) {
      const n = numIn(String(o[k] ?? ''));
      if (n) out[k] = n;
    }
    return out;
  } catch {
    return null;
  }
}

const S = 1200;
const INK = '#b85f1c';
const FONT = '700 38px Cairo, Tahoma, Arial, sans-serif';
const ORT_VER = '1.20.1';

const arDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const numIn = (s: string) => arDigits(s).match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') ?? '';

/** Sizes from labelled spec rows only (عرض/طول، ارتفاع، عمق/سمك) — never a guess from «60×45×12». */
export function parseDims(specs: [string, string][], typed = ''): Dims {
  const boxes = readDimBoxes(typed);
  if (boxes && Object.keys(boxes).length) return boxes; // an empty box = not drawn
  const out: Dims = {};
  for (const [k, v] of specs) {
    const n = numIn(v);
    if (!n) continue;
    if (/ارتفاع|height/i.test(k)) out.h ??= n;
    else if (/عمق|سمك|depth/i.test(k)) out.d ??= n;
    else if (/عرض|طول|width|length/i.test(k)) out.w ??= n;
  }
  // typed in the editor when the specs have none: labelled words win («ارتفاع ١٠», «١٠ سم ارتفاع»); bare numbers follow «عرض × ارتفاع × عمق»; one bare number = height
  if (!out.w && !out.h && !out.d && typed && !typed.trim().startsWith('{')) {
    const t = arDigits(typed);
    const num = '(\\d+(?:[.,]\\d+)?)';
    const lab: [keyof Dims, string][] = [['h', 'ارتفاع|height|طول الرجل|الرجل'], ['d', 'عمق|سمك|depth'], ['w', 'عرض|طول|width|length']];
    for (const [key, words] of lab) {
      const m = t.match(new RegExp('(?:' + words + ')\\s*[:=]?\\s*' + num)) || t.match(new RegExp(num + '\\s*(?:سم|cm|مم|mm)?\\s*(?:' + words + ')'));
      if (m) out[key] = m[1]!.replace(',', '.');
    }
    if (!out.w && !out.h && !out.d) {
      const x = t.match(/\d+(?:[.,]\d+)?/g) ?? [];
      if (x.length === 1) out.h = x[0]!.replace(',', '.');
      else {
        out.w = x[0]?.replace(',', '.');
        out.h = x[1]?.replace(',', '.');
        out.d = x[2]?.replace(',', '.');
      }
    }
  }
  return out;
}
export const hasDims = (d: Dims) => !!(d.w || d.h || d.d || d.l || d.t || d.bw || d.bl);
export const dimSig = (d: Dims) => `${d.w ?? ''}|${d.h ?? ''}|${d.d ?? ''}|${d.l ?? ''}|${d.t ?? ''}|${d.bw ?? ''}|${d.bl ?? ''}`;

/** خطوة ما تخلصش في وقتها بتقف برسالة واضحة بدل ما الشاشة تفضل معلّقة. */
export const within = <T>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  new Promise<T>((ok, bad) => {
    const t = setTimeout(() => bad(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e) => {
        clearTimeout(t);
        bad(e);
      },
    );
  });

const loadImg = (src: string) =>
  within(loadImg0(src), 20000, 'الصورة اتأخرت في الفتح');
const loadImg0 = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error('مقدرتش أفتح الصورة'));
    i.src = src;
  });

function pixels(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  return x.getImageData(0, 0, w, h);
}

/** Sharper, plainer-background, not-too-wide photos first. */
function quality(img: HTMLImageElement) {
  const N = 160;
  const { data } = pixels(img, N, N);
  const g = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = data[i * 4]! * 0.3 + data[i * 4 + 1]! * 0.59 + data[i * 4 + 2]! * 0.11;
  let lap = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const v = 4 * g[y * N + x]! - g[y * N + x - 1]! - g[y * N + x + 1]! - g[(y - 1) * N + x]! - g[(y + 1) * N + x]!;
    lap += v * v;
  }
  lap /= (N - 2) * (N - 2);
  // border colour spread: a plain backdrop has almost none
  const b: number[] = [];
  for (let i = 0; i < N; i++) b.push(g[i]!, g[(N - 1) * N + i]!, g[i * N]!, g[i * N + N - 1]!);
  const m = b.reduce((a, c) => a + c, 0) / b.length;
  const sd = Math.sqrt(b.reduce((a, c) => a + (c - m) ** 2, 0) / b.length);
  const aspect = Math.max(img.width, img.height) / Math.min(img.width, img.height);
  const small = Math.min(img.width, img.height) < 300 ? 0.4 : 1;
  return (Math.sqrt(lap) + 1) * (1 / (1 + sd / 25)) * (aspect > 2.2 ? 0.4 : 1) * small;
}

let session: Promise<{ run: (img: HTMLImageElement) => Promise<Float32Array> }> | null = null;
function getSession() {
  session ??= (async () => {
    const ort = await import('onnxruntime-web');
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
    ort.env.wasm.numThreads = 1;
    const s = await ort.InferenceSession.create('/models/u2netp.onnx', { executionProviders: ['wasm'] });
    const R = 320;
    return {
      run: async (img: HTMLImageElement) => {
        const { data } = pixels(img, R, R);
        const f = new Float32Array(3 * R * R);
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];
        for (let i = 0; i < R * R; i++) for (let c = 0; c < 3; c++) f[c * R * R + i] = (data[i * 4 + c]! / 255 - mean[c]!) / std[c]!;
        const out = await s.run({ [s.inputNames[0]!]: new ort.Tensor('float32', f, [1, 3, R, R]) });
        const m = out[s.outputNames[0]!]!.data as Float32Array;
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
        const r = new Float32Array(R * R);
        for (let i = 0; i < r.length; i++) r[i] = (m[i]! - lo) / (hi - lo || 1);
        return r;
      },
    };
  })();
  return session;
}

/** Keeps the big blobs of the mask (the product) and drops stray specks of background, with a small grow so edges stay whole. */
function keepMain(mask: Float32Array, R: number): Uint8Array {
  const lab = new Int32Array(R * R).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < R * R; i++) {
    if (mask[i]! <= 0.5 || lab[i]! !== -1) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % R;
      const y = (p - x) / R;
      for (const q of [x > 0 ? p - 1 : -1, x < R - 1 ? p + 1 : -1, y > 0 ? p - R : -1, y < R - 1 ? p + R : -1]) {
        if (q >= 0 && mask[q]! > 0.5 && lab[q]! === -1) { lab[q] = id; stack.push(q); }
      }
    }
    sizes.push(size);
  }
  const big = Math.max(0, ...sizes);
  const ok = sizes.map((z) => z >= big * 0.3);
  const keep = new Uint8Array(R * R);
  for (let i = 0; i < R * R; i++) if (lab[i]! >= 0 && ok[lab[i]!]) keep[i] = 1;
  const grown = new Uint8Array(R * R);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    if (keep[y * R + x]) { grown[y * R + x] = 1; continue; }
    for (let dy = -2; dy <= 2 && !grown[y * R + x]; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx;
      const Y = y + dy;
      if (X >= 0 && X < R && Y >= 0 && Y < R && keep[Y * R + X]) { grown[y * R + x] = 1; break; }
    }
  }
  return grown;
}

/** The product on a transparent background plus where it is. */
async function cutout(img: HTMLImageElement) {
  const R = 320;
  const mask = await (await getSession()).run(img);
  const keep = keepMain(mask, R);
  const W = img.width;
  const H = img.height;
  const sc = Math.min(1, 1000 / Math.max(W, H));
  const w = Math.round(W * sc);
  const h = Math.round(H * sc);
  const base = pixels(img, w, h);
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  let area = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const mi = Math.min(R - 1, Math.floor((y / h) * R)) * R + Math.min(R - 1, Math.floor((x / w) * R));
    const m = keep[mi] ? mask[mi]! : 0;
    // a soft edge: below 0.35 nothing, above 0.65 solid
    const a = Math.max(0, Math.min(1, (m - 0.35) / 0.3));
    base.data[(y * w + x) * 4 + 3] = Math.round(a * 255);
    if (a > 0.5) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const cover = area / (w * h);
  if (x1 <= x0 || y1 <= y0 || cover < 0.04 || cover > 0.93) throw new Error('bad-cut');
  const full = document.createElement('canvas');
  full.width = w;
  full.height = h;
  full.getContext('2d')!.putImageData(base, 0, 0);
  const crop = document.createElement('canvas');
  crop.width = x1 - x0 + 1;
  crop.height = y1 - y0 + 1;
  crop.getContext('2d')!.drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return crop;
}

function dim(c: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, label: string) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  c.save();
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
  const head = (p: { x: number; y: number }, d: number) => {
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + d * ux * 22 + nx * 8, p.y + d * uy * 22 + ny * 8);
    c.lineTo(p.x + d * ux * 22 - nx * 8, p.y + d * uy * 22 - ny * 8);
    c.closePath();
    c.fill();
  };
  head(a, 1);
  head(b, -1);
  for (const p of [a, b]) {
    c.beginPath();
    c.moveTo(p.x + nx * 14, p.y + ny * 14);
    c.lineTo(p.x - nx * 14, p.y - ny * 14);
    c.stroke();
  }
  c.font = FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const w = c.measureText(label).width + 28;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  c.fillStyle = '#f4f1ecf2';
  c.beginPath();
  c.roundRect(mx - w / 2, my - 28, w, 56, 14);
  c.fill();
  c.fillStyle = INK;
  c.fillText(label, mx, my + 2);
  c.restore();
}

function scene(c: CanvasRenderingContext2D) {
  const wall = c.createLinearGradient(0, 0, 0, S);
  wall.addColorStop(0, '#f1ede7');
  wall.addColorStop(1, '#e2dcd2');
  c.fillStyle = wall;
  c.fillRect(0, 0, S, S);
  // marble slab: a top face (back edge narrower, front edge wider) and a thick front edge
  const yb = 820; // back edge
  const yf = 985; // front edge of the top face
  const th = 70; // thickness
  const topFace = () => {
    c.beginPath();
    c.moveTo(150, yb);
    c.lineTo(S - 150, yb);
    c.lineTo(S - 40, yf);
    c.lineTo(40, yf);
    c.closePath();
  };
  const g1 = c.createLinearGradient(0, yb, 0, yf);
  g1.addColorStop(0, '#e9e5de');
  g1.addColorStop(1, '#f9f7f3');
  c.fillStyle = g1;
  topFace();
  c.fill();
  c.save();
  topFace();
  c.clip();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    c.strokeStyle = rnd() > 0.7 ? '#7b7f8a55' : '#a3a6ae44';
    c.lineWidth = 1 + rnd() * 3.5;
    c.beginPath();
    let x = rnd() * S;
    let y = yb;
    c.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 220; y += 26 + rnd() * 30; c.lineTo(x, y); }
    c.stroke();
  }
  c.restore();
  c.fillStyle = '#cfc9be';
  c.beginPath();
  c.moveTo(40, yf);
  c.lineTo(S - 40, yf);
  c.lineTo(S - 40, yf + th);
  c.lineTo(40, yf + th);
  c.closePath();
  c.fill();
  c.strokeStyle = '#ffffffcc';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(40, yf);
  c.lineTo(S - 40, yf);
  c.stroke();
  return yb + 100; // where the product stands (on the top face)
}

export async function generateDimImage(imgs0: string[], dims: Dims, foot: string, onStep?: (m: string) => void, pick = ''): Promise<Blob> {
  // the owner picks the photo (no tape measure on it): only that one is used
  const imgs = pick && imgs0.includes(pick) ? [pick] : imgs0;
  if (!imgs.length) throw new Error('مفيش صور للمنتج');
  onStep?.('⏳ بختار أوضح صورة…');
  const loaded: HTMLImageElement[] = [];
  for (const u of imgs.slice(0, 10)) {
    try { loaded.push(await loadImg(u)); } catch { /* an image that does not open is skipped */ }
  }
  if (!loaded.length) throw new Error('مقدرتش أفتح صور المنتج');
  // no automatic «clearest photo» choice (it picked the one with the tape measure): the picked photo, else the first one
  const order = loaded.map((img) => ({ img, q: quality(img) }));
  // الطريقة الأساسية: صورة المنتج الحقيقية كاملة زي ما هي + المقاسات مرسومة على القطعة (السيرفر بيرسم) — من غير قص ولا فصل خلفية
  onStep?.('⏳ برسم المقاسات على صورة المنتج…');
  const best = order[0]!.img;
  // الصورة بتتبعت من المتصفح نفسه (هو فتحها خلاص) فمفيش مشكلة روابط
  const sc0 = Math.min(1, 1400 / Math.max(best.width, best.height));
  const bc = document.createElement('canvas');
  bc.width = Math.round(best.width * sc0);
  bc.height = Math.round(best.height * sc0);
  bc.getContext('2d')!.drawImage(best, 0, 0, bc.width, bc.height);
  const imgData = bc.toDataURL("image/jpeg", 0.85).split(',')[1] ?? '';
  const r = await within(api.post<{ data: string }>('/web/catalog/ai/dim-image', { imgData, w: dims.w ?? '', h: dims.h ?? '', d: dims.d ?? '', l: dims.l ?? '', t: dims.t ?? '', bw: dims.bw ?? '', bl: dims.bl ?? '', foot }), 75000, 'السيرفر اتأخر في رسم المقاسات (أكتر من دقيقة) — جرّب تاني بعد شوية');
  const bin = atob(r.data);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: 'image/jpeg' });
}

/** الطريقة القديمة (قص المنتج على رخامة) — مبقتش بتتستخدم */
export async function generateDimImageOld(imgs: string[], dims: Dims, foot: string, onStep?: (m: string) => void): Promise<Blob> {
  if (!imgs.length) throw new Error('مفيش صور للمنتج');
  const loaded: HTMLImageElement[] = [];
  for (const u of imgs.slice(0, 10)) {
    try { loaded.push(await loadImg(u)); } catch { /* skipped */ }
  }
  const order = loaded.map((img) => ({ img, q: quality(img) })).sort((a, b) => b.q - a.q).slice(0, 3);
  let cut: HTMLCanvasElement | null = null;
  for (const o of order) {
    try {
      onStep?.('⏳ بفصل المنتج عن الخلفية… (أول مرة بتاخد شوية)');
      cut = await cutout(o.img);
      break;
    } catch { /* try the next clearest photo */ }
  }
  if (!cut) throw new Error('مقدرتش أفصل المنتج عن الخلفية في أي صورة من الصور');
  onStep?.('⏳ برسم الصورة…');
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d')!;
  const floor = scene(c);
  // product size on the page: as big as the room around it allows (arrows need space on top and on the right)
  const maxW = 620;
  const maxH = 520;
  const k = Math.min(maxW / cut.width, maxH / cut.height);
  const pw = cut.width * k;
  const ph = cut.height * k;
  const px = (S - pw) / 2 - 40;
  const py = floor - ph;
  const sh = c.createRadialGradient(px + pw / 2, floor + 6, 10, px + pw / 2, floor + 6, pw * 0.65);
  sh.addColorStop(0, '#00000044');
  sh.addColorStop(1, '#00000000');
  c.save();
  c.translate(0, floor + 6);
  c.scale(1, 0.18);
  c.translate(0, -(floor + 6));
  c.fillStyle = sh;
  c.beginPath();
  c.arc(px + pw / 2, floor + 6, pw * 0.65, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.drawImage(cut, px, py, pw, ph);
  if (dims.w) dim(c, { x: px, y: py - 46 }, { x: px + pw, y: py - 46 }, `${dims.w} سم`);
  if (dims.h) dim(c, { x: px + pw + 60, y: py }, { x: px + pw + 60, y: py + ph }, `${dims.h} سم`);
  if (dims.d) {
    const t = `العمق ${dims.d} سم`;
    c.font = FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const w = c.measureText(t).width + 40;
    c.fillStyle = '#f4f1ecf2';
    c.beginPath();
    c.roundRect(60, py + ph / 2 - 30, w, 60, 16);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = INK;
    c.textAlign = 'left';
    c.fillText(t, 80, py + ph / 2 + 2);
  }
  c.fillStyle = '#6b5a45';
  c.font = '700 32px Cairo, Tahoma, Arial, sans-serif';
  c.textAlign = 'center';
  c.fillText(foot, S / 2, S - 42);
  c.font = '800 44px Cairo, Tahoma, Arial, sans-serif';
  c.fillStyle = '#9a6a1a';
  c.textAlign = 'right';
  c.fillText('ميكانيزم', S - 60, 80);
  c.font = '700 20px Arial';
  c.fillStyle = '#6b5a45';
  c.fillText('M E K A N I Z M', S - 62, 112);
  return await new Promise<Blob>((ok, bad) => cv.toBlob((b) => (b ? ok(b) : bad(new Error('مقدرتش أحفظ الصورة'))), 'image/jpeg', 0.9));
}
