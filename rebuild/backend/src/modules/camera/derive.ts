/**
 * «حضور» = أول مرة اتشاف النهارده، «انصراف» = آخر مرة اتشاف لو ما اتشافش تاني بعدها بـ gapHours ساعة.
 * (مفيش تسجيل لكل عبور — كل مرة بس بتتخزن «شوفته الساعة كذا».)
 */
export interface DerivedDay {
  inAt: Date | null;
  outAt: Date | null;
  /** still inside the gap — the worker may be seen again */
  outPending: boolean;
  seen: number;
}

/** The last sighting only counts as «انصراف» when it is clearly later than the first one. */
export const MIN_STAY_MS = 10 * 60_000;

export function deriveDay(times: Date[], gapHours: number, now: Date): DerivedDay {
  if (!times.length) return { inAt: null, outAt: null, outPending: false, seen: 0 };
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (last.getTime() - first.getTime() < MIN_STAY_MS) return { inAt: first, outAt: null, outPending: false, seen: sorted.length };
  const gone = now.getTime() - last.getTime() >= gapHours * 3_600_000;
  return { inAt: first, outAt: gone ? last : null, outPending: !gone, seen: sorted.length };
}

/** Cosine similarity, used only to match an unknown face against a few others. */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    d += a[i]! * b[i]!;
    x += a[i]! * a[i]!;
    y += b[i]! * b[i]!;
  }
  return x && y ? d / Math.sqrt(x * y) : 0;
}
