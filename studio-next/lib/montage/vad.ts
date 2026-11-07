// قص السكتات: نقل حرفي لمنطق smart.js (vad / islands / حساب الفجوات) كدوال نقية بتشتغل في المتصفح وفي Node.
export type Span = [number, number];

/** أماكن الكلام الحقيقية من الصوت 16kHz (كل ٢٠ مللي). */
export function vad(f32: Float32Array): Span[] {
  const F = 320, n = Math.floor(f32.length / F);
  if (n < 10) return [];
  const E = new Float32Array(n);
  for (let i = 0; i < n; i++) { let a = 0; for (let j = i * F; j < (i + 1) * F; j++) a += f32[j] * f32[j]; E[i] = 10 * Math.log10(a / F + 1e-10); }
  const so = Array.from(E).sort((a, b) => a - b), fl = so[Math.floor(n * .05)], pk = so[Math.floor(n * .98)];
  const thr = Math.max(fl + 7, Math.min(fl + (pk - fl) * .2, pk - 22)), lo = thr - 3; // هستيريسس: الكلام الواطي مايتحسبش سكوت
  const I: Span[] = []; let st = -1;
  for (let i = 0; i <= n; i++) { const on = i < n && (st >= 0 ? E[i] > lo : E[i] > thr); if (on && st < 0) st = i; if (!on && st >= 0) { I.push([st * .02, i * .02]); st = -1; } }
  const M: Span[] = [];
  I.forEach(x => { const l = M[M.length - 1]; if (l && x[0] - l[1] < .3) l[1] = x[1]; else M.push([x[0], x[1]]); });
  return M.filter(x => x[1] - x[0] >= .06).map(x => [+Math.max(0, x[0] - .05).toFixed(2), +(x[1] + .1).toFixed(2)] as Span);
}

/** مستوى القص: [أقل سكتة تتشال، المسافة اللي تفضل قبل وبعد الكلام] */
export const GAPR: Record<number, [number, number]> = { 1: [1, .25], 2: [.6, .18], 3: [.4, .12] };
export const CUT_LEVELS: [number, string][] = [[3, 'قوي — من غير ولا سكتة'], [2, 'عادي'], [1, 'خفيف'], [0, 'من غير قص']];

/** دمج أماكن الكلام: أي سكوت أقصر من ٣٥٠ مللي جوه الجملة مايتقطعش. segs اختيارية (جمل الذكاء بدون صوت مكتشف). */
export function islands(v: Span[], segs: { s: number; e: number }[] = []): Span[] {
  const A: Span[] = v.map(x => [x[0], x[1]]);
  segs.forEach(g => { if (!A.some(x => x[0] < g.e && x[1] > g.s)) A.push([g.s, g.e]); });
  A.sort((a, b) => a[0] - b[0]);
  const M: Span[] = [];
  A.forEach(x => { const l = M[M.length - 1]; if (l && x[0] - l[1] < .35) l[1] = Math.max(l[1], x[1]); else M.push([x[0], x[1]]); });
  return M;
}

/** السكتات اللي هتتشال حسب المستوى (cut=1..3) من الصوت نفسه. */
export function silenceGaps(v: Span[], dur: number, cut: number, segs: { s: number; e: number }[] = []): Span[] {
  if (!cut || !v.length) return [];
  const [mn, pad] = GAPR[cut], sp = islands(v, segs), G: Span[] = []; let prev = 0;
  sp.forEach(x => { if (x[0] - prev > mn + (prev ? 2 * pad : pad)) G.push([prev ? prev + pad : 0, x[0] - pad]); prev = Math.max(prev, x[1]); });
  if (dur - prev > mn + .4) G.push([prev + pad + .15, dur]);
  return mergeGaps(G);
}

export function mergeGaps(G: Span[]): Span[] {
  G = [...G].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  G.forEach(g => { if (g[1] - g[0] < .05) return; const l = out[out.length - 1]; if (l && g[0] <= l[1] + .05) l[1] = Math.max(l[1], g[1]); else out.push([g[0], g[1]]); });
  return out;
}
