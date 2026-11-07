import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { getFile, putFile } from '../../lib/files.js';
import { drawDimensions } from './dim-draw.js';
import { parse } from '../../lib/validate.js';
import { cleanPhotoSafe } from './clean-photo.js';

/**
 * 🤖 الكتالوج بالذكاء الاصطناعي (Gemini): لكل منتج
 *  - صورة للقطعة وهي راكبة (مجرى في درج، ماجيك كورنر في دولاب ركنة…) مبنية على صورة المنتج نفسه
 *  - وصف احترافي + مميزات + مواصفات ومقاسات التركيب (عرض العلبة، مقاس الضلفة، العمق، الحمولة…) من مواقع الشركات بالبحث في جوجل
 * المفتاح: GEMINI_API_KEY في backend/.env، أو اللي عبده بيحطه من صفحة الكتالوج (Setting ai_gemini_key).
 */
const KEY_SETTING = 'ai_gemini_key';
/** الصور ببلاش: Cloudflare Workers AI (حوالي ١٠٠٠٠ «نيورون» في اليوم مجانًا ≈ ٨٠ صورة) بموديل FLUX.2 klein بياخد صورة المنتج نفسه كمرجع */
const CF_SETTING = 'ai_cf';
const CF_MODEL = process.env.CATALOG_CF_MODEL || '@cf/black-forest-labs/flux-2-klein-4b';
// جوجل بيقفل موديلات قديمة للمستخدمين الجداد ويغيّر الأسماء كتير: بنجرب من الأحدث، وأي موديل مقفول/زحمة/مالوش حصة بنعدّي للي بعده
const TEXT_MODELS = (process.env.CATALOG_TEXT_MODELS || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-flash-latest,gemini-3.5-flash-lite').split(',');
const IMAGE_MODELS = (process.env.CATALOG_IMAGE_MODELS || 'gemini-3.1-flash-image,gemini-3.1-flash-image-preview,gemini-3-pro-image,gemini-3-pro-image-preview,gemini-2.5-flash-image').split(',');
const SKIP = /no longer available|not found|is not supported|deprecated|unknown model|not available|high demand|overloaded|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|Gemini (404|429|500|503)/i;

const body = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  section: z.string().trim().max(120).default(''),
  desc: z.string().max(3000).default(''),
  img: z.string().max(500).default(''),
  // الصور المتولّدة اتقفلت افتراضيًا (عبده ٢٠٢٦-١١-٠٣: الموديلات المجانية بتغيّر شكل القطعة وتركّبها غلط) — الوصف والمقاسات بس
  want: z.object({ text: z.boolean().default(true), image: z.boolean().default(true) }).default({}),
});

type Spec = { k: string; v: string };
export interface AiResult {
  desc: string;
  features: string[];
  specs: Spec[];
  sources: string[];
  /** المقاسات جت من بحث جوجل (true) ولا من معلومات الموديل بس (لازم تتراجع) */
  searched: boolean;
  img: string;
  textError?: string;
  imgError?: string;
}

const gemini = async (key: string, model: string, payload: unknown, ms: number) => {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(ms),
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const b = (await r.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string; inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] };
  if (!r.ok) throw new Error(b.error?.message || `Gemini ${r.status}`);
  return b;
};

/** يجرّب الموديلات بالترتيب ويعدّي اللي جوجل قفله، وبيفتكر آخر موديل نجح (لكل نوع) عشان المرة الجاية تبقى أسرع */
const lastOk = new Map<string, string>();
async function firstWorking<T>(kind: string, models: string[], run: (m: string) => Promise<T>): Promise<T> {
  let last: Error = new Error('مفيش موديل شغال');
  const first = lastOk.get(kind);
  const order = first ? [first, ...models.filter((m) => m !== first)] : models;
  for (const m of order) {
    try {
      const r = await run(m);
      lastOk.set(kind, m);
      return r;
    } catch (e) {
      last = e as Error;
      if (!SKIP.test(last.message) && !/timeout|abort/i.test(last.message)) throw last;
    }
  }
  throw last;
}
/** البحث في جوجل مالوش حصة على المفاتيح المجانية: لو اترفض نفتكر ده ساعة ومنضيّعش وقت عليه */
let noSearchUntil = 0;
let noImageUntil = 0;

