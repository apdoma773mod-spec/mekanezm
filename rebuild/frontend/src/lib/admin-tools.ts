/** Small helpers for the admin screens: CSV export and a readable random password. */

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  // BOM so Excel opens the Arabic text correctly.
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 12 chars, no look-alikes (0/O, 1/l/I), always has upper, lower and a digit. */
export function generatePassword(length = 12): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789'];
  const all = sets.join('');
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;
  const out = sets.map((s) => s[rnd(s.length)]!);
  while (out.length < length) out.push(all[rnd(all.length)]!);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.join('');
}

/** 0-4 score for the strength meter. */
export function passwordStrength(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[A-Za-z]/.test(p)) s++;
  return Math.min(s, 4);
}

export const STRENGTH_LABELS = ['ضعيفة جدًا', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جدًا'];
