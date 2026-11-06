/**
 * Arabic spelling variants for search: «مفصله» finds «مفصلة», «احمد» finds «أحمد», «مصطفي» finds «مصطفى».
 * Postgres `contains` compares letters as typed, so each word is tried in its common spellings.
 */
const STEPS: ((w: string) => string)[] = [
  (w) => w.replace(/[أإآ]/g, 'ا'),
  (w) => w.replace(/^ا/, 'أ'),
  (w) => w.replace(/^ا/, 'إ'),
  (w) => w.replace(/ة$/, 'ه'),
  (w) => w.replace(/ه$/, 'ة'),
  (w) => w.replace(/ى$/, 'ي'),
  (w) => w.replace(/ي$/, 'ى'),
];

export function arVariants(word: string): string[] {
  let out = new Set([word]);
  for (const f of STEPS) out = new Set([...out, ...[...out].map(f)]);
  return [...out].slice(0, 16);
}

/** `{ OR: [{ field: { contains: v } } …] }` for one word in every spelling. */
export const arContains = (field: string, word: string) => arVariants(word).map((v) => ({ [field]: { contains: v, mode: 'insensitive' as const } }));
