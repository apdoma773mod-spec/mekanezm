// Product photos uploaded earlier have a gold frame (and an old logo) painted into the picture itself.
// The site now draws ONE frame with the official logo over every photo (see /frame.webp), so a photo
// that already carries a frame is cut back to the picture inside it. Photos without a frame pass through untouched.
import sharp from 'sharp';

const isGold = (r: number, g: number, b: number) => r > 165 && g > 100 && b < 175 && r - b > 55 && r - g < 95;

/** Index of the strongest line (>= min fraction) inside [from, to), or -1. */
function strongest(f: number[], from: number, to: number, min: number) {
  let best = -1, v = min;
  for (let i = Math.max(0, Math.ceil(from)); i < Math.min(f.length, Math.floor(to)); i++) if (f[i] > v) { v = f[i]; best = i; }
  return best;
}
/** Outside a real frame line (towards the image edge) there is white margin, not gold: rejects plain yellow or beige pictures. */
const margin = (f: number[], i: number, out: 1 | -1) => [6, 7].every(d => (f[i + out * d] ?? 0) < 0.4);

/** Pictures that were letterboxed on white inside the old frame: cut the white bars off so the photo fills the new frame. */
async function trimWhite(buf: Buffer): Promise<Buffer> {
  try {
    const m = await sharp(buf).metadata();
    const { data, info } = await sharp(buf).resize({ width: 300, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    const white = (x: number, y: number) => { const i = (y * w + x) * ch; return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 205; };
    const rowWhite = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (white(x, y)) n++; return n / w > 0.96; };
    const colWhite = (x: number) => { let n = 0; for (let y = 0; y < h; y++) if (white(x, y)) n++; return n / h > 0.96; };
    let t = 0, b = h - 1, l = 0, r = w - 1;
    while (t < b && rowWhite(t)) t++;
    while (b > t && rowWhite(b)) b--;
    while (l < r && colWhite(l)) l++;
    while (r > l && colWhite(r)) r--;
    const k = m.width! / w;
    const cw = Math.round((r - l + 1) * k), chh = Math.round((b - t + 1) * k);
    if (cw >= m.width! * 0.4 && chh >= m.height! * 0.4 && (cw < m.width! * 0.97 || chh < m.height! * 0.97))
      return await sharp(buf).extract({ left: Math.round(l * k), top: Math.round(t * k), width: Math.min(cw, m.width! - Math.round(l * k)), height: Math.min(chh, m.height! - Math.round(t * k)) }).toBuffer();
    return buf;
  } catch { return buf; }
}

export async function unframe(input: Buffer): Promise<Buffer> {
  try {
    const rot = await sharp(input).rotate().toBuffer();
    const { data, info } = await sharp(rot).resize({ width: 600, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    const gold = (x: number, y: number) => { const i = (y * w + x) * ch; return isGold(data[i], data[i + 1], data[i + 2]); };
    const row: number[] = [], col: number[] = [];
    const x0 = Math.round(w * 0.12), x1 = Math.round(w * 0.88), y0 = Math.round(h * 0.2), y1 = Math.round(h * 0.8);
    for (let y = 0; y < h; y++) { let n = 0; for (let x = x0; x < x1; x++) if (gold(x, y)) n++; row.push(n / (x1 - x0)); }
    for (let x = 0; x < w; x++) { let n = 0; for (let y = y0; y < y1; y++) if (gold(x, y)) n++; col.push(n / (y1 - y0)); }
    const top = strongest(row, h * 0.04, h * 0.2, 0.6), bottom = strongest(row, h * 0.84, h * 0.985, 0.6);
    const left = strongest(col, w * 0.015, w * 0.1, 0.6), right = strongest(col, w * 0.9, w * 0.985, 0.6);
    if (top < 0 || bottom < 0 || left < 0 || right < 0) return input;
    if (!margin(row, top, -1) || !margin(row, bottom, 1) || !margin(col, left, -1) || !margin(col, right, 1)) return input; // not a frame: leave as it is
    if (bottom - top < h * 0.5 || right - left < w * 0.6) return input;
    const k = info.width ? (await sharp(rot).metadata()).width! / w : 1;
    const inset = Math.round(w * 0.012);
    const L = Math.round((left + inset) * k), T = Math.round((top + inset) * k);
    const W = Math.round((right - left - 2 * inset) * k), H = Math.round((bottom - top - 2 * inset) * k);
    const cut = await sharp(rot).extract({ left: L, top: T, width: W, height: H }).toBuffer();
    return await trimWhite(cut);
  } catch {
    return input;
  }
}
