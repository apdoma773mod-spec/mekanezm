// تحميل صور وفيديوهات القوالب: أي صيغة (آيفون HEIC، JPG، PNG، WebP، فيديو MOV/MP4)، تصغير ذكي عشان
// الآيفون مايقفلش من الذاكرة مع ٤٠ صورة، تاريخ التصوير من EXIF (للترتيب الزمني في قوالب الرحلة)، ونقطة تركيز
// تلقائية عشان القص مايقطعش المنتج.

export type Kind = 'img' | 'vid';
export interface Item {
  id: string; kind: Kind; src: CanvasImageSource; w: number; h: number; name: string;
  date: number;        // وقت التصوير (ms) — من EXIF لو موجود، وإلا وقت الملف
  cap: string;         // كلمة على الصورة (اختياري)
  fx: number; fy: number; // نقطة التركيز (٠..١)
  thumb: string;       // صورة مصغّرة dataURL للشبكة
  dur?: number;        // مدة الفيديو
  vel?: HTMLVideoElement;
}

export const MAX_ITEMS = 40;
const LONG = 1600;      // أطول ضلع بعد التصغير: كفاية لـ 1080×1920 ومريح لذاكرة الآيفون

const ext = (n: string) => (n.split('.').pop() || '').toLowerCase();
export const isHeicFile = (f: File) => /heic|heif/i.test(f.type) || ['heic', 'heif', 'hif'].includes(ext(f.name));
export const isVideoFile = (f: File) => /^video\//.test(f.type) || ['mov', 'mp4', 'm4v', 'webm', '3gp', 'mkv', 'avi', 'hevc'].includes(ext(f.name));
export const isImageFile = (f: File) => /^image\//.test(f.type) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif', 'hif', 'tif', 'tiff'].includes(ext(f.name));

function tiffDate(v: DataView, t: number): number {
  try {
    const le = v.getUint16(t) === 0x4949; if (!le && v.getUint16(t) !== 0x4D4D) return 0; const g16 = (p: number) => v.getUint16(p, le), g32 = (p: number) => v.getUint32(p, le);
    const read = (ifd: number, want: number[]): Record<number, number> => { const r: Record<number, number> = {}; const n = g16(t + ifd); for (let i = 0; i < n && i < 400; i++) { const e = t + ifd + 2 + i * 12, tag = g16(e); if (want.includes(tag)) r[tag] = g32(e + 8); } return r; };
    const str = (off: number) => { let s = ''; for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(t + off + i)); return s; };
    const i0 = read(g32(t + 4), [0x0132, 0x8769]); let ds = '';
    if (i0[0x8769]) { const ex = read(i0[0x8769], [0x9003, 0x9004]); if (ex[0x9003]) ds = str(ex[0x9003]); else if (ex[0x9004]) ds = str(ex[0x9004]); }
    if (!ds && i0[0x0132]) ds = str(i0[0x0132]);
    const m = ds.match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/); if (!m) return 0;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  } catch { return 0; }
}
/** تاريخ التصوير من EXIF: JPEG (APP1) أو HEIC/أي ملف تاني (بندوّر على «Exif» في أول وآخر الملف). بيرجع 0 لو مش موجود. */
export function exifDate(buf: ArrayBuffer): number {
  try {
    const v = new DataView(buf);
    if (v.byteLength > 4 && v.getUint16(0) === 0xFFD8) {
      let o = 2; const L = Math.min(v.byteLength, 262144);
      while (o + 4 < L) { const m = v.getUint16(o), len = v.getUint16(o + 2); if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) return tiffDate(v, o + 10); if ((m & 0xFF00) !== 0xFF00) break; o += 2 + len; }
      return 0;
    }
    const u = new Uint8Array(buf), scan = (from: number, to: number) => { for (let i = from; i < to - 10; i++) if (u[i] === 0x45 && u[i + 1] === 0x78 && u[i + 2] === 0x69 && u[i + 3] === 0x66 && u[i + 4] === 0 && u[i + 5] === 0 && ((u[i + 6] === 0x4D && u[i + 7] === 0x4D) || (u[i + 6] === 0x49 && u[i + 7] === 0x49))) { const d = tiffDate(v, i + 6); if (d) return d; } return 0; };
    return scan(0, Math.min(u.length, 1 << 20)) || (u.length > 1 << 20 ? scan(Math.max(1 << 20, u.length - (1 << 20)), u.length) : 0);
  } catch { return 0; }
}

