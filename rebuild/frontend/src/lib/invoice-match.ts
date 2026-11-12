import type { ProductDto } from '@mk/shared';
import { vn } from './import-daily';

/**
 * The old purchase-invoice matcher (index.html «ميكانيزم — قارئ فواتير»: nameSim / best / matchRow / aliasPid):
 * 🟢 g = same saved supplier name or ≥ 0.82 similar, 🟡 y = ≥ 0.55 (check it), 🔴 r = new item / nothing close.
 */
export type Aliases = Record<string, Record<string, string>>;
export interface Match {
  pid: string | null;
  conf: 'g' | 'y' | 'r';
  src: 'alias' | 'fuzzy' | 'none';
  score: number;
  near?: string;
}

const NUMR = /\d+(?:\.\d+)?/g;
const bigrams = (s: string) => {
  const o: string[] = [];
  for (let i = 0; i < s.length - 1; i++) o.push(s.slice(i, i + 2));
  return o;
};
function tokSim(x: string, y: string): number {
  if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x))) return 0.88;
  if (x.length < 2 || y.length < 2) return 0;
  const a = bigrams(x);
  const b = bigrams(y);
  const m = new Map<string, number>();
  a.forEach((g) => m.set(g, (m.get(g) || 0) + 1));
  let h = 0;
  b.forEach((g) => {
    if ((m.get(g) ?? 0) > 0) {
      h++;
      m.set(g, (m.get(g) ?? 0) - 1);
    }
  });
  return (2 * h) / (a.length + b.length);
}
const wordsOf = (s: string) => vn(s).split(/[^؀-ۿa-z0-9.]+/).filter(Boolean);

export function nameSim(a: string, b: string): number {
  const A = vn(a);
  const B = vn(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const ta = wordsOf(A);
  const tb = wordsOf(B);
  const wa = ta.filter((x) => !/^\d/.test(x));
  const wb = tb.filter((x) => !/^\d/.test(x));
  const na = A.match(NUMR) || [];
  const nb = B.match(NUMR) || [];
  let pen = 1;
  if (na.length && nb.length) {
    const sa = new Set(na);
    const sb = new Set(nb);
    const c = [...sa].filter((x) => sb.has(x)).length;
    const u = new Set([...sa, ...sb]).size;
    pen = c === 0 ? 0.35 : c < u ? 0.78 : 1;
  } else if (na.length !== nb.length) pen = 0.88;
  if (!wa.length || !wb.length) return pen * (wa.length === wb.length ? 0.6 : 0.25);
  const dir = (X: string[], Y: string[]) => X.reduce((t, x) => t + Math.max(...Y.map((y) => tokSim(x, y))), 0) / X.length;
  const s1 = dir(wa, wb);
  const s2 = dir(wb, wa);
  return (0.6 * Math.min(s1, s2) + 0.4 * Math.max(s1, s2)) * pen;
}

export const normTxt = (s: unknown) => vn(s).replace(/\s+/g, ' ').trim();
export const normSup = (s: unknown) => normTxt(s) || '*';

export function best(text: string, code: string | undefined, all: ProductDto[]): { p: ProductDto; s: number }[] {
  const out: { p: ProductDto; s: number }[] = [];
  for (const p of all) {
    let s = nameSim(text, p.name);
    if (code && p.code && vn(code) === vn(p.code)) s = 1;
    if (s > 0.3) out.push({ p, s });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, 5);
}

/** The product this supplier's text was saved against (their own names first, then the shared «*»). */
export function aliasPid(al: Aliases, sup: string, text: string, code: string | undefined, all: ProductDto[]): string | null {
  for (const s of [normSup(sup), '*']) {
    const m = al[s] ?? {};
    const byCode = code ? m['#' + normTxt(code)] : undefined;
    if (byCode && all.some((p) => p.id === byCode)) return byCode;
    const byText = m[normTxt(text)];
    if (byText && all.some((p) => p.id === byText)) return byText;
  }
  return null;
}

export function matchRow(al: Aliases, sup: string, it: { text: string; code?: string }, all: ProductDto[]): Match {
  const a = aliasPid(al, sup, it.text, it.code, all);
  if (a) return { pid: a, conf: 'g', src: 'alias', score: 1 };
  const c = best(it.text, it.code, all);
  const t = c[0];
  if (t && t.s >= 0.82) return { pid: t.p.id, conf: 'g', src: 'fuzzy', score: t.s };
  if (t && t.s >= 0.55) return { pid: t.p.id, conf: 'y', src: 'fuzzy', score: t.s };
  return { pid: null, conf: 'r', src: 'none', score: t ? t.s : 0, near: t ? t.p.name : '' };
}