const friendly = (e: unknown) => {
  const m = String((e as Error)?.message || e);
  if (/API key not valid|API_KEY_INVALID/i.test(m)) return 'المفتاح غلط — اتأكد إنك نسخته كامل';
  if (/^quota \(image\)/.test(m)) return 'الصور: فعّل الصور المجانية من Cloudflare (الخطوات فوق في الأداة)، أو فعّل الدفع في جوجل';
  if (/Cloudflare|كمّل بكرة/.test(m)) return m.slice(0, 200);
  if (/quota|RESOURCE_EXHAUSTED/i.test(m)) return 'جوجل مش مدّي حصة مجانية للحاجة دي على المفتاح ده (محتاج تفعيل الدفع Billing في Google AI Studio)، أو الحصة خلصت النهارده';
  if (/high demand|overloaded|UNAVAILABLE/i.test(m)) return 'سيرفرات جوجل زحمة دلوقتي، جرّب كمان شوية';
  if (/timeout|abort/i.test(m)) return 'جوجل اتأخر في الرد، جرّب تاني';
  return m.slice(0, 200);
};

const TEXT_PROMPT = (p: z.infer<typeof body>) => `إنت خبير إكسسوارات مطابخ ودريسنج ومفصلات ومجاري أدراج وميكانيزمات (Blum, Hettich, Grass, Hafele, Kesseböhmer, Samet, Vauth-Sagel, Peka, Starax…).
المنتج من محل «ميكانيزم» في مصر:
- الاسم: ${p.name}
- القسم: ${p.section || 'غير محدد'}
- الكود: ${p.code}
- الوصف الموجود عندنا: ${p.desc.slice(0, 1200) || 'مفيش'}
${p.img ? '- مرفق صورة المنتج.' : ''}

ابحث في جوجل عن المنتج ده أو أقرب منتج مطابق له عند الشركات المصنّعة، وهات مواصفاته الحقيقية، خصوصًا مقاسات التركيب اللي النجار محتاجها:
عرض العلبة/الدولاب المناسب، مقاس الضلفة (العرض والارتفاع)، العمق الداخلي المطلوب، طول المجرى، الحمولة، سُمك الخشب، زاوية الفتح، الخامة، التشطيب، طريقة التركيب (يمين/شمال)… حسب نوع المنتج.
لو معلومة مش متأكد منها متكتبهاش. متخترعش أرقام.

رجّع JSON بس (من غير أي كلام قبله أو بعده) بالشكل ده:
{"desc":"وصف احترافي جذاب بالعربي الفصيح البسيط في جملتين أو تلاتة، من غير مبالغة ومن غير أسعار","features":["ميزة قصيرة", "..."],"specs":[{"k":"عرض العلبة","v":"90 سم"},{"k":"مقاس الضلفة","v":"45 سم"}]}
features من 3 لـ 5، و specs من 3 لـ 8 (الأهم الأول: مقاسات التركيب).`;

const IMAGE_PROMPT = (p: z.infer<typeof body>) =>
  `Create a photorealistic, high-end catalog photo showing THIS EXACT hardware product from the attached photo installed and in use in its real place (for example: a drawer runner mounted on an open drawer, a hinge on a cabinet door, a corner unit like Magic Corner pulled out of a kitchen corner cabinet, a pull-out basket inside a tall cabinet, a wardrobe lift inside a wardrobe, a handle on a cabinet front). Product: "${p.name}" (category: ${p.section || 'furniture hardware'}). Keep the product's shape, color and material identical to the attached photo and clearly visible as the hero. Modern kitchen or wardrobe interior, soft natural light, shallow depth of field, clean premium look. No text, no logos, no watermarks, no people.`;

