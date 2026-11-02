// Owner-chosen look of the store (set in /admin). Every color has a role; text colors are picked
// automatically from the background behind them unless the owner chooses one on purpose.
import { HEX, contrast, full, mix, onColor } from './theme-math';
import { woodById, woodFromHex, woodSvg, woodUrl, type Wood } from './woods';

export { HEX, contrast, full, lum, mix, onColor } from './theme-math';
export { WOOD_FAMILIES, WOOD_LIB, woodById, woodFromHex, woodUrl, type Wood } from './woods';

export const THEME_KEYS = ['accent', 'accentFg', 'bg', 'fg', 'card', 'cardFg', 'dark', 'darkFg', 'wood'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
/** Wood settings that are not colors: chosen finish id, how much wood (1..3), and the exact places it is applied. */
export const WOOD_KEYS = ['woodId', 'woodLvl', 'woodAt'] as const;
export type WoodKey = (typeof WOOD_KEYS)[number];
export type ThemeMap = Record<ThemeKey, string> & Partial<Record<WoodKey, string>>;

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

/** Rich, saturated accent colors for buttons (each one passes white-text contrast). */
export const ACCENTS: [string, string][] = [
  ['أخضر ميكانيزم', '#3cba2c'], ['زمردي', '#0e8f5b'], ['تركواز', '#0f8f94'], ['بترولي', '#1b7f9c'], ['أزرق ملكي', '#1e5bd9'], ['نيلي', '#3b3fc4'],
  ['بنفسجي', '#7c3aed'], ['عنابي', '#a3214a'], ['أحمر', '#d6342c'], ['برتقالي محروق', '#c2570c'], ['ذهبي', '#a9741a'], ['نحاسي', '#a6592f'],
  ['جوزي', '#6b4430'], ['فحمي', '#2c3036'],
];

/** Dark/glossy block colors: each one drives the glossy squares and dark panels. */
export const DARKS: [string, string][] = [
  ['بترولي (الأصلي)', '#0f2b3d'], ['بترولي فاتح', '#12506b'], ['أزرق ملكي', '#10264a'], ['أخضر غامق', '#0f3a2b'],
  ['بنفسجي غامق', '#2a1458'], ['عنابي', '#3a0f1f'], ['بني ذهبي', '#3b2a0b'], ['أسود', '#14181c'], ['جوز غامق', '#2b1a10'], ['فحمي دافئ', '#25221f'],
];

/** Wood board texture (vector, sharp on any screen). */
export const woodTex = (hex: string, seed = 0) => woodUrl(woodFromHex(hex), 960, 240, { seed });
/** Plain CSS for a small swatch of a wood. */
export const grain = (hex: string) => `${woodTex(hex)} center / cover, ${full(hex)}`;

/** The wood the owner chose: a library finish by id, or one built from a custom color. null = no wood. */
export function chosenWood(t: Partial<ThemeMap> | Record<string, unknown> | undefined): Wood | null {
  const id = String((t as Record<string, unknown>)?.woodId ?? '');
  if (id && woodById(id)) return woodById(id)!;
  const hex = String((t as Record<string, unknown>)?.wood ?? '');
  return HEX.test(hex) ? woodFromHex(hex) : null;
}

export const WOOD_AREAS: [string, string][] = [
  ['head', 'شريط الهيدر'], ['titles', 'عناوين الأقسام'], ['cards', 'حافة الكروت'], ['frame', 'إطار صور المنتجات'],
  ['nav', 'الشريط السفلي'], ['foot', 'الفوتر'], ['btn', 'الأزرار'], ['bg', 'خلفية الصفحة'],
];
/** Presets for «how much wood»: 1 = touches, 2 = the usual look, 3 = wood everywhere. */
export const WOOD_LEVELS: [string, string, string[]][] = [
  ['1', 'لمسات خفيفة', ['head', 'titles']],
  ['2', 'متوسط', ['head', 'titles', 'cards', 'frame', 'nav', 'foot']],
  ['3', 'كامل', ['head', 'titles', 'cards', 'frame', 'nav', 'foot', 'btn', 'bg']],
];
/** Where the wood is applied: the owner's own list if set, else the chosen level (default: medium). */
export function woodAreas(t: Partial<ThemeMap> | Record<string, unknown> | undefined): string[] {
  const at = String((t as Record<string, unknown>)?.woodAt ?? '');
  if (at) return at.split(',').filter(a => WOOD_AREAS.some(x => x[0] === a));
  const lvl = String((t as Record<string, unknown>)?.woodLvl ?? '2');
  return (WOOD_LEVELS.find(l => l[0] === lvl) ?? WOOD_LEVELS[1])[2];
}

/** Wood details for the store. Only added when the owner picks a wood; the colors of the site are never touched
 *  (except the optional «خلفية الصفحة» wood, which is a pale veneer behind the content). */
export function woodCss(wood: Wood, areas: string[]) {
  const on = (a: string) => areas.includes(a);
  const c = wood.tones[1], fg = onColor(c);
  const board = (seed: number, h = 240, o: { gloss?: boolean } = {}) => woodUrl(wood, 960, h, { seed, ...o });
  const plank = (seed: number, h = 240, o: { gloss?: boolean } = {}) => `background-color:${c};background-image:${board(seed, h, o)};background-size:100% 100%`;
  const screw = 'background:radial-gradient(circle at 35% 30%,#f6d77a,#b8862b 62%,#5a3d0c);box-shadow:0 1px 1px #0009';
  const out: string[] = [];
  if (on('head')) out.push(
    `.tb{position:relative}`,
    `.tb::after{content:"";position:absolute;inset:auto 0 0 0;height:10px;${plank(3, 120)};box-shadow:inset 0 1px 0 #ffffff66,0 3px 6px #0004;pointer-events:none}`,
  );
  if (on('titles')) out.push(
    `.sh h2{${plank(9, 120, { gloss: true })};color:${fg};padding:5px 22px;border-radius:8px;box-shadow:inset 0 1px 0 #ffffff66,inset 0 -2px 0 #0005,0 4px 10px #0003;text-shadow:0 1px 0 ${fg === '#ffffff' ? '#0007' : '#ffffff77'}}`,
    `.sh h2::before,.sh h2::after{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 10px;vertical-align:middle;font-size:0;${screw}}`,
  );
  if (on('cards')) out.push(
    `.card{position:relative}`,
    `.card::after{content:"";position:absolute;inset:auto 0 0 0;height:11px;${plank(5, 120)};box-shadow:inset 0 1px 0 #ffffff55;pointer-events:none;z-index:3}`,
  );
  if (on('frame')) out.push(
    `.card .imw::before{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;padding:7px;background:${woodUrl(wood, 640, 480, { seed: 13, gloss: true })} center/100% 100%;-webkit-mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;filter:drop-shadow(0 1px 2px #0006)}`,
  );
  if (on('nav')) out.push(
    `.nv::before{content:"";position:absolute;inset:0 0 auto 0;height:8px;${plank(9, 120)};box-shadow:inset 0 -1px 0 #0005;pointer-events:none}`,
  );
  if (on('foot')) out.push(
    `footer.ft{position:relative;border-top:0}`,
    `footer.ft::before{content:"";position:absolute;inset:0 0 auto 0;height:14px;${plank(17, 120, { gloss: true })};box-shadow:inset 0 -2px 0 #0006,0 2px 6px #0005}`,
  );
  if (on('btn')) out.push(
    `.pvadd,.btn-big,.go-cart{${plank(21, 120, { gloss: true })} !important;color:${fg} !important;border:0 !important;text-shadow:0 1px 0 ${fg === '#ffffff' ? '#0007' : '#ffffff77'};box-shadow:inset 0 1px 0 #ffffff66,inset 0 -2px 0 #0005,0 5px 12px #0003}`,
    `.add{border-color:${wood.tones[1]} !important;color:${wood.tones[0]} !important;background:${woodUrl({ ...wood, tones: [mix(wood.tones[0], '#fff', 0.78), mix(wood.tones[1], '#fff', 0.84), mix(wood.tones[2], '#fff', 0.9)] }, 480, 120, { seed: 23 })} center/100% 100% !important;font-weight:800}`,
  );
  if (on('bg')) {
    const pale: Wood = { ...wood, tones: [mix(wood.tones[0], '#ffffff', 0.82), mix(wood.tones[1], '#ffffff', 0.88), mix(wood.tones[2], '#ffffff', 0.92)], warp: wood.warp };
    out.push(`body{background-color:${pale.tones[1]};background-image:${woodUrl(pale, 1400, 900, { seed: 29 })};background-size:cover;background-attachment:fixed}`);
  }
  return out.join('\n');
}

/** Real wood / veneer samples (kept for the old one-hex setting): the library finish nearest to a hex. */
export const WOODS: [string, string][] = [
  ['جوز', '#6b4430'], ['زان', '#cfa56f'], ['بلوط', '#b88653'], ['ماهوجني', '#7a3426'],
  ['ونجي', '#3d2c24'], ['رماد', '#d4c3a1'], ['كرز', '#a4553a'], ['فحمي', '#2c2f33'],
];

/** A whole look from one wood: pale wood tint for pages, deep wood for buttons, dark wood for the glossy panels. */
export function woodTheme(w: Wood): Partial<ThemeMap> {
  const body = w.tones[1];
  let accent = body, i = 0;
  while (contrast(accent, '#ffffff') < 4.5 && i++ < 12) accent = mix(accent, '#000000', 0.1);
  return { wood: '', woodId: w.id, bg: mix(body, '#ffffff', 0.9), card: mix(body, '#ffffff', 0.97), accent, dark: mix(w.tones[0], '#0d1114', 0.55) };
}
export { woodSvg };
