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

export async function drawDimensions(photo: Buffer, specs: DimSpec[], title = ''): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const W = 1200,
    H = 900,
    M = 150; // margin that holds the dimension lines
  const box = { x: M + 40, y: M + 10, w: W - 2 * M - 80, h: H - 2 * M - 40 };
  const img = await sharp(photo).rotate().flatten({ background: '#ffffff' }).resize(box.w, box.h, { fit: 'inside', background: '#ffffff' }).png().toBuffer();
  const meta = await sharp(img).metadata();
  const iw = meta.width ?? box.w,
    ih = meta.height ?? box.h;
  const x0 = box.x + Math.round((box.w - iw) / 2),
    y0 = box.y + Math.round((box.h - ih) / 2),
    x1 = x0 + iw,
    y1 = y0 + ih;

  const withNum = specs.filter((s) => /[0-9٠-٩]/.test(s.v)).slice(0, 4);
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
    const t1 = esc(cut(v, 22)),
      t2 = esc(cut(k, 26));
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="-110" y="-34" width="220" height="68" rx="12" fill="#fff" stroke="${col}" stroke-width="2"/><text x="0" y="-4" text-anchor="middle" font-size="26" font-weight="700" fill="${col}" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${t1}</text><text x="0" y="24" text-anchor="middle" font-size="19" fill="#444" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${t2}</text></g>`;
  };
  for (const s of withNum) {
    const slot = pickSlot(s.k, used);
    if (!slot) break;
    used.add(slot);
    const gap = 70;
    if (slot === 'bottom' || slot === 'top') {
      const y = slot === 'bottom' ? y1 + gap : y0 - gap;
      parts.push(`<line x1="${x0}" y1="${y - 22}" x2="${x0}" y2="${y + 22}" stroke="${col}" stroke-width="2"/><line x1="${x1}" y1="${y - 22}" x2="${x1}" y2="${y + 22}" stroke="${col}" stroke-width="2"/>`, arrow(x0, y, x1, y), label((x0 + x1) / 2, y, s.k, s.v));
    } else {
      const x = slot === 'right' ? x1 + gap : x0 - gap;
      parts.push(`<line x1="${x - 22}" y1="${y0}" x2="${x + 22}" y2="${y0}" stroke="${col}" stroke-width="2"/><line x1="${x - 22}" y1="${y1}" x2="${x + 22}" y2="${y1}" stroke="${col}" stroke-width="2"/>`, arrow(x, y0, x, y1), label(x, (y0 + y1) / 2, s.k, s.v, -90));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${title ? `<text x="${W / 2}" y="46" text-anchor="middle" font-size="30" font-weight="700" fill="#222" font-family="Cairo,Tahoma,Arial,sans-serif" direction="rtl">${esc(cut(title, 60))}</text>` : ''}<rect x="${x0 - 1}" y="${y0 - 1}" width="${iw + 2}" height="${ih + 2}" fill="none" stroke="#ddd"/>${parts.join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: img, left: x0, top: y0 }, { input: Buffer.from(svg) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