const CF_PROMPT = (p: z.infer<typeof body>) =>
  `Photorealistic premium furniture-hardware catalog photo. Take the exact hardware product shown in image 0 ("${p.name}", category: ${p.section || 'furniture hardware'}) and show it installed and in use in its real place: for example a drawer runner mounted on the side of an open drawer, a hinge fitted on an open cabinet door, a corner pull-out unit swung out of an open kitchen corner cabinet, a pull-out basket inside a tall pantry cabinet, a lift-up fitting on a wall cabinet, a handle on a cabinet front. Keep the product's shape, colour and material the same as image 0 and make it the clear hero of the shot. Modern kitchen or wardrobe interior, soft natural daylight, clean premium look. No text, no logos, no watermark, no people.`;

/**
 * The Gemini key the owner pasted in the system (catalog page) also serves every other AI feature (invoice / transfer reading,
 * photo search, product details), which read process.env. Only used when the server has no GEMINI_API_KEY of its own.
 * Checked at most once a minute per server instance.
 */
const ENV_HAD_KEY = !!process.env.GEMINI_API_KEY;
let savedAt = 0;
export async function useSavedAiKey(db: FastifyInstance['prisma']): Promise<void> {
  if (ENV_HAD_KEY || Date.now() - savedAt < 60_000) return;
  savedAt = Date.now();
  const v = (await db.setting.findUnique({ where: { key: KEY_SETTING } }).catch(() => null))?.value as { key?: string } | null;
  if (v?.key) process.env.GEMINI_API_KEY = v.key;
  else delete process.env.GEMINI_API_KEY;
}
export const forgetSavedAiKey = () => { savedAt = 0; };

/** مفتاح Gemini: من .env أو اللي اتحفظ من صفحة الكتالوج */
export async function geminiKey(db: FastifyInstance['prisma']): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const v = (await db.setting.findUnique({ where: { key: KEY_SETTING } }))?.value as { key?: string } | null;
  return v?.key || null;
}

/** سؤال واحد لـ Gemini بصورة (اختياري) وبيرجّع JSON — بيعدّي على الموديلات المقفولة أو الزحمة */
export async function geminiJson<T>(key: string, prompt: string, image?: { data: string; mime: string }): Promise<T> {
  const parts = [{ text: prompt }, ...(image ? [{ inline_data: { mime_type: image.mime, data: image.data } }] : [])];
  const b = await firstWorking('text', TEXT_MODELS, (m) => gemini(key, m, { contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }, 45000)).catch((e) => {
    throw new Error(friendly(e));
  });
  const t = (b.candidates?.[0]?.content?.parts ?? []).map((x) => x.text || '').join('');
  const j = t.match(/[[{][\s\S]*[\]}]/)?.[0];
  if (!j) throw new Error('الذكاء الاصطناعي مارجّعش بيانات مفهومة، جرّب تاني');
  return JSON.parse(j) as T;
}

