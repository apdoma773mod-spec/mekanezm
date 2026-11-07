/**
 * Real product photo as is + dimension lines/numbers drawn by code (no AI drawing, the part is never changed).
 * Each size is a line hugging the real edge of the part (two end points found by Gemini), a small tick at each end, and the number beside it.
 */
import { DIM_FONT_B64 } from './dim-font.js';

export type Slot = 'bottom' | 'right' | 'top' | 'left';
/** line = two end points on the part as fractions of the photo [x0,y0,x1,y1]; without it the line follows the part box on `slot`. */
export type DimSpec = { k: string; v: string; slot?: Slot; line?: [number, number, number, number] | null };

const COL = '#b8651b';
type Pt = { x: number; y: number };
type Fnt = { getAdvanceWidth(t: string, s: number): number; getPath(t: string, x: number, y: number, s: number): { toPathData(d: number): string } };
let fontP: Promise<Fnt> | null = null;
const loadFont = () =>
  (fontP ??= import('opentype.js').then((m) => {
    const b = Buffer.from(DIM_FONT_B64, 'base64');
    const o = (m as unknown as { default?: typeof m }).default ?? m;
    return o.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) as unknown as Fnt;
  }));

const toLatin = (t: string) => t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫|,/g, '.');
const valText = (v: string) => {
  const t = toLatin(v);
  const n = (t.match(/[0-9]+(?:\.[0-9]+)?/) || [''])[0];
  const u = /مم|ملم|mm/i.test(t) ? 'mm' : /بوصة|inch|"/i.test(t) ? 'in' : 'cm';
  return n + u;
};

