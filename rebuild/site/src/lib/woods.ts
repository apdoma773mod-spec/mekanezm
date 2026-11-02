// Real wood finishes drawn as vector textures (SVG turbulence = grain, rings, pores). No photo files, sharp at any
// screen density (4K included), and every finish has three real tones sampled from the actual wood / veneer.
import { full, mix } from './theme-math';

export type Wood = {
  id: string; name: string; family: string;
  /** dark (late wood / pores), mid (body), light (early wood). */
  tones: [string, string, string];
  /** Grain fineness along the board (higher = finer lines). */
  fy: number;
  /** How wavy the grain is. */
  warp: number;
  /** Visible growth rings («cathedral»), 0..1. */
  rings: number;
  /** Open pores (oak, ash, wenge), 0..1. */
  pores: number;
  /** Strong dark stripes (zebrano, wenge), 0..1. */
  stripes: number;
  seed: number;
};

const W = (id: string, name: string, family: string, a: string, b: string, c: string, fy: number, warp: number, rings: number, pores: number, stripes: number, seed: number): Wood =>
  ({ id, name, family, tones: [a, b, c], fy, warp, rings, pores, stripes, seed });

export const WOOD_FAMILIES = ['جوز', 'بلوط', 'أخشاب فاتحة', 'أخشاب دافية', 'أخشاب داكنة'] as const;

export const WOOD_LIB: Wood[] = [
  W('walnut-us', 'جوز أمريكي', 'جوز', '#34200f', '#573721', '#7a5236', 0.22, 46, 0.5, 0.15, 0.1, 4),
  W('walnut-eu', 'جوز أوروبي', 'جوز', '#4b2f1d', '#6f4a31', '#93694a', 0.2, 54, 0.45, 0.1, 0.05, 8),
  W('walnut-smoke', 'جوز مدخن', 'جوز', '#2a1a10', '#46301f', '#634632', 0.24, 40, 0.4, 0.15, 0.1, 12),
  W('oak-nat', 'بلوط طبيعي', 'بلوط', '#9a7040', '#c19863', '#dfbf8f', 0.3, 38, 0.55, 0.55, 0, 15),
  W('oak-gold', 'بلوط ذهبي', 'بلوط', '#a8702b', '#cf9a4f', '#e8c17f', 0.3, 40, 0.5, 0.5, 0, 21),
  W('oak-smoke', 'بلوط مدخن', 'بلوط', '#43301f', '#684e35', '#8d7154', 0.3, 36, 0.5, 0.55, 0, 25),
  W('oak-gray', 'بلوط رمادي', 'بلوط', '#645f57', '#8a8479', '#b0a99b', 0.3, 34, 0.5, 0.5, 0, 31),
  W('oak-white', 'بلوط مبيّض', 'بلوط', '#b3a186', '#d3c4a9', '#ebe0cc', 0.28, 34, 0.45, 0.45, 0, 35),
  W('beech', 'زان', 'أخشاب فاتحة', '#b0794c', '#d09f73', '#e7c298', 0.42, 30, 0.2, 0.1, 0, 41),
  W('ash', 'رماد', 'أخشاب فاتحة', '#bda57b', '#d8c4a0', '#ecdfc3', 0.26, 44, 0.7, 0.4, 0, 45),
  W('maple', 'قيقب', 'أخشاب فاتحة', '#d3b88c', '#e6d1a9', '#f4e6c6', 0.5, 22, 0.1, 0.05, 0, 51),
  W('birch', 'بتولا', 'أخشاب فاتحة', '#d1b78f', '#e4d1ae', '#f3e7cf', 0.46, 24, 0.12, 0.05, 0, 55),
  W('pine', 'صنوبر', 'أخشاب فاتحة', '#bf8f50', '#dcb375', '#efd29e', 0.28, 48, 0.6, 0.05, 0, 61),
  W('teak', 'تيك', 'أخشاب دافية', '#6f4a1f', '#9a6f35', '#bf9558', 0.32, 36, 0.35, 0.2, 0.05, 65),
  W('iroko', 'إيروكو', 'أخشاب دافية', '#5f4118', '#85602a', '#a8814a', 0.3, 40, 0.35, 0.2, 0.05, 71),
  W('cherry', 'كرز', 'أخشاب دافية', '#6e311b', '#9a4d2d', '#c07547', 0.34, 32, 0.4, 0.05, 0, 75),
  W('mahogany', 'ماهوجني', 'أخشاب دافية', '#431812', '#6c2b1f', '#8f4332', 0.3, 36, 0.4, 0.1, 0.1, 81),
  W('zebrano', 'زيبرانو', 'أخشاب دافية', '#4b3018', '#a07c48', '#cfae78', 0.12, 60, 0.2, 0.1, 0.85, 85),
  W('wenge', 'ونجي', 'أخشاب داكنة', '#17100b', '#2f2218', '#4a392b', 0.22, 40, 0.3, 0.45, 0.5, 91),
  W('rosewood', 'خشب الورد', 'أخشاب داكنة', '#321610', '#58281b', '#7d3e2c', 0.26, 44, 0.45, 0.1, 0.25, 95),
  W('ebony', 'أبانوس', 'أخشاب داكنة', '#0f0c0a', '#1c1613', '#302823', 0.4, 26, 0.1, 0.05, 0.1, 101),
  W('charcoal', 'فحمي', 'أخشاب داكنة', '#222224', '#38383b', '#4f4f53', 0.3, 30, 0.2, 0.3, 0, 105),
];

