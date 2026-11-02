// Owner-chosen look of the store (set in /admin). Every color has a role; text colors are picked
// automatically from the background behind them unless the owner chooses one on purpose.
export const THEME_KEYS = ['accent', 'accentFg', 'bg', 'fg', 'card', 'cardFg', 'dark', 'darkFg', 'wood'] as const;
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

export const DEFAULTS: ThemeMap = { accent: '#3cba2c', accentFg: '', bg: '#f3f4f6', fg: '', card: '#ffffff', cardFg: '', dark: '#0f2b3d', darkFg: '', wood: '' };

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
    wood: g('wood'),
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

/** Wood board texture as a tiny vector image (SVG turbulence = real-looking grain, no photo files). */
export const woodTex = (hex: string, seed = 3) => {
  const c = full(hex), d = mix(c, '#000000', 0.62);
  const [r, g, b] = rgb(d).map(x => (x / 255).toFixed(3));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" preserveAspectRatio="none"><defs><filter id="w" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.28" numOctaves="4" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 2.4 0 0 0 -0.75"/></filter><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs><rect width="640" height="180" fill="${c}"/><rect width="640" height="180" filter="url(#w)"/><rect width="640" height="180" fill="url(#s)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
/** Plain CSS for the grain (used by small swatches). */
export const grain = (hex: string) => `${woodTex(hex)} center / cover, ${full(hex)}`;

/** Wood details for the store: header plank, section titles on a screwed plank, card edge banding, nav top edge.
 *  Only added when the owner picks a wood. Colors of the site are NOT touched. */
export function woodCss(hex: string) {
  const c = full(hex), fg = onColor(c), tex = woodTex(c), tex2 = woodTex(c, 9);
  const plank = (t: string) => `background-color:${c};background-image:${t};background-size:100% 100%`;
  const screw = 'background:radial-gradient(circle at 35% 30%,#f6d77a,#b8862b 62%,#5a3d0c);box-shadow:0 1px 1px #0009';
  return [
    `.tb{position:relative}`,
    `.tb::after{content:"";position:absolute;inset:auto 0 0 0;height:9px;${plank(tex)};box-shadow:inset 0 1px 0 #ffffff66,0 3px 6px #0004;pointer-events:none}`,
    `.sh h2{${plank(tex2)};color:${fg};padding:5px 22px;border-radius:8px;box-shadow:inset 0 1px 0 #ffffff66,inset 0 -2px 0 #0005,0 4px 10px #0003;text-shadow:0 1px 0 ${fg === '#ffffff' ? '#0007' : '#ffffff77'}}`,
    `.sh h2::before,.sh h2::after{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 10px;vertical-align:middle;font-size:0;${screw}}`,
    `.card{position:relative}`,
    `.card::after{content:"";position:absolute;inset:auto 0 0 0;height:10px;${plank(tex)};box-shadow:inset 0 1px 0 #ffffff55;pointer-events:none}`,
    `.nv::before{content:"";position:absolute;inset:0 0 auto 0;height:7px;${plank(tex2)};box-shadow:inset 0 -1px 0 #0005;pointer-events:none}`,
  ].join('\n');
}

/** Real wood / veneer samples. Each one builds a whole look: pale wood tint for pages, deep wood for buttons, dark wood for the glossy panels. */
export const WOODS: [string, string][] = [
  ['جوز', '#6b4430'], ['زان', '#cfa56f'], ['بلوط', '#b88653'], ['ماهوجني', '#7a3426'],
  ['ونجي', '#3d2c24'], ['رماد', '#d4c3a1'], ['كرز', '#a4553a'], ['فحمي', '#2c2f33'],
];
export function woodTheme(hex: string): Partial<ThemeMap> {
  const w = full(hex);
  let accent = w, i = 0;
  while (contrast(accent, '#ffffff') < 4.5 && i++ < 12) accent = mix(accent, '#000000', 0.1);
  return { wood: w, bg: mix(w, '#ffffff', 0.9), card: mix(w, '#ffffff', 0.97), accent, dark: mix(w, '#0d1114', 0.8) };
}