export async function catalogAiRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const getKey = async () => {
    if (ENV_HAD_KEY && process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: 'env' as const };
    const v = (await db.setting.findUnique({ where: { key: KEY_SETTING } }))?.value as { key?: string } | null;
    return v?.key ? { key: v.key, source: 'saved' as const } : null;
  };

  const getCf = async () => {
    const v = (await db.setting.findUnique({ where: { key: CF_SETTING } }))?.value as { account?: string; token?: string } | null;
    return v?.account && v.token ? { account: v.account, token: v.token } : null;
  };
  app.get('/catalog/ai/key', { preHandler: app.requireAdmin }, async () => {
    const k = await getKey();
    return { set: !!k, source: k?.source ?? null, cf: !!(await getCf()), serper: !!(await getSerper()) };
  });
  app.put('/catalog/ai/cf', { preHandler: app.requireAdmin }, async (request) => {
    const b = parse(z.object({ account: z.string().max(200), token: z.string().max(400) }), request.body);
    const clean = (x: string) => x.replace(/[\s"'‎‏‪-‮]/g, '');
    // مايهمش مين في أنهي خانة: الـ Token هو اللي مش ٣٢ حرف hex، والـ Account ID بيتطلع من أي لينك أو نص،
    // ولو مش موجود بنجيبه من Cloudflare نفسه بالـ Token
    const vals = [clean(b.account), clean(b.token)].filter(Boolean);
    const token = vals.find((v) => !/^[0-9a-f]{32}$/i.test(v) && !/cloudflare\.com/i.test(v)) ?? '';
    let account = vals.map((v) => (v === token ? '' : v.match(/[0-9a-f]{32}/i)?.[0] ?? '')).find(Boolean) ?? '';
    if (!account && token) {
      const r = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { result?: { id?: string }[] } | null;
      // توكن Workers AI مابيقدرش يعرض الحسابات: الحساب المعروف من إعدادات السيرفر (CATALOG_CF_ACCOUNT)
      account = j?.result?.[0]?.id ?? (process.env.CATALOG_CF_ACCOUNT || '').trim();
      if (!account) throw badRequest('اتأكدت من الـ Token بس مقدرتش أعرف الحساب لوحده — الزق لينك صفحة Cloudflare الرئيسية في الخانة الأولى');
    }
    const actor = actorOf(request);
    if (!account && !token) await db.setting.deleteMany({ where: { key: CF_SETTING } });
    else {
      if (!/^[0-9a-f]{32}$/i.test(account)) throw badRequest('الـ Account ID غلط — ده ٣٢ حرف ورقم من صفحة Workers AI');
      if (!/^[!-~]{30,300}$/.test(token)) throw badRequest('الـ Token غلط — انسخه كامل');
      // نتأكد إنه شغال قبل ما نحفظه
      // تجربة حقيقية صغيرة (موديل نص صغير، كلمة واحدة) — نفس الصلاحية اللي الصور محتاجاها
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.2-1b-instruct`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'hi', max_tokens: 1 }), signal: AbortSignal.timeout(30000) }).catch(() => null);
      if (!r?.ok) {
        const j = (await r?.json().catch(() => null)) as { errors?: { code?: number; message?: string }[] } | null;
        const e = j?.errors?.[0];
        request.log.warn({ status: r?.status, cf: e }, 'cloudflare check failed');
        const why = !r ? 'مفيش اتصال بـ Cloudflare' : r.status === 401 || r.status === 403 || e?.code === 10000 ? 'الـ Token مش مقبول للحساب ده (يمكن الـ Account ID مش بتاع نفس الحساب، أو الـ Token اتنسخ ناقص)' : r.status === 404 || e?.code === 7003 ? 'الـ Account ID غلط' : `${r.status} ${e?.message ?? ''}`;
        throw badRequest(`Cloudflare رفض: ${why} — Cloudflare: ${String(e?.message ?? r?.status ?? '').slice(0, 120)}`);
      }
      await db.setting.upsert({ where: { key: CF_SETTING }, create: { key: CF_SETTING, value: { account, token }, updatedById: actor.id }, update: { value: { account, token }, updatedById: actor.id } });
    }
    await writeAudit(db, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: CF_SETTING, after: { set: !!account }, ip: actor.ip });
    return { cf: !!account };
  });
  /**
   * 🖼️ صور حقيقية تقريبية للمنتج من النت (بحث صور جوجل عن طريق Serper: ٢٥٠٠ بحث مجاني من غير فيزا).
   * عبده بيختار من النتايج، والصورة بتتنزّل وتتحفظ عندنا (مش لينك خارجي ممكن يقع).
   */
  const SERPER = 'ai_serper';
  const getSerper = async () => ((await db.setting.findUnique({ where: { key: SERPER } }))?.value as { key?: string } | null)?.key || process.env.SERPER_API_KEY || '';
  app.put('/catalog/ai/serper', { preHandler: app.requireAdmin }, async (request) => {
    const key = parse(z.object({ key: z.string().max(200) }), request.body).key.replace(/[\s"'\u200e\u200f\u202a-\u202e]/g, '');
    const actor = actorOf(request);
    if (!key) await db.setting.deleteMany({ where: { key: SERPER } });
    else {
      const r = await fetch('https://google.serper.dev/images', { method: 'POST', headers: { 'X-API-KEY': key, 'content-type': 'application/json' }, body: JSON.stringify({ q: 'kitchen hinge', num: 10 }), signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (!r?.ok) throw badRequest(`Serper رفض المفتاح ده (${r?.status ?? 'مفيش اتصال'}) — انسخه كامل من serper.dev ← API Key`);
      await db.setting.upsert({ where: { key: SERPER }, create: { key: SERPER, value: { key }, updatedById: actor.id }, update: { value: { key }, updatedById: actor.id } });
    }
    await writeAudit(db, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: SERPER, after: { set: !!key }, ip: actor.ip });
    return { serper: !!key };
  });
  const thumbOf = new Map<string, string>();
  app.post('/catalog/ai/photos', { preHandler: app.requireAdmin, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(200), brand: z.string().max(80).default(''), q: z.string().max(200).default('') }), request.body);
    const key = await getSerper();
    if (!key) throw badRequest('محتاج مفتاح Serper الأول (الخطوات في الأداة)');
    const q = (b.q || `${b.name} ${b.brand}`).trim();
    const r = await fetch('https://google.serper.dev/images', { method: 'POST', headers: { 'X-API-KEY': key, 'content-type': 'application/json' }, body: JSON.stringify({ q, gl: 'eg', hl: 'ar', num: 20 }), signal: AbortSignal.timeout(25000) }).catch(() => null);
    if (!r?.ok) throw badRequest(r?.status === 403 || r?.status === 401 ? 'مفتاح Serper اتقفل أو البحث المجاني خلص' : `البحث مااشتغلش (${r?.status ?? 'مفيش اتصال'})`);
    const j = (await r.json().catch(() => ({}))) as { images?: { title?: string; imageUrl?: string; thumbnailUrl?: string; imageWidth?: number; imageHeight?: number; domain?: string; link?: string }[] };
    const items = (j.images ?? [])
      .filter((x) => x.imageUrl && /^https:\/\//.test(x.imageUrl) && (x.imageWidth ?? 600) >= 300)
      .slice(0, 16)
      .map((x) => ({ url: x.imageUrl!, thumb: x.thumbnailUrl || x.imageUrl!, title: String(x.title ?? '').slice(0, 120), site: String(x.domain ?? '').slice(0, 60), w: x.imageWidth ?? 0, h: x.imageHeight ?? 0 }));
    for (const it of items) thumbOf.set(it.url, it.thumb);
    if (thumbOf.size > 3000) for (const k of [...thumbOf.keys()].slice(0, 1000)) thumbOf.delete(k);
    return { q, items };
  });
  app.post('/catalog/ai/photos/save', { preHandler: app.requireAdmin }, async (request) => {
    const b = parse(z.object({ url: z.string().url().max(2000), thumb: z.string().url().max(2000).optional() }), request.body);
    const url = b.url;
    const thumb = b.thumb ?? thumbOf.get(b.url);
    let lastWhy = '';
    // الأصلية الأول؛ لو الموقع منع التحميل (فيسبوك/إنستجرام…) أو مش صورة، نيجي على النسخة الصغيرة اللي جوجل نفسه مخزّنها
    for (const u of [url, thumb].filter((x): x is string => !!x && x.startsWith('https://'))) {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', accept: 'image/avif,image/webp,image/*,*/*;q=0.8', referer: new URL(u).origin + '/' } }).catch(() => null);
      if (!r?.ok || !(r.headers.get('content-type') || '').startsWith('image/')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > 12 * 1024 * 1024) continue;
      // أي اسم تاجر/رقم/لوجو/سعر مكتوب على الصورة بيتشال قبل الحفظ
      const done = await cleanPhotoSafe(await geminiKey(db), buf).catch(() => null);
      if (!done) continue;
      if (done.rejected) {
        lastWhy = done.why;
        continue;
      }
      const name = `${randomBytes(12).toString('hex')}.jpg`;
      await putFile(name, done.buf, 'image/jpeg');
      return { url: `/api/v1/work/files/${name}`, lowRes: u !== url, removed: done.removed, unchecked: done.unchecked };
    }
    if (lastWhy) throw badRequest(`الصورة دي ماتحفظتش عشان مش مضمونة إنها نضيفة: ${lastWhy} — جرّب تاني أو اختار صورة تانية`);
    throw badRequest('الموقع ده مارضيش يدّي الصورة — اختار صورة تانية (يفضّل من موقع مش فيسبوك أو إنستجرام)');
  });

  app.put('/catalog/ai/key', { preHandler: app.requireAdmin }, async (request) => {
    // المفتاح بيتلزق من الموبايل ساعات بمسافات أو سطر جديد أو علامات تنصيص، والمفاتيح الجديدة لجوجل فيها نقط (AQ.…)
    const key = parse(z.object({ key: z.string().max(400) }), request.body).key.replace(/[\s"'‎‏‪-‮]/g, '');
    const actor = actorOf(request);
    if (!key) await db.setting.deleteMany({ where: { key: KEY_SETTING } });
    else {
      if (!/^[\x21-\x7e]{20,300}$/.test(key)) throw badRequest('شكل المفتاح مش مظبوط — انسخه كامل من Google AI Studio');
      await db.setting.upsert({ where: { key: KEY_SETTING }, create: { key: KEY_SETTING, value: { key }, updatedById: actor.id }, update: { value: { key }, updatedById: actor.id } });
    }
    await writeAudit(db, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: KEY_SETTING, after: { set: !!key }, ip: actor.ip });
    forgetSavedAiKey();
    return { set: !!key };
  });

  const loadImage = async (u: string): Promise<{ data: string; mime: string } | null> => {
    if (!u) return null;
    const m = u.match(/\/api\/v1\/work\/files\/([a-z0-9-]+\.(jpg|jpeg|png|webp))$/i);
    let buf: Buffer | null = null;
    let mime = 'image/jpeg';
    if (m) {
      buf = await getFile(m[1]!);
      const ext = m[2]!.toLowerCase();
      mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    } else if (/^https:\/\//.test(u)) {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (r?.ok) {
        mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]!;
        buf = Buffer.from(await r.arrayBuffer());
      }
    }
    if (!buf || !buf.length || buf.length > 8 * 1024 * 1024 || !mime.startsWith('image/')) return null;
    return { data: buf.toString('base64'), mime };
  };

  /**
   * الشغل بياخد أحيانًا أكتر من دقيقة (صورة + بحث)، والاتصال من الأيقونة (Vercel → ngrok) بيقطع قبلها.
   * فالشغل بيكمّل في الخلفية لكل كود: الطلب بيستنى لحد ~٢٥ ثانية، ولو لسه بيقول «لسه بيشتغل»، والضغطة الجاية بتاخد النتيجة الجاهزة.
   */
  const jobs = new Map<string, { run: Promise<AiResult>; done?: AiResult; at: number }>();
  const WAIT_MS = Number(process.env.CATALOG_AI_WAIT_MS) || 25000;
  app.post('/catalog/ai/product', { preHandler: app.requireAdmin, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const p = parse(body, request.body);
    const k = await getKey();
    if (!k) throw badRequest('محتاج مفتاح Gemini الأول (مجاني من aistudio.google.com)');
    for (const [c, j] of jobs) if (Date.now() - j.at > 3600_000) jobs.delete(c);
    let job = jobs.get(p.code);
    if (!job || (job.done && Date.now() - job.at > 30 * 60_000)) {
      const run = runJob(k.key, p);
      job = { run, at: Date.now() };
      jobs.set(p.code, job);
      const jj = job;
      void run.then((r) => void (jj.done = r)).catch(() => jobs.delete(p.code));
    }
    const got = job.done ?? (await Promise.race([job.run, new Promise<null>((r) => setTimeout(() => r(null), WAIT_MS))]));
    if (!got) return { desc: '', features: [], specs: [], sources: [], searched: false, img: '', pending: true, textError: '⏳ لسه بيشتغل (الصورة بتاخد وقت) — دوس «اعمل» تاني كمان دقيقة وهتلاقيه جاهز' };
    jobs.delete(p.code);
    return got;
  });

  const runJob = async (key: string, p: z.infer<typeof body>): Promise<AiResult> => {
    const k = { key };
    const photo = await loadImage(p.img);
    const imgPart = photo ? [{ inline_data: { mime_type: photo.mime, data: photo.data } }] : [];
    const out: AiResult = { desc: '', features: [], specs: [], sources: [], searched: false, img: '' };

    const text = async () => {
      let b: Awaited<ReturnType<typeof gemini>>;
      try {
        if (Date.now() < noSearchUntil) throw new Error('quota (search)');
        b = await firstWorking('search', TEXT_MODELS.slice(0, 3), (m) => gemini(k.key, m, { contents: [{ parts: [{ text: TEXT_PROMPT(p) }, ...imgPart] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.3 } }, 40000));
        out.searched = true;
      } catch (e) {
        if (!SKIP.test(String((e as Error).message)) && !/timeout|abort/i.test(String((e as Error).message))) throw e;
        if (/quota|RESOURCE_EXHAUSTED/i.test(String((e as Error).message))) noSearchUntil = Date.now() + 3600_000;
        // البحث مش متاح على المفتاح ده: من معلومات الموديل نفسه (بيتعلّم «راجعها»)
        b = await firstWorking('text', TEXT_MODELS, (m) => gemini(k.key, m, { contents: [{ parts: [{ text: TEXT_PROMPT(p).replace('ابحث في جوجل عن', 'من معلوماتك عن') }, ...imgPart] }], generationConfig: { temperature: 0.2 } }, 45000));
      }
      const c = b.candidates?.[0];
      const t = (c?.content?.parts ?? []).map((x) => x.text || '').join('');
      const j = t.match(/\{[\s\S]*\}/)?.[0];
      if (!j) throw new Error('الذكاء الاصطناعي مارجّعش بيانات مفهومة، جرّب تاني');
      const d = JSON.parse(j) as { desc?: string; features?: string[]; specs?: Spec[] };
      out.desc = String(d.desc ?? '').slice(0, 700);
      out.features = (Array.isArray(d.features) ? d.features : []).map((x) => String(x).slice(0, 140)).filter(Boolean).slice(0, 5);
      out.specs = (Array.isArray(d.specs) ? d.specs : []).filter((x) => x && x.k && x.v).map((x) => ({ k: String(x.k).slice(0, 40), v: String(x.v).slice(0, 80) })).slice(0, 8);
      out.sources = (c?.groundingMetadata?.groundingChunks ?? []).map((g) => g.web?.uri || '').filter(Boolean).slice(0, 4);
    };
    const cfImage = async (cf: { account: string; token: string }) => {
      const sharp = (await import('sharp')).default;
      // الموديل بياخد صور مرجع أصغر من ٥١٢×٥١٢
      const ref = await sharp(Buffer.from(photo!.data, 'base64')).resize(500, 500, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
      // الموديل المجاني ضعيف مع الطلب العام (بيرسم درج عادي): Gemini بيبص على صورة المنتج الأول ويكتب وصف دقيق للقطعة نفسها
      // (شكلها، ألوانها، خاماتها) والمكان الصح اللي بتتركب فيه وإزاي تبان وهي شغالة — وده اللي بيترسم
      const scene = await geminiJson<{ prompt?: string }>(
        key,
        `You write prompts for an image model that edits a reference photo. Look at the attached photo of a furniture/kitchen hardware product sold in Egypt ("${p.name}", category: ${p.section || 'hardware'}). Ignore any logo, frame or text overlay in the photo.
Write ONE English prompt (max 110 words) that starts with "Image 0 shows" and: 1) describes exactly what this product is and its visible shape, parts, colours and materials precisely enough to recreate the SAME part; 2) asks to show THIS EXACT part from image 0 installed and working in its correct real place (e.g. drawer runner on the side of an open drawer seen close-up, hinge on an open cabinet door, corner unit trays swung out of a corner base cabinet, sliding wardrobe door track with doors, lift on a wall cabinet); 3) close-up so the part fills most of the frame and is the sharp hero; modern kitchen or wardrobe, soft daylight; no text, no logos, no people.
Return JSON: {"prompt":"..."}`,
        { data: photo!.data, mime: photo!.mime },
      )
        .then((d) => String(d.prompt ?? '').slice(0, 1200))
        .catch(() => '');
      const fd = new FormData();
      fd.append('prompt', scene || CF_PROMPT(p));
      fd.append('input_image_0', new Blob([new Uint8Array(ref)], { type: 'image/jpeg' }), 'product.jpg');
      fd.append('width', '1024');
      fd.append('height', '768');
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.account}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { authorization: `Bearer ${cf.token}` }, body: fd, signal: AbortSignal.timeout(90000) });
      const j = (await r.json().catch(() => ({}))) as { result?: { image?: string }; errors?: { message?: string; code?: number }[] };
      if (!r.ok || !j.result?.image) {
        const m = j.errors?.[0]?.message || `Cloudflare ${r.status}`;
        throw new Error(/neuron|limit|quota|exceeded|429/i.test(m + r.status) ? 'خلصت صور Cloudflare المجانية النهارده (حوالي ٨٠ صورة في اليوم) — كمّل بكرة' : 'Cloudflare: ' + m.slice(0, 160));
      }
      const name = `${randomBytes(12).toString('hex')}.jpg`;
      const img = await sharp(Buffer.from(j.result.image, 'base64')).jpeg({ quality: 88 }).toBuffer();
      await putFile(name, img, 'image/jpeg');
      out.img = `/api/v1/work/files/${name}`;
    };
    // الصورة الحقيقية زي ما هي + المقاسات مرسومة بالكود (مفيش ذكاء اصطناعي بيرسم القطعة)
    const dimImage = async () => {
      if (!photo) throw new Error('المنتج مالوش صورة نبني عليها');
      // مكان القطعة المعدن نفسها في الصورة (عشان خطوط المقاسات تتحط عليها هي مش على إطار الصورة)
      const hint = await geminiJson<{ box?: number[] }>(
        key,
        'Find the main metal hardware product (not the background, logo, text or hands) in this photo. Return JSON only: {"box":[ymin,xmin,ymax,xmax]} with integers 0-1000 tightly around the whole product.',
        { data: photo.data, mime: photo.mime },
      )
        .then((d) => (Array.isArray(d.box) && d.box.length === 4 && d.box.every((n) => Number.isFinite(n)) ? ([d.box[1]! / 1000, d.box[0]! / 1000, d.box[3]! / 1000, d.box[2]! / 1000] as [number, number, number, number]) : null))
        .catch(() => null);
      const buf = await drawDimensions(Buffer.from(photo.data, 'base64'), out.specs, p.name, hint);
      const name = `${randomBytes(12).toString('hex')}.jpg`;
      await putFile(name, buf, 'image/jpeg');
      out.img = `/api/v1/work/files/${name}`;
    };
    const image = async () => {
      if (!photo) throw new Error('المنتج مالوش صورة نبني عليها');
      const cf = await getCf();
      if (Date.now() < noImageUntil) {
        if (cf) return cfImage(cf);
        throw new Error('quota (image) — فعّل الصور المجانية من Cloudflare');
      }
      try {
        await geminiImage();
      } catch (e) {
        if (cf && SKIP.test(String((e as Error).message))) return cfImage(cf);
        throw e;
      }
    };
    const geminiImage = async () => {
      const b = await firstWorking('image', IMAGE_MODELS, (m) =>
        gemini(k.key, m, { contents: [{ parts: [{ text: IMAGE_PROMPT(p) }, ...imgPart] }], generationConfig: { responseModalities: ['IMAGE'] } }, 60000),
      ).catch((e) => {
        if (/quota|RESOURCE_EXHAUSTED/i.test(String((e as Error).message))) noImageUntil = Date.now() + 3600_000;
        throw e;
      });
      const part = (b.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data || x.inline_data?.data);
      const data = part?.inlineData?.data || part?.inline_data?.data;
      const mime = part?.inlineData?.mimeType || part?.inline_data?.mime_type || 'image/png';
      if (!data) throw new Error('جوجل مارجّعش صورة، جرّب تاني');
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
      const name = `${randomBytes(12).toString('hex')}.${ext}`;
      await putFile(name, Buffer.from(data, 'base64'), mime);
      out.img = `/api/v1/work/files/${name}`;
    };
    if (p.want.text) await text().catch((e) => void (out.textError = friendly(e)));
    if (p.want.image) await (process.env.CATALOG_AI_IMAGES === 'ai' ? image : dimImage)().catch((e) => void (out.imgError = friendly(e)));
    return out;
  };
}