export const woodById = (id: string) => WOOD_LIB.find(w => w.id === id);

/** A wood built from any single color (custom pick): three tones around it and generic grain. */
export function woodFromHex(hex: string): Wood {
  const c = full(hex);
  return { id: 'custom', name: 'لون مخصص', family: '', tones: [mix(c, '#000000', 0.38), c, mix(c, '#ffffff', 0.3)], fy: 0.3, warp: 40, rings: 0.4, pores: 0.25, stripes: 0.05, seed: 7 };
}

const ch = (hex: string) => { const h = full(hex).slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const tbl = (tones: string[], k: number) => tones.map(t => ch(t)[k].toFixed(3)).join(' ');

/**
 * One board of this wood. `w x h` is the drawing size (the image is vector, so it stays sharp when scaled).
 * Layers: coloured grain streaks → growth rings (multiplied) → pores → stripes → soft light from the top.
 */
export function woodSvg(wood: Wood, w = 960, h = 320, o: { gloss?: boolean; seed?: number; vertical?: boolean } = {}) {
  const [d, m, l] = wood.tones, s = (o.seed ?? 0) + wood.seed;
  const ramp = [d, mix(d, m, 0.55), m, mix(m, l, 0.5), l];
  const bf = (x: number, y: number) => (o.vertical ? `${y} ${x}` : `${x} ${y}`);
  const warpF = bf(0.0028, 0.011);
  const grainF = bf(0.0024, wood.fy);
  const ringF = bf(0.0045, 0.05 + wood.rings * 0.04);
  const poreF = bf(0.05, 0.85);
  const stripeF = bf(0.0016, 0.07);
  const bands = Array.from({ length: 14 }, (_, i) => (i % 2 ? (1 - wood.rings * 0.34).toFixed(2) : '1')).join(' ');
  const stripe = Array.from({ length: 10 }, (_, i) => (i % 3 === 1 ? (1 - wood.stripes * 0.78).toFixed(2) : '1')).join(' ');
  const rot = o.vertical ? ' transform="rotate(90 0 0) translate(0 -' + w + ')"' : '';
  void rot;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
<defs>
<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${warpF}" numOctaves="2" seed="${s}" result="warp"/>
<feTurbulence type="fractalNoise" baseFrequency="${grainF}" numOctaves="5" seed="${s + 1}" result="n"/>
<feDisplacementMap in="n" in2="warp" scale="${wood.warp}" xChannelSelector="R" yChannelSelector="G" result="dn0"/>
<feGaussianBlur in="dn0" stdDeviation="0.9 0.4" result="dn"/>
<feColorMatrix in="dn" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="lum"/>
<feComponentTransfer in="lum" result="ctr"><feFuncR type="linear" slope="2.2" intercept="-0.6"/><feFuncG type="linear" slope="2.2" intercept="-0.6"/><feFuncB type="linear" slope="2.2" intercept="-0.6"/></feComponentTransfer>
<feComponentTransfer in="ctr" result="col"><feFuncR type="table" tableValues="${tbl(ramp, 0)}"/><feFuncG type="table" tableValues="${tbl(ramp, 1)}"/><feFuncB type="table" tableValues="${tbl(ramp, 2)}"/></feComponentTransfer>
<feTurbulence type="fractalNoise" baseFrequency="${ringF}" numOctaves="2" seed="${s + 2}" result="rn"/>
<feDisplacementMap in="rn" in2="warp" scale="${wood.warp * 1.6}" xChannelSelector="G" yChannelSelector="R" result="rd0"/>
<feGaussianBlur in="rd0" stdDeviation="0.8 0.8" result="rd"/>
<feColorMatrix in="rd" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="rl"/>
<feComponentTransfer in="rl" result="rb"><feFuncR type="table" tableValues="${bands}"/><feFuncG type="table" tableValues="${bands}"/><feFuncB type="table" tableValues="${bands}"/></feComponentTransfer>
<feBlend in="col" in2="rb" mode="multiply" result="withRings"/>
<feTurbulence type="fractalNoise" baseFrequency="${stripeF}" numOctaves="2" seed="${s + 3}" result="sn"/>
<feDisplacementMap in="sn" in2="warp" scale="${wood.warp * 2}" xChannelSelector="R" yChannelSelector="G" result="sd0"/>
<feGaussianBlur in="sd0" stdDeviation="1 1" result="sd"/>
<feColorMatrix in="sd" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="sl"/>
<feComponentTransfer in="sl" result="sb"><feFuncR type="discrete" tableValues="${stripe}"/><feFuncG type="discrete" tableValues="${stripe}"/><feFuncB type="discrete" tableValues="${stripe}"/></feComponentTransfer>
<feBlend in="withRings" in2="sb" mode="multiply" result="withStripes"/>
<feTurbulence type="fractalNoise" baseFrequency="${poreF}" numOctaves="1" seed="${s + 4}" result="pn"/>
<feColorMatrix in="pn" type="matrix" values="0 0 0 0 ${ch(d)[0].toFixed(3)} 0 0 0 0 ${ch(d)[1].toFixed(3)} 0 0 0 0 ${ch(d)[2].toFixed(3)} 9 0 0 0 ${(-6.2 - (1 - wood.pores) * 1.6).toFixed(2)}" result="pa"/>
<feComponentTransfer in="pa" result="pf"><feFuncA type="linear" slope="${(0.1 + wood.pores * 0.55).toFixed(2)}"/></feComponentTransfer>
<feMerge><feMergeNode in="withStripes"/><feMergeNode in="pf"/></feMerge>
</filter>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${o.gloss ? 0.22 : 0.1}"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
${o.gloss ? '<linearGradient id="gl" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' : ''}
</defs>
<rect width="${w}" height="${h}" fill="${m}"/>
<rect width="${w}" height="${h}" filter="url(#g)"/>
<rect width="${w}" height="${h}" fill="url(#s)"/>
${o.gloss ? `<rect width="${w}" height="${h}" fill="url(#gl)"/>` : ''}
</svg>`;
  return svg.replace(/\n/g, '');
}

/** CSS `url(...)` for a board of this wood. */
export const woodUrl = (wood: Wood, w = 960, h = 320, o: Parameters<typeof woodSvg>[3] = {}) =>
  `url("data:image/svg+xml,${encodeURIComponent(woodSvg(wood, w, h, o))}")`;