/** نقطة التركيز: مركز ثِقل الحواف (التفاصيل) في نسخة صغيرة — المنتج غالبًا هو أكتر حتة فيها تفاصيل. */
export function focalPoint(rgba: Uint8ClampedArray, w: number, h: number): [number, number] {
  const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) g[i] = .299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2];
  let sx = 0, sy = 0, s = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, e = Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]);
    const cw = 1 - .6 * Math.hypot(x / w - .5, y / h - .5); // ميل خفيف ناحية النص
    const k = e * e * cw; sx += x * k; sy += y * k; s += k;
  }
  if (!s) return [.5, .5];
  const c = (v: number) => Math.max(.25, Math.min(.75, v)); // مانروحش لأطراف الصورة
  return [c(.5 + (sx / s / w - .5) * .8), c(.5 + (sy / s / h - .5) * .8)];
}

async function decodeImage(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' } as any); } catch { }
  return await new Promise((ok, no) => { const im = new Image(); const u = URL.createObjectURL(blob); im.onload = () => { ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error('decode')); }; im.src = u; });
}

async function heicToBitmap(f: Blob): Promise<ImageBitmap> {
  let lastErr: any = null;
  for (const load of [() => import('heic-to/next'), () => import('heic-to')]) {
    try { const m: any = await load(); return await m.heicTo({ blob: f, type: 'bitmap' }); } catch (e) { lastErr = e; }
  }
  throw new Error('تحويل صورة الآيفون (HEIC) فشل: ' + ((lastErr && lastErr.message) || 'صيغة مش مدعومة'));
}
async function heicToJpeg(f: Blob): Promise<Blob> {
  let lastErr: any = null;
  for (const load of [() => import('heic-to/next'), () => import('heic-to')]) {
    try { const m: any = await load(); return await m.heicTo({ blob: f, type: 'image/jpeg', quality: .92 }); } catch (e) { lastErr = e; }
  }
  throw new Error('تحويل صورة الآيفون (HEIC) فشل: ' + ((lastErr && lastErr.message) || 'صيغة مش مدعومة'));
}

function shrink(src: CanvasImageSource, w: number, h: number, long: number) {
  const k = Math.min(1, long / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, cw, ch); return c;
}

function thumbOf(src: CanvasImageSource, w: number, h: number): { url: string; f: [number, number] } {
  const t = shrink(src, w, h, 240), url = t.toDataURL('image/jpeg', .7);
  const s = shrink(t, t.width, t.height, 64), d = s.getContext('2d')!.getImageData(0, 0, s.width, s.height).data;
  return { url, f: focalPoint(d, s.width, s.height) };
}

let SEQ = 0;
async function loadImage(f: File): Promise<Item> {
  const buf = await f.arrayBuffer(); const date = exifDate(buf) || f.lastModified || Date.now();
  let blob: Blob = new Blob([buf], { type: f.type || 'image/jpeg' }), bmp: any = null;
  try { bmp = await decodeImage(blob); } catch { }
  if (!bmp && isHeicFile(f)) { try { bmp = await heicToBitmap(blob); } catch { blob = await heicToJpeg(blob); bmp = await decodeImage(blob); } }
  if (!bmp) { // آخر محاولة: يمكن HEIC بامتداد غلط
    try { blob = await heicToJpeg(new Blob([buf])); bmp = await decodeImage(blob); } catch { throw new Error('الصورة «' + f.name + '» مش بتتفتح (الصيغة: ' + (f.type || ext(f.name) || 'مش معروفة') + ')'); }
  }
  const w = bmp.width, h = bmp.height; const c = shrink(bmp, w, h, LONG); try { bmp.close && bmp.close(); } catch { }
  let src: CanvasImageSource = c; try { src = await createImageBitmap(c); c.width = c.height = 0; } catch { }
  const sw = (src as any).width || c.width, sh = (src as any).height || c.height, th = thumbOf(src, sw, sh);
  return { id: 'm' + (++SEQ), kind: 'img', src, w: sw, h: sh, name: f.name, date, cap: '', fx: th.f[0], fy: th.f[1], thumb: th.url };
}

