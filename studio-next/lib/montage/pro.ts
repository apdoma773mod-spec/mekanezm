// ٥ أدوات احترافية للمونتاج الذكي (دوال نقية — بتتختبر في Node وبتشتغل في المتصفح):
//  ١) معايرة الصوت  ٢) كاشف الهوك  ٣) مدرّب الإيقاع  ٤) أفضل لقطة غلاف  ٥) فحص ما قبل النشر لكل منصة
import type { Span } from './vad';
const norm = (w: string) => String(w).replace(/[ً-ْـ.,،؟!?:؛"«»()]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

type Seg = { s: number; e: number; t: string; cut?: boolean; kw?: string[] };

/* ───── ١) معايرة الصوت: نخلّي الكلام على مستوى منصات التواصل (~ −16 dBFS RMS) من غير ما يعمل كليب ───── */
export const TARGET_DB = -16;
export function speechRmsDb(f32: Float32Array, speech: Span[]): number {
  let sum = 0, n = 0;
  for (const [a, b] of speech) { const i0 = Math.max(0, Math.floor(a * 16000)), i1 = Math.min(f32.length, Math.floor(b * 16000)); for (let i = i0; i < i1; i++) { sum += f32[i] * f32[i]; n++; } }
  if (!n) return -60; return 10 * Math.log10(sum / n + 1e-12);
}
export function peakOf(f32: Float32Array): number { let p = 0; for (let i = 0; i < f32.length; i++) { const v = Math.abs(f32[i]); if (v > p) p = v; } return p; }
/** معامل التكبير للصوت: يوصّل الكلام للمستوى المطلوب، بحد أقصى ×٤ وحد أدنى ×٠٫٦، وما يخليش الذروة تعدّي ٠٫٩ بعد الضغط (الكومبريسور بيخفّضها). */
export function loudGain(f32: Float32Array, speech: Span[]): { gain: number; db: number } {
  const db = speechRmsDb(f32, speech), want = Math.pow(10, (TARGET_DB - db) / 20);
  return { gain: +Math.max(0.6, Math.min(4, want)).toFixed(2), db: +db.toFixed(1) };
}

/* ───── ٢) كاشف الهوك: أقوى جملة تفتح بيها الفيديو ───── */
const POWER = ['سر', 'اسرار', 'غلط', 'غلطه', 'متعملش', 'ماتعملش', 'ممنوع', 'احذر', 'خطر', 'مجانا', 'ببلاش', 'ضمان', 'اوفر', 'اغلي', 'ارخص', 'افضل', 'احسن', 'اسوا', 'مستحيل', 'اكتشف', 'خلي بالك', 'قبل ما', 'لو انت', 'ليه', 'ازاي', 'كام', 'بكام', 'اول مره', 'حصري', 'جديد', 'صدمه', 'وفر', 'خصم', 'هتخسر', 'هتكسب'];
export interface Hook { i: number; text: string; score: number; why: string[] }
export function findHooks(seg: Seg[], limit = 3): Hook[] {
  const out: Hook[] = [];
  seg.forEach((g, i) => {
    if (g.cut || g.s > 90) return; const t = g.t.trim(), n = norm(t), words = t.split(/\s+/).filter(Boolean), why: string[] = []; let sc = 0;
    if (words.length < 3 || words.length > 14) return;
    if (/[؟?]/.test(t) || /^(ليه|ازاي|هل|مين|ايه|كام|بكام)\b/.test(n)) { sc += 28; why.push('سؤال بيشدّ المشاهد'); }
    if (/[0-9٠-٩]/.test(t)) { sc += 18; why.push('فيه رقم'); }
    const hits = POWER.filter(p => n.includes(p)); if (hits.length) { sc += Math.min(30, 14 * hits.length); why.push('كلمة جذب: ' + hits[0]); }
    if (words.length >= 4 && words.length <= 9) { sc += 14; why.push('قصيرة ومركّزة'); }
    if (g.s < 20) sc += 8;
    if (g.kw && g.kw.length) sc += 6;
    if (sc > 0) out.push({ i, text: t, score: sc, why });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ───── ٣) مدرّب الإيقاع: كلمات في الثانية + أماكن الملل ───── */
export interface Pace { wps: number; slow: [number, number][]; fast: [number, number][]; deadPct: number; tips: string[] }
export function paceReport(seg: Seg[], dur: number, gaps: Span[]): Pace {
  const live = seg.filter(g => !g.cut), tips: string[] = [], slow: [number, number][] = [], fast: [number, number][] = [];
  const words = live.reduce((n, g) => n + g.t.split(/\s+/).filter(Boolean).length, 0), removed = gaps.reduce((s, g) => s + g[1] - g[0], 0), out = Math.max(1, dur - removed);
  const wps = +(words / out).toFixed(2);
  live.forEach(g => { const d = Math.max(.4, g.e - g.s), w = g.t.split(/\s+/).filter(Boolean).length / d; if (d >= 6 && w < 1.3) slow.push([g.s, g.e]); else if (w > 4.2) fast.push([g.s, g.e]); });
  const deadPct = Math.round(100 * Math.max(0, 1 - live.reduce((s, g) => s + Math.max(0, g.e - g.s), 0) / Math.max(1, dur)));
  if (wps < 1.8) tips.push('الإيقاع بطيء — ارفع «شيل السكتات» لقوي');
  if (wps > 3.8) tips.push('الإيقاع سريع — الكابشن مش هيلحق يتقري');
  if (slow.length) tips.push('فيه ' + slow.length + ' جزء بطيء — قصّه أو حط عليه فيديو إدراج');
  if (fast.length) tips.push('فيه ' + fast.length + ' جزء سريع جدًا — وسّع الكابشن عنده');
  if (out > 75) tips.push('أطول من ٧٥ ثانية — الريلز بتنجح أكتر لو أقصر');
  return { wps, slow, fast, deadPct, tips };
}

/* ───── ٤) أفضل لقطة غلاف: حدّة + إضاءة متوازنة ───── */
/** درجة اللقطة من بيانات RGBA (w×h): تباين لابلاسيان (الحدّة) × معامل إضاءة (أحسن حاجة متوسط ~٩٠-١٦٠). */
export function frameScore(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): number {
  const g = new Float32Array(w * h); let mean = 0;
  for (let i = 0; i < w * h; i++) { const v = .299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2]; g[i] = v; mean += v; }
  mean /= w * h; let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const l = 4 * g[y * w + x] - g[y * w + x - 1] - g[y * w + x + 1] - g[(y - 1) * w + x] - g[(y + 1) * w + x]; s += l * l; n++; }
  const sharp = s / Math.max(1, n), light = mean < 60 ? mean / 60 : mean > 190 ? Math.max(0.2, 1 - (mean - 190) / 100) : 1;
  return sharp * light;
}
/** أوقات مرشحة للغلاف: أول كلمة من كل جملة مش مقصوصة، متوزعة، بعيد عن أول ٠٫٥ ثانية. */
export function coverCandidates(seg: Seg[], n = 9): number[] {
  const L = seg.filter(g => !g.cut && g.s > .5).map(g => +(g.s + Math.min(.6, (g.e - g.s) / 3)).toFixed(2));
  if (L.length <= n) return L; const step = L.length / n; return Array.from({ length: n }, (_, k) => L[Math.floor(k * step)]);
}

/* ───── ٥) فحص ما قبل النشر لكل منصة ───── */
export interface Platform { id: string; name: string; max: number; ratio: string }
export const PLATFORMS: Platform[] = [
  { id: 'tt', name: 'تيك توك', max: 180, ratio: '9:16' }, { id: 'ig', name: 'ريلز إنستجرام', max: 90, ratio: '9:16' },
  { id: 'yts', name: 'يوتيوب شورتس', max: 60, ratio: '9:16' }, { id: 'fb', name: 'فيسبوك ريلز', max: 90, ratio: '9:16' }, { id: 'sc', name: 'سناب سبوتلايت', max: 60, ratio: '9:16' },
];
export interface QA { ok: string[]; warn: string[]; platforms: { id: string; name: string; fit: boolean }[]; cps: number }
/** CPS = حروف في الثانية: معيار الترجمة العالمي ≤ ١٧. بنفحص كل كابشن + المدة + طول العنوان + صوت كليب. */
export function preflight(o: { seg: Seg[]; outDur: number; title?: string; peak?: number; aspect?: string; hasCap?: boolean }): QA {
  const ok: string[] = [], warn: string[] = [], live = o.seg.filter(g => !g.cut);
  const worst = live.reduce((m, g) => Math.max(m, g.t.replace(/\s+/g, '').length / Math.max(.4, g.e - g.s)), 0);
  if (o.hasCap !== false) { if (worst > 17) warn.push('فيه جملة كابشنها سريع (' + Math.round(worst) + ' حرف/ثانية — الحد ١٧)'); else ok.push('سرعة الكابشن مريحة'); }
  if (o.title && o.title.length > 42) warn.push('العنوان طويل (أكتر من ٤٢ حرف) — هيتقص'); else if (o.title) ok.push('العنوان مناسب');
  if ((o.peak ?? 0) > 0.98) warn.push('الصوت قريب من الكليب — قلّل الصوت الأصلي'); else ok.push('الصوت سليم');
  if (o.aspect && o.aspect !== '916') warn.push('المقاس مش عمودي — الريلز وتيك توك بيحبوا ٩:١٦'); else ok.push('المقاس عمودي ٩:١٦');
  if (live.length < 2) warn.push('الكلام قليل — اعمل التحليل الأول');
  const platforms = PLATFORMS.map(p => ({ id: p.id, name: p.name, fit: o.outDur <= p.max }));
  const tooLong = platforms.filter(p => !p.fit).map(p => p.name);
  if (tooLong.length) warn.push('أطول من حد: ' + tooLong.join('، ')); else ok.push('المدة مناسبة لكل المنصات');
  return { ok, warn, platforms, cps: +worst.toFixed(1) };
}
