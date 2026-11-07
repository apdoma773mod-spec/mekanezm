// قص الإعادات والتهتهة + إعادة توزيع التوقيت على الصوت الحقيقي. نقل حرفي من smart.js، بس D بيتبعت كباراميتر.
import type { Span } from './vad';

export interface Seg { s: number; e: number; t: string; cut?: boolean; kw?: string[]; man?: boolean; dup?: boolean; ai?: boolean }
export interface Ev { s: number; e: number; type: string; label: string; value: string; unit: string; scene: string; action: string; on: boolean }
export interface Analysis { title: string; seg: Seg[]; ev: Ev[]; dur?: number; vad?: Span[]; ch?: Span[]; cs?: number; rt?: number }

export const en = (t: unknown) => String(t == null ? '' : t).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
export const norm = (w: string) => String(w).replace(/[ً-ْـ.,،؟!?:؛"«»()]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
export const TK = (t: string) => norm(t).split(/\s+/).filter(w => w.length > 1);
const META = /(استن[يى]\s*(نعيد|اعيد|ثانيه)|نعيد|هعيد|اعيد تاني|كده تمام|غلطت|ايه ده)/;
const FILL = new Set(['ايه', 'يعني', 'اه', 'ام', 'امم', 'اممم', 'ااا', 'اها', 'ايوه', 'كده', 'طيب', 'بقي', 'هو']);

/** تكرار: الجملة الأقدم تتشال لو اللي بعدها بتقول نفس الكلام تقريبًا — وتفضل آخر مرة بس. تهتهة: جملة قصيرة هي أول كلام جملة جاية. */
export function markRepeats(D: Analysis) {
  const S = D.seg || [], T = S.map(g => TK(g.t));
  for (let i = 0; i < S.length; i++) {
    const A = T[i]; if (S[i].man || A.length < 2) continue; const a = new Set(A);
    for (let j = i + 1; j < S.length && S[j].s - S[i].e < 120; j++) {
      const B = T[j]; if (!B.length) continue; let hit = 0; a.forEach(w => { if (B.includes(w)) hit++; }); const cov = hit / a.size;
      const full = A.length >= 4 && cov >= .75 && B.length >= A.length * .7;
      const pre = A.length <= 6 && B.length > A.length && S[j].s - S[i].e < 25 && A.slice(0, Math.min(3, A.length)).every((w, k) => B[k] === w);
      const near = S[j].s - S[i].e < 12 && A.length >= 3 && cov >= .9 && B.length >= A.length;
      if (full || pre || near) { S[i].dup = true; S[i].cut = true; break; }
    }
  }
}

/** علامات «تتشال» من الذكاء: بنصدّقها بس لو إعادة فعلًا أو تهتهة من غير معنى أو كلام للمصوّر. */
export function sanitizeCuts(D: Analysis) {
  if (!D || D.cs === 2) return; const S = D.seg || [];
  S.forEach(g => { g.ai = !!g.cut; if (!g.man) g.cut = false; }); markRepeats(D);
  const T = S.map(g => TK(g.t));
  S.forEach((g, i) => {
    if (g.man || g.dup || !g.ai) return; const A = T[i], n = norm(g.t);
    if (META.test(n) || (A.length && A.length <= 4 && A.every(w => FILL.has(w)))) { g.cut = true; return; }
    const a = new Set(A);
    for (let j = i + 1; j < S.length && S[j].s - g.e < 60; j++) { let hit = 0; a.forEach(w => { if (T[j].includes(w)) hit++; }); if (a.size >= 3 && hit / a.size >= .5) { g.cut = true; break; } }
  });
  D.cs = 2;
}

/** مدى الجملة اللي هتتشال: على حدود الصوت الحقيقي جواها، ومايتعداش ±٠٫١٢ ثانية من تقدير الذكاء. */
export function takeRange(D: Analysis, g: Seg): Span {
  const m = (D.vad || []).filter(x => { const c = (x[0] + x[1]) / 2; return c >= g.s - .05 && c <= g.e + .05; });
  if (!m.length) return [Math.max(0, g.s - .04), g.e + .04];
  return [Math.max(0, Math.max(g.s - .12, Math.min(g.s, m[0][0])) - .02), Math.min(g.e + .12, Math.max(g.e, m[m.length - 1][1])) + .02];
}

/** توزيع الكلام على أماكن الصوت الحقيقية جوه كل جزء (على حسب طول الكلمات) + تحريك الأحداث معاه. */
export function retime(D: Analysis) {
  if (!D || !D.vad || !D.vad.length || D.rt || !(D.seg || []).length) return;
  const chs: Span[] = (D.ch && D.ch.length) ? D.ch : [[0, D.dur || 1e9]], pairs: [number, number][] = [];
  chs.forEach(([a, b]) => {
    const G = D.seg.filter(g => g.s >= a - .01 && g.s < b), SP = D.vad!.map(x => [Math.max(a, x[0]), Math.min(b, x[1])] as Span).filter(x => x[1] - x[0] > .05);
    if (!G.length || !SP.length) return;
    const T = SP.reduce((s, x) => s + x[1] - x[0], 0), W = G.map(g => Math.max(1, g.t.replace(/\s+/g, '').length + g.t.split(/\s+/).length)), tot = W.reduce((s, x) => s + x, 0);
    const at = (q: number) => { let r = q * T; for (const x of SP) { const L = x[1] - x[0]; if (r <= L) return x[0] + r; r -= L; } return SP[SP.length - 1][1]; };
    let c = 0; G.forEach((g, i) => { const ns = at(c / tot); c += W[i]; const ne = at(c / tot); pairs.push([g.s, ns]); g.s = +ns.toFixed(2); g.e = +Math.max(ns + .3, ne).toFixed(2); });
  });
  pairs.sort((x, y) => x[0] - y[0]);
  const map = (t: number) => {
    if (!pairs.length) return t; if (t <= pairs[0][0]) return Math.max(0, pairs[0][1] - (pairs[0][0] - t));
    for (let i = 1; i < pairs.length; i++) if (t <= pairs[i][0]) { const [a0, a1] = pairs[i - 1], [b0, b1] = pairs[i]; return a1 + (b1 - a1) * ((t - a0) / Math.max(.01, b0 - a0)); }
    const l = pairs[pairs.length - 1]; return l[1] + (t - l[0]);
  };
  (D.ev || []).forEach(x => { const d = Math.max(0, (x.e || 0) - x.s), ns = map(x.s); x.s = +ns.toFixed(2); x.e = d ? +(ns + d).toFixed(2) : 0; });
  D.rt = 1;
}

/** الفجوات الكاملة: سكتات من الصوت + جمل الإعادة (لو takes) — نفس ترتيب build() القديم. */
export function allGaps(D: Analysis, silence: Span[], takes: boolean): Span[] {
  const G: Span[] = [...silence];
  if (takes) (D.seg || []).forEach(g => { if (g.cut) G.push(takeRange(D, g)); });
  return G;
}