async function loadVideo(f: File): Promise<Item> {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('webkit-playsinline', ''); v.loop = true; v.crossOrigin = 'anonymous';
  v.src = URL.createObjectURL(f);
  await new Promise<void>((ok, no) => {
    const to = setTimeout(() => no(new Error('الفيديو «' + f.name + '» بياخد وقت طويل يتفتح — جرّب فيديو أقصر')), 20000);
    v.onloadeddata = () => { clearTimeout(to); ok(); }; v.onerror = () => { clearTimeout(to); no(new Error('الفيديو «' + f.name + '» مش بيشتغل على المتصفح ده' + (/mov|hevc/i.test(ext(f.name) + f.type) ? ' (فيديو آيفون HEVC — افتح الستوديو من الآيفون نفسه أو صدّره من الآيفون بصيغة «الأكثر توافقًا»)' : ''))); };
    v.load();
  });
  try { v.currentTime = Math.min(.5, (v.duration || 1) / 3); await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); }); } catch { }
  const w = v.videoWidth, h = v.videoHeight;
  if (!w || !h) throw new Error('الفيديو «' + f.name + '» مافيهوش صورة على المتصفح ده (غالبًا HEVC من الآيفون على كروم ويندوز) — ارفعه من الآيفون');
  const th = thumbOf(v, w, h);
  // شاشة سودا بالكامل = الكروم مش قادر يفك الفيديو
  const probe = shrink(v, w, h, 16).getContext('2d')!.getImageData(0, 0, 16, 9).data; let lum = 0; for (let i = 0; i < probe.length; i += 4) lum += probe[i] + probe[i + 1] + probe[i + 2];
  if (lum === 0 && /mov|hevc/i.test(ext(f.name) + f.type)) throw new Error('الفيديو «' + f.name + '» بيظهر أسود (HEVC من الآيفون مش مدعوم على كروم ده) — ارفعه من الآيفون');
  return { id: 'm' + (++SEQ), kind: 'vid', src: v, vel: v, w, h, name: f.name, date: f.lastModified || Date.now(), cap: '', fx: th.f[0], fy: th.f[1], thumb: th.url, dur: v.duration || 0 };
}

/** تحميل ملفات كتير مع تقدّم، ٣ مع بعض. بيرجّع اللي اشتغل + أسباب اللي ماشتغلش بالظبط. */
export async function loadFiles(files: File[], prog: (done: number, total: number) => void): Promise<{ items: Item[]; errors: string[] }> {
  const items: Item[] = [], errors: string[] = []; let done = 0;
  const list = files.filter(f => { const ok = isVideoFile(f) || isImageFile(f) || !f.type; if (!ok) errors.push('«' + f.name + '» مش صورة ولا فيديو'); return ok; });
  const out: (Item | null)[] = new Array(list.length).fill(null);
  const run = async (f: File, i: number) => { try { out[i] = isVideoFile(f) ? await loadVideo(f) : await loadImage(f); } catch (e: any) { errors.push(e && e.message || String(e)); } done++; prog(done, list.length); };
  for (let i = 0; i < list.length; i += 3) await Promise.all(list.slice(i, i + 3).map((f, k) => run(f, i + k)));
  out.forEach(x => x && items.push(x));
  return { items, errors };
}

export function freeItem(it: Item) { try { if (it.vel) { it.vel.pause(); URL.revokeObjectURL(it.vel.src); } else (it.src as any).close && (it.src as any).close(); } catch { } }
