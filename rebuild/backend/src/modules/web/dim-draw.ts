/**
 * Real product photo as is + dimension lines drawn by code (no AI drawing, the part is never changed).
 * The output is the photo itself with nothing around it: the site and the product card already put the ONE gold frame
 * and logo on every photo, so a second background + logo here made a frame inside a frame and a tiny product.
 * Each size: a thin line along the real edge of the part (two end points found by Gemini), a tick at each end, and the
 * number in a small dark tag that always reads horizontally (never rotated, never on top of the line or another tag).
 */
import { DIM_FONT_B64 } from './dim-font.js';

export type Slot = 'bottom' | 'right' | 'top' | 'left';
/** line = two end points on the part as fractions of the photo [x0,y0,x1,y1]; without it the line follows the part box on `slot`. */
export type DimSpec = { k: string; v: string; slot?: Slot; line?: [number, number, number, number] | null };

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
  return n + ' ' + u;
};

export async function drawDimensions(photo: Buffer, specs: DimSpec[], _title = '', hint?: [number, number, number, number] | null, _foot = ''): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const font = await loadFont();
  const base = await sharp(photo).rotate().flatten({ background: '#ffffff' }).png().toBuffer();
  const bm = await sharp(base).metadata();
  const BW = bm.width ?? 1,
    BH = bm.height ?? 1;
  // one working size for every photo, so lines and tags look the same on a phone photo and on a small one
  const sc = 1400 / Math.max(BW, BH);
  const W = Math.round(BW * sc),
    H = Math.round(BH * sc);
  const img = await sharp(base).resize(W, H).png().toBuffer();
  const raw = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const u = Math.min(W, H) / 1000; // drawing unit

  const withNum = specs.filter((s) => /[0-9٠-٩]/.test(s.v) && /(سم|مم|ملم|متر|بوصة|cm|mm|inch|")/i.test(s.v) && !/(حمولة|وزن|كجم|kg)/i.test(s.k + s.v)).slice(0, 6);

  // the part: the Gemini box, else every found end point (they sit on its edges), else the non-background area
  const ends = withNum.flatMap((s) => (s.line ? [[s.line[0], s.line[1]], [s.line[2], s.line[3]]] : []));
  let pb: [number, number, number, number] = hint && hint[2] - hint[0] > 0.05 && hint[3] - hint[1] > 0.05 ? hint : [0.1, 0.1, 0.9, 0.9];
  const eb: [number, number, number, number] | null = ends.length >= 2 ? [Math.min(...ends.map((e) => e[0]!)), Math.min(...ends.map((e) => e[1]!)), Math.max(...ends.map((e) => e[0]!)), Math.max(...ends.map((e) => e[1]!))] : null;
  const hasHint = !!hint && pb === hint;
  // مقاس واحد بس (زي الارتفاع) بيدّي خط رفيع مش «مكان القطعة»: ساعتها بنعتمد على مربع القطعة أو حدودها في الصورة
  if (!hasHint && eb && eb[2] - eb[0] > 0.08 && eb[3] - eb[1] > 0.08) pb = eb;
  else if (!hasHint) {
    try {
      const t = await sharp(base).trim({ threshold: 28 }).toBuffer({ resolveWithObject: true });
      const l = -(t.info.trimOffsetLeft ?? 0),
        tp = -(t.info.trimOffsetTop ?? 0);
      if (t.info.width > BW * 0.08 && t.info.height > BH * 0.08 && (t.info.width < BW * 0.9 || t.info.height < BH * 0.9)) pb = [l / BW, tp / BH, (l + t.info.width) / BW, (tp + t.info.height) / BH];
    } catch {
      /* keep full */
    }
  }
  const toC = (x: number, y: number): Pt => ({ x: x * W, y: y * H });
  const P0 = toC(pb[0], pb[1]),
    P1 = toC(pb[2], pb[3]);
  const centre: Pt = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
  const edge = 26 * u;
  const fB = { l: edge, t: edge, r: W - edge, b: H - edge };

  // is the photo light or dark under the line? decides the line colour (the other colour is its thin outline)
  const lumAt = (pts: Pt[]) => {
    let sum = 0,
      n = 0;
    for (const p of pts) {
      const x0 = Math.round(p.x),
        y0 = Math.round(p.y);
      for (let dy = -14; dy <= 14; dy += 7)
        for (let dx = -14; dx <= 14; dx += 7) {
          const x = x0 + dx,
            y = y0 + dy;
          if (x < 0 || y < 0 || x >= raw.info.width || y >= raw.info.height) continue;
          const i = (y * raw.info.width + x) * raw.info.channels;
          sum += 0.299 * raw.data[i]! + 0.587 * raw.data[i + 1]! + 0.114 * raw.data[i + 2]!;
          n++;
        }
    }
    return n ? sum / n : 128;
  };
  const parts: string[] = [];
  const tags: string[] = [];
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const stack: Partial<Record<Slot, number>> = {};
  const fs = 46 * u; // number size
  const f1 = (n: number) => n.toFixed(1);
  const tag = (cx: number, cy: number, txt: string, tw: number, w: number, h: number) => {
    const d = font.getPath(txt, 0, 0, fs).toPathData(2);
    // (the renderer drops glyphs whose path coordinates are negative, so the centring is a translate)
    tags.push(
      `<g transform="translate(${f1(cx - w / 2)} ${f1(cy - h / 2)})"><rect width="${f1(w)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="#14110e" fill-opacity=".9" stroke="#e3bd6c" stroke-width="${f1(2.5 * u)}"/><g transform="translate(${f1((w - tw) / 2)} ${f1(h / 2 + fs * 0.35)})"><path d="${d}" fill="#ffffff"/></g></g>`,
    );
  };
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
    const lum = lumAt([A, B, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }]);
    const ink = lum > 150 ? '#14110e' : '#ffffff',
      halo = lum > 150 ? '#ffffff' : '#14110e';
    const tick = 13 * u;
    const lines = (col: string, w: number, op: number) =>
      `<g stroke="${col}" stroke-opacity="${op}" stroke-width="${f1(w)}" stroke-linecap="round"><line x1="${f1(A0.x)}" y1="${f1(A0.y)}" x2="${f1(A.x)}" y2="${f1(A.y)}" stroke-width="${f1(w * 0.45)}"/><line x1="${f1(B0.x)}" y1="${f1(B0.y)}" x2="${f1(B.x)}" y2="${f1(B.y)}" stroke-width="${f1(w * 0.45)}"/><line x1="${f1(A.x)}" y1="${f1(A.y)}" x2="${f1(B.x)}" y2="${f1(B.y)}"/><line x1="${f1(A.x - nx * tick)}" y1="${f1(A.y - ny * tick)}" x2="${f1(A.x + nx * tick)}" y2="${f1(A.y + ny * tick)}"/><line x1="${f1(B.x - nx * tick)}" y1="${f1(B.y - ny * tick)}" x2="${f1(B.x + nx * tick)}" y2="${f1(B.y + ny * tick)}"/></g>`;
    parts.push(lines(halo, 8 * u, 0.75), lines(ink, 4 * u, 1));
    // the number: beside the line on its outer side, just far enough that the tag never sits on the line, kept inside the photo, never on another tag
    const tw = font.getAdvanceWidth(txt, fs);
    const w = tw + 34 * u,
      h = fs + 22 * u;
    const gap = 16 * u + Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2);
    const mid: Pt = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    let cx = mid.x + nx * gap,
      cy = mid.y + ny * gap;
    const fit = () => {
      cx = Math.min(W - edge - w / 2, Math.max(edge + w / 2, cx));
      cy = Math.min(H - edge - h / 2, Math.max(edge + h / 2, cy));
    };
    fit();
    const hits = () => taken.some((r) => Math.abs(r.x - cx) < (r.w + w) / 2 + 6 * u && Math.abs(r.y - cy) < (r.h + h) / 2 + 6 * u);
    for (let i = 1; i <= 8 && hits(); i++) {
      const step = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.abs(ux) * w + Math.abs(uy) * h) * 0.55;
      cx = mid.x + nx * gap + ux * step;
      cy = mid.y + ny * gap + uy * step;
      fit();
    }
    taken.push({ x: cx, y: cy, w, h });
    tag(cx, cy, txt, tw, w, h);
  };

  for (const s of withNum) {
    const txt = valText(s.v);
    const slot = s.slot ?? 'bottom';
    const n = stack[slot] ?? 0;
    stack[slot] = n + 1;
    if (s.line) {
      draw(toC(s.line[0], s.line[1]), toC(s.line[2], s.line[3]), txt, (26 + n * 60) * u);
      continue;
    }
    // no end points found: follow the part box on the wanted side
    const seg: [Pt, Pt] = slot === 'bottom' ? [{ x: P0.x, y: P1.y }, P1] : slot === 'top' ? [P0, { x: P1.x, y: P0.y }] : slot === 'right' ? [{ x: P1.x, y: P0.y }, P1] : [P0, { x: P0.x, y: P1.y }];
    draw(seg[0], seg[1], txt, (26 + n * 60) * u);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}${tags.join('')}</svg>`;
  return sharp(img)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
