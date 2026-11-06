import { geminiJson } from './catalog-ai.js';

/**
 * 🧼 تنضيف صورة جاية من النت قبل ما تدخل الكتالوج: أي اسم تاجر/شركة، رقم تليفون، لوجو، سعر، علامة مائية، حساب سوشيال
 * مكتوب على الصورة (مش المكتوب على القطعة نفسها) بيتشال:
 *  - لو شريط على الحافة (فوق/تحت/جنب): بيتقص
 *  - الباقي: بيتمسح بلون الخلفية اللي حواليه
 * Gemini بيحدد أماكنها (إحداثيات)، و sharp بيعمل الشغل.
 */
type Box = { ymin: number; xmin: number; ymax: number; xmax: number; what?: string };
export interface CleanResult {
  buf: Buffer;
  removed: number;
  cropped: boolean;
  /** Gemini ماشتغلش: الصورة اتحفظت من غير تنضيف ولازم عبده يراجعها */
  unchecked: boolean;
}

async function onePass(key: string | null, input: Buffer): Promise<CleanResult> {
  const sharp = (await import('sharp')).default;
  const base = await sharp(input).rotate().resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const bm = await sharp(base).metadata();
  const W = bm.width ?? 0;
  const H = bm.height ?? 0;
  const plain = async (unchecked: boolean): Promise<CleanResult> => ({ buf: await sharp(base).jpeg({ quality: 86 }).toBuffer(), removed: 0, cropped: false, unchecked });
  if (!key || !W || !H) return plain(true);

  let boxes: Box[];
  try {
    const small = await sharp(base).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    const d = await geminiJson<{ boxes?: Box[] }>(
      key,
      `Look at this product photo from a web search. Find EVERY overlay that belongs to a seller or to the website rather than to the product: company/trader/shop names, logos, brand banners added to the photo, phone numbers, prices, social-media handles or icons (Facebook, Instagram, WhatsApp), website addresses, watermarks, "made in" stickers, promo stickers, Arabic or English caption text added on the image.
Do NOT include text or markings physically printed or engraved on the product itself.
Return JSON: {"boxes":[{"ymin":0,"xmin":0,"ymax":0,"xmax":0,"what":"short"}]} with coordinates normalised 0-1000 (y first), boxes tight but slightly generous. Return {"boxes":[]} if there is nothing to remove.`,
      { data: small.toString('base64'), mime: 'image/jpeg' },
    );
    boxes = (d.boxes ?? []).filter((b) => [b.ymin, b.xmin, b.ymax, b.xmax].every((n) => Number.isFinite(n)) && b.ymax > b.ymin && b.xmax > b.xmin).slice(0, 25);
  } catch {
    return plain(true);
  }
  if (!boxes.length) return plain(false);

  // 1) أشرطة على الحافة: نقص (أعلى/أسفل لو الصندوق عريض، شمال/يمين لو طويل)
  let top = 0;
  let bottom = 1000;
  let left = 0;
  let right = 1000;
  const rest: Box[] = [];
  for (const b of boxes) {
    const wide = b.xmax - b.xmin >= 450;
    const tall = b.ymax - b.ymin >= 450;
    if (wide && b.ymin <= 90 && b.ymax <= 350) top = Math.max(top, b.ymax);
    else if (wide && b.ymax >= 910 && b.ymin >= 600) bottom = Math.min(bottom, b.ymin);
    else if (tall && b.xmin <= 90 && b.xmax <= 650) left = Math.max(left, b.xmax);
    else if (tall && b.xmax >= 910 && b.xmin >= 350) right = Math.min(right, b.xmin);
    else rest.push(b);
  }
  let cx0 = Math.round((left / 1000) * W);
  let cx1 = Math.round((right / 1000) * W);
  let cy0 = Math.round((top / 1000) * H);
  let cy1 = Math.round((bottom / 1000) * H);
  let cropped = top > 0 || bottom < 1000 || left > 0 || right < 1000;
  // لو القص هياكل أكتر من ٤٠٪ من الصورة نسيبها ونمسح بدل ما نقص
  if (cropped && ((cx1 - cx0) * (cy1 - cy0)) / (W * H) < 0.3) {
    cx0 = 0;
    cy0 = 0;
    cx1 = W;
    cy1 = H;
    cropped = false;
    rest.push(...boxes.filter((b) => !rest.includes(b)));
  }
  const keep = { left: cx0, top: cy0, width: Math.max(1, cx1 - cx0), height: Math.max(1, cy1 - cy0) };
  let cur = cropped ? await sharp(base).extract(keep).toBuffer() : base;
  const ox = keep.left;
  const oy = keep.top;

  // 2) الباقي: نمسح بلون الحلقة اللي حوالين الصندوق (متوسط) مع تنعيم الحواف
  const raw = await sharp(cur).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = raw.data;
  const ww = raw.info.width;
  const hh = raw.info.height;
  const patches: { input: Buffer; left: number; top: number; w: number; h: number }[] = [];
  for (const b of rest) {
    const pad = 8;
    const x0 = Math.max(0, Math.round((b.xmin / 1000) * W) - ox - pad);
    const x1 = Math.min(ww, Math.round((b.xmax / 1000) * W) - ox + pad);
    const y0 = Math.max(0, Math.round((b.ymin / 1000) * H) - oy - pad);
    const y1 = Math.min(hh, Math.round((b.ymax / 1000) * H) - oy + pad);
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    const ring = 6;
    for (let y = Math.max(0, y0 - ring); y < Math.min(hh, y1 + ring); y++) {
      for (let x = Math.max(0, x0 - ring); x < Math.min(ww, x1 + ring); x++) {
        if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
        const i = (y * ww + x) * 4;
        r += px[i]!;
        g += px[i + 1]!;
        bl += px[i + 2]!;
        n++;
      }
    }
    if (!n) continue;
    const w = x1 - x0;
    const h = y1 - y0;
    // مربع بلون الحلقة وحوافه متنعّمة (alpha بيقل ناحية الحافة) عشان المسح مايبانش
    const solid = await sharp({ create: { width: w, height: h, channels: 4, background: { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(bl / n), alpha: 1 } } }).png().toBuffer();
    const fade = await sharp({ create: { width: Math.max(2, w - 8), height: Math.max(2, h - 8), channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .blur(3)
      .png()
      .toBuffer();
    patches.push({ input: await sharp(solid).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer(), left: x0, top: y0, w, h });
  }
  if (patches.length) cur = await sharp(cur).composite(patches.map((p) => ({ input: p.input, left: p.left, top: p.top }))).toBuffer();
  return { buf: await sharp(cur).jpeg({ quality: 86 }).toBuffer(), removed: patches.length + (cropped ? 1 : 0), cropped, unchecked: false };
}

/** هل لسه فيه أي حاجة بتاعة تاجر/موقع على الصورة؟ (فحص مستقل بعد التنضيف) */
async function leftover(key: string, buf: Buffer): Promise<{ left: boolean; what: string }> {
  const sharp = (await import('sharp')).default;
  const small = await sharp(buf).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
  const d = await geminiJson<{ remaining?: boolean; what?: string }>(
    key,
    `Inspect this product photo carefully. Does it still show ANY text, number, phone number, logo, brand/shop/company name, price, website, social-media handle or icon, or watermark that was ADDED to the picture by a seller or website (not something physically printed or engraved on the product itself)? Even small or faint ones count.
Return JSON only: {"remaining":true|false,"what":"short description of what is left, or empty"}`,
    { data: small.toString('base64'), mime: 'image/jpeg' },
  );
  return { left: d.remaining === true, what: String(d.what ?? '').slice(0, 120) };
}

export interface SafeResult extends CleanResult {
  /** الصورة لسه عليها بيانات تاجر بعد كل المحاولات: ماتتحفظش */
  rejected: boolean;
  why: string;
}

/**
 * تنضيف مضمون: لحد ٣ لفّات (تحديد + مسح/قص)، وبعد كل لفّة فحص مستقل. لو الفحص لسه شايف بيانات تاجر
 * (أو Gemini مارضيش يشتغل) الصورة بتترفض بدل ما تتحفظ وعليها اسم تاجر.
 */
export async function cleanPhotoSafe(key: string | null, input: Buffer): Promise<SafeResult> {
  if (!key) return { buf: input, removed: 0, cropped: false, unchecked: true, rejected: true, why: 'مفيش مفتاح Gemini للتنضيف' };
  let cur = input;
  let removed = 0;
  let cropped = false;
  let why = '';
  for (let round = 0; round < 3; round++) {
    const r = await onePass(key, cur);
    if (r.unchecked) return { ...r, rejected: true, why: 'الذكاء الاصطناعي مارضيش يشتغل دلوقتي، جرّب تاني' };
    cur = r.buf;
    removed += r.removed;
    cropped = cropped || r.cropped;
    const v = await leftover(key, cur).catch(() => null);
    if (!v) return { buf: cur, removed, cropped, unchecked: true, rejected: true, why: 'مقدرتش أتأكد إن الصورة نضيفة' };
    if (!v.left) return { buf: cur, removed, cropped, unchecked: false, rejected: false, why: '' };
    why = v.what;
  }
  return { buf: cur, removed, cropped, unchecked: false, rejected: true, why: `لسه عليها ${why || 'بيانات تاجر'}` };
}
