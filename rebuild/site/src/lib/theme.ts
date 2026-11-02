// Owner-chosen look of the store (set in /admin). Every color has a role; text colors are picked
// automatically from the background behind them unless the owner chooses one on purpose.
export const THEME_KEYS = ['accent', 'accentFg', 'bg', 'fg', 'card', 'cardFg', 'dark', 'darkFg'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export type ThemeMap = Record<ThemeKey, string>;

export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h.toLowerCase());

const rgb = (h: string) => full(h).slice(1).match(/../g)!.map(x => parseInt(x, 16));
export const lum = (h: string) => {
  const v = rgb(h).map(x => x / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
/** WCAG contrast ratio, 1 (none) .. 21 (black on white). */
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Readable text color for a given background: white or near-black, whichever contrasts more. */
export const onColor = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#14201a') ? '#ffffff' : '#14201a');
/** Mix `a` with `b` (t = share of b, 0..1). */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('');
};

/** Glossy petrol-style gradient stops from one dark base color (the original petrol: #0f2b3d / #1b5e7b / #2f6f8f). */
export const gloss = (dark: string) => (full(dark) === '#0f2b3d'
  ? { pa: '#0f2b3d', pb: '#1b5e7b', pl: '#2f6f8f' } // the original petrol, exactly
  : { pa: full(dark), pb: mix(dark, '#2f9fc4', 0.34), pl: mix(dark, '#7fc3dd', 0.4) });

export const DEFAULTS: ThemeMap = { accent: '#3cba2c', accentFg: '', bg: '#f3f4f6', fg: '', card: '#ffffff', cardFg: '', dark: '#0f2b3d', darkFg: '' };

/** Final colors with every automatic choice resolved (used by the store and the live preview). */
export function resolve(t: Partial<ThemeMap>) {
  const g = (k: ThemeKey) => (t[k] && HEX.test(t[k]!) ? full(t[k]!) : '');
  const accent = g('accent') || DEFAULTS.accent, bg = g('bg') || DEFAULTS.bg, card = g('card') || DEFAULTS.card, dark = g('dark') || DEFAULTS.dark;
  const fg = g('fg') || (g('bg') ? onColor(bg) : '#14201a');
  return {
    accent, bg, card, dark, fg,
    accentFg: g('accentFg') || onColor(accent),
    cardFg: g('cardFg') || (g('card') ? onColor(card) : fg),
    darkFg: g('darkFg') || onColor(dark),
    mut: mix(fg, bg, 0.4),
    line: mix(bg, fg, 0.12),
    ...gloss(dark),
  };
}

/** `:root{...}` body for the store; only what the owner changed is emitted so the untouched look stays as designed. */
export function cssVars(theme: Record<string, unknown>) {
  const t: Partial<ThemeMap> = {};
  for (const k of THEME_KEYS) { const v = String(theme?.[k] ?? ''); if (HEX.test(v)) t[k] = v; }
  if (!Object.keys(t).length) return '';
  const r = resolve(t), out: string[] = [];
  if (t.accent) out.push(`--accent:${r.accent}`);
  if (t.bg) out.push(`--bg:${r.bg}`, `--line:${r.line}`);
  if (t.bg || t.fg) out.push(`--fg:${r.fg}`, `--mut:${r.mut}`);
  if (t.card) out.push(`--card:${r.card}`);
  if (t.card || t.cardFg || t.bg || t.fg) out.push(`--card-fg:${r.cardFg}`);
  if (t.accent || t.accentFg) out.push(`--on-acc:${r.accentFg}`);
  if (t.dark) out.push(`--pa:${r.pa}`, `--pb:${r.pb}`, `--pl:${r.pl}`);
  if (t.dark || t.darkFg) out.push(`--dk-fg:${r.darkFg}`);
  return out.join(';');
}

/** Whole-look presets: one tap sets every color together. */
export const THEMES: { name: string; v: Partial<ThemeMap> }[] = [
  { name: 'الأصلي', v: {} },
  { name: 'بترولي لامع', v: { accent: '#1b7f9c', bg: '#eef3f5', card: '#ffffff', dark: '#0f2b3d' } },
  { name: 'داكن', v: { accent: '#3cba2c', bg: '#0f1a14', card: '#17261d', dark: '#0b1620' } },
  { name: 'ذهبي فاخر', v: { accent: '#b8862b', bg: '#f7f3ea', card: '#ffffff', dark: '#10202c' } },
  { name: 'أزرق', v: { accent: '#1e6fd9', bg: '#eef3fb', card: '#ffffff', dark: '#10264a' } },
  { name: 'بنفسجي', v: { accent: '#7c3aed', bg: '#f4f0fb', card: '#ffffff', dark: '#2a1458' } },
  { name: 'أحمر', v: { accent: '#d6342c', bg: '#faf1f0', card: '#ffffff', dark: '#3a0f0d' } },
];

/** Dark/glossy block colors: each one drives the glossy squares and dark panels. */
export const DARKS: [string, string][] = [
  ['بترولي (الأصلي)', '#0f2b3d'], ['بترولي فاتح', '#12506b'], ['أزرق ملكي', '#10264a'], ['أخضر غامق', '#0f3a2b'],
  ['بنفسجي غامق', '#2a1458'], ['عنابي', '#3a0f1f'], ['بني ذهبي', '#3b2a0b'], ['أسود', '#14181c'],
];