export async function drawDimensions(photo: Buffer, specs: DimSpec[], _title = '', hint?: [number, number, number, number] | null, _foot = ''): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const font = await loadFont();
  const W = 1200,
    H = 900;
  const frame = { x: 40, y: 40, w: W - 80, h: H - 80 };
  const base = await sharp(photo).rotate().flatten({ background: '#ffffff' }).png().toBuffer();
  const bm = await sharp(base).metadata();
  const BW = bm.width ?? 1,
    BH = bm.height ?? 1;

  const withNum = specs.filter((s) => /[0-9٠-٩]/.test(s.v) && /(سم|مم|ملم|متر|بوصة|cm|mm|inch|")/i.test(s.v) && !/(حمولة|وزن|كجم|kg)/i.test(s.k + s.v)).slice(0, 6);

  // the part: every found end point (they sit on its edges), else the Gemini box, else the non-background area
  const ends = withNum.flatMap((s) => (s.line ? [[s.line[0], s.line[1]], [s.line[2], s.line[3]]] : []));
  let pb: [number, number, number, number] = hint && hint[2] - hint[0] > 0.05 && hint[3] - hint[1] > 0.05 ? hint : [0.1, 0.1, 0.9, 0.9];
  if (ends.length >= 2) pb = [Math.min(...ends.map((e) => e[0]!)), Math.min(...ends.map((e) => e[1]!)), Math.max(...ends.map((e) => e[0]!)), Math.max(...ends.map((e) => e[1]!))];
  else if (!hint) {
    try {
      const t = await sharp(base).trim({ threshold: 28 }).toBuffer({ resolveWithObject: true });
      const l = -(t.info.trimOffsetLeft ?? 0),
        tp = -(t.info.trimOffsetTop ?? 0);
      if (t.info.width > BW * 0.08 && t.info.height > BH * 0.08 && (t.info.width < BW * 0.9 || t.info.height < BH * 0.9)) pb = [l / BW, tp / BH, (l + t.info.width) / BW, (tp + t.info.height) / BH];
    } catch {
      /* keep full */
    }
  }
  const px = { x0: pb[0] * BW, y0: pb[1] * BH, x1: pb[2] * BW, y1: pb[3] * BH };
  const padX = Math.max(60, (px.x1 - px.x0) * 0.3),
    padY = Math.max(60, (px.y1 - px.y0) * 0.3);
  const cx0 = Math.max(0, Math.floor(px.x0 - padX)),
    cy0 = Math.max(0, Math.floor(px.y0 - padY)),
    cx1 = Math.min(BW, Math.ceil(px.x1 + padX)),
    cy1 = Math.min(BH, Math.ceil(px.y1 + padY));
  const crop = await sharp(base).extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 }).toBuffer();
  const sc = Math.min(frame.w / (cx1 - cx0), frame.h / (cy1 - cy0));
  const iw = Math.round((cx1 - cx0) * sc),
    ih = Math.round((cy1 - cy0) * sc);
  const img = await sharp(crop).resize(iw, ih).png().toBuffer();
  const fx = frame.x + Math.round((frame.w - iw) / 2),
    fy = frame.y + Math.round((frame.h - ih) / 2);
  const toC = (x: number, y: number): Pt => ({ x: fx + (x * BW - cx0) * sc, y: fy + (y * BH - cy0) * sc });
  const P0 = toC(pb[0], pb[1]),
    P1 = toC(pb[2], pb[3]);
  const centre: Pt = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
  const fB = { l: fx + 24, t: fy + 24, r: fx + iw - 24, b: fy + ih - 24 };

  const textSvg = (txt: string, size: number) => {
    const w = font.getAdvanceWidth(txt, size);
    const d = font.getPath(txt, 0, 0, size).toPathData(2);
    // (the renderer drops glyphs whose path coordinates are negative, so the centring is a translate)
    return `<g transform="translate(${(-w / 2).toFixed(2)} ${(size * 0.35).toFixed(2)})"><path d="${d}" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="${COL}"/></g>`;
  };
  const parts: string[] = [];
  const stack: Partial<Record<Slot, number>> = {};
  const draw = (A0: Pt, B0: Pt, txt: string, off: number) => {
    const L = Math.hypot(B0.x - A0.x, B0.y - A0.y) || 1;
    const ux = (B0.x - A0.x) / L,
      uy = (B0.y - A0.y) / L;
    let nx = -uy,
      ny = ux;
    // the line goes on the outer side of the part
    if (nx * ((A0.x + B0.x) / 2 - centre.x) + ny * ((A0.y + B0.y) / 2 - centre.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const clamp = (p: Pt): Pt => ({ x: Math.min(fB.r, Math.max(fB.l, p.x)), y: Math.min(fB.b, Math.max(fB.t, p.y)) });
    const A = clamp({ x: A0.x + nx * off, y: A0.y + ny * off }),
      B = clamp({ x: B0.x + nx * off, y: B0.y + ny * off });
    const tick = 11;
    parts.push(
      `<g stroke="${COL}" stroke-linecap="round">` +
        `<line x1="${A0.x}" y1="${A0.y}" x2="${A.x + nx * 6}" y2="${A.y + ny * 6}" stroke-width="1.6" opacity=".75"/><line x1="${B0.x}" y1="${B0.y}" x2="${B.x + nx * 6}" y2="${B.y + ny * 6}" stroke-width="1.6" opacity=".75"/>` +
        `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke-width="3"/>` +
        `<line x1="${A.x - nx * tick}" y1="${A.y - ny * tick}" x2="${A.x + nx * tick}" y2="${A.y + ny * tick}" stroke-width="3"/><line x1="${B.x - nx * tick}" y1="${B.y - ny * tick}" x2="${B.x + nx * tick}" y2="${B.y + ny * tick}" stroke-width="3"/></g>`,
    );
    let ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang <= -90) ang += 180;
    const mx = (A.x + B.x) / 2 + nx * 26,
      my = (A.y + B.y) / 2 + ny * 26;
    parts.push(`<g transform="translate(${mx} ${my}) rotate(${ang})">${textSvg(txt, 36)}</g>`);
  };

  for (const s of withNum) {
    const txt = valText(s.v);
    const slot = s.slot ?? 'bottom';
    const n = stack[slot] ?? 0;
    stack[slot] = n + 1;
    if (s.line) {
      draw(toC(s.line[0], s.line[1]), toC(s.line[2], s.line[3]), txt, 30 + n * 70);
      continue;
    }
    // no end points found: follow the part box on the wanted side
    const seg: [Pt, Pt] = slot === 'bottom' ? [{ x: P0.x, y: P1.y }, P1] : slot === 'top' ? [P0, { x: P1.x, y: P0.y }] : slot === 'right' ? [{ x: P1.x, y: P0.y }, P1] : [P0, { x: P0.x, y: P1.y }];
    draw(seg[0], seg[1], txt, 30 + n * 70);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: img, left: fx, top: fy }, { input: Buffer.from(svg) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
