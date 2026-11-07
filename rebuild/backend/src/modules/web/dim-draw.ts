/**
 * Real product photo as is + dimension lines/numbers/arrows drawn by code (no AI drawing, the part is never changed).
 * Callouts come from the product specs that contain a number (width / height / depth / mounting sizes).
 */
export type DimSpec = { k: string; v: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

type Slot = 'bottom' | 'right' | 'top' | 'left';
const pickSlot = (k: string, used: Set<Slot>): Slot | null => {
  const pref: Slot[] = /ارتفاع|height|طول الضلفة/i.test(k) ? ['right', 'left'] : /عمق|depth|سمك/i.test(k) ? ['top', 'bottom'] : ['bottom', 'top'];
  for (const s of [...pref, 'bottom', 'right', 'top', 'left'] as Slot[]) if (!used.has(s)) return s;
  return null;
};

export async function drawDimensions(photo: Buffer, specs: DimSpec[], title = '', hint?: [number, number, number, number] | null, foot = ''): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const W = 1200,
    H = 900;
  const frame = { x: 60, y: 90, w: W - 120, h: H - 150 };
  const base = await sharp(photo).rotate().flatten({ background: '#ffffff' }).png().toBuffer();
  const bm = await sharp(base).metadata();
  const BW = bm.width ?? 1,
    BH = bm.height ?? 1;
  // the metal part itself: Gemini box (fractions x0,y0,x1,y1) if given, else the non-background area
  let pb: [number, number, number, number] = hint && hint[2] - hint[0] > 0.05 && hint[3] - hint[1] > 0.05 ? hint : [0.1, 0.1, 0.9, 0.9];
  if (!hint) {
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
  const padX = (px.x1 - px.x0) * 0.32,
    padY = (px.y1 - px.y0) * 0.32;
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
  // product edges in canvas coordinates: the dimension lines sit right on the part
  const x0 = fx + Math.round((px.x0 - cx0) * sc),
    x1 = fx + Math.round((px.x1 - cx0) * sc),
    y0 = fy + Math.round((px.y0 - cy0) * sc),
    y1 = fy + Math.round((px.y1 - cy0) * sc);
  const fL = fx,
    fT = fy,
    fR = fx + iw,
    fB = fy + ih;

  const withNum = specs.filter((s) => /[0-9٠-٩]/.test(s.v) && /(سم|مم|ملم|متر|بوصة|cm|mm|inch|")/i.test(s.v) && !/(حمولة|وزن|كجم|kg)/i.test(s.k + s.v)).slice(0, 4);
  const used = new Set<Slot>();
  const col = '#c0392b';
  const parts: string[] = [];
  const arrow = (ax: number, ay: number, bx: number, by: number) => {
    const a = Math.atan2(by - ay, bx - ax),
      s = 14;
    const head = (px: number, py: number, d: number) => `<path d="M${px} ${py} l${Math.cos(a + d + 2.8) * s} ${Math.sin(a + d + 2.8) * s} M${px} ${py} l${Math.cos(a + d - 2.8) * s} ${Math.sin(a + d - 2.8) * s}" stroke="${col}" stroke-width="3" fill="none"/>`;
    return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3"/>${head(ax, ay, Math.PI)}${head(bx, by, 0)}`;
  };
  const label = (cx: number, cy: number, k: string, v: string, rot = 0) => {
    const t1 = esc(cut(v, 16)),
      t2 = esc(cut(k, 20));
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="-80" y="-26" width="160" height="52" rx="10" fill="#fff" stroke="${col}" stroke-width="2"/><text x="0" y="-2" text-anchor="middle" font-size="21" font-weight="700" fill="${col}" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${t1}</text><text x="0" y="19" text-anchor="middle" font-size="15" fill="#444" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${t2}</text></g>`;
  };
  for (const s of withNum) {
    const slot = pickSlot(s.k, used);
    if (!slot) break;
    used.add(slot);
    const gap = 34;
    if (slot === 'bottom' || slot === 'top') {
      const y = Math.min(fB - 30, Math.max(fT + 30, slot === 'bottom' ? y1 + gap : y0 - gap));
      parts.push(`<line x1="${x0}" y1="${y - 22}" x2="${x0}" y2="${y + 22}" stroke="${col}" stroke-width="2"/><line x1="${x1}" y1="${y - 22}" x2="${x1}" y2="${y + 22}" stroke="${col}" stroke-width="2"/>`, arrow(x0, y, x1, y), label((x0 + x1) / 2, y, s.k, s.v));
    } else {
      const x = Math.min(fR - 30, Math.max(fL + 30, slot === 'right' ? x1 + gap : x0 - gap));
      parts.push(`<line x1="${x - 22}" y1="${y0}" x2="${x + 22}" y2="${y0}" stroke="${col}" stroke-width="2"/><line x1="${x - 22}" y1="${y1}" x2="${x + 22}" y2="${y1}" stroke="${col}" stroke-width="2"/>`, arrow(x, y0, x, y1), label(x, (y0 + y1) / 2, s.k, s.v, -90));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${title ? `<text x="${W / 2}" y="46" text-anchor="middle" font-size="30" font-weight="700" fill="#222" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${esc(cut(title, 60))}</text>` : ''}${parts.join('')}${foot ? `<text x="${W / 2}" y="${H - 22}" text-anchor="middle" font-size="26" fill="#6b5a45" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${esc(cut(foot, 80))}</text>` : ''}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: img, left: fx, top: fy }, { input: Buffer.from(svg) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
