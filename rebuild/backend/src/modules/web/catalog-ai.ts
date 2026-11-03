import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { getFile, putFile } from '../../lib/files.js';
import { parse } from '../../lib/validate.js';

/**
 * 🤖 الكتالوج بالذكاء الاصطناعي (Gemini): لكل منتج
 *  - صورة للقطعة وهي راكبة (مجرى في درج، ماجيك كورنر في دولاب ركنة…) مبنية على صورة المنتج نفسه
 *  - وصف احترافي + مميزات + مواصفات ومقاسات التركيب (عرض العلبة، مقاس الضلفة، العمق، الحمولة…) من مواقع الشركات بالبحث في جوجل
 * المفتاح: GEMINI_API_KEY في backend/.env، أو اللي عبده بيحطه من صفحة الكتالوج (Setting ai_gemini_key).
 */
const KEY_SETTING = 'ai_gemini_key';
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

export async function catalogAiRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const getKey = async () => {
    if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: 'env' as const };
    const v = (await db.setting.findUnique({ where: { key: KEY_SETTING } }))?.value as { key?: string } | null;
    return v?.key ? { key: v.key, source: 'saved' as const } : null;
  };

  app.get('/catalog/ai/key', { preHandler: app.requireAdmin }, async () => {
    const k = await getKey();
    return { set: !!k, source: k?.source ?? null };
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
    const image = async () => {
      if (!photo) throw new Error('المنتج مالوش صورة نبني عليها');
      if (Date.now() < noImageUntil) throw new Error('quota (image)');
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
    await Promise.all([
      p.want.text ? text().catch((e) => void (out.textError = friendly(e))) : null,
      p.want.image ? image().catch((e) => void (out.imgError = friendly(e))) : null,
    ]);
    return out;
  };
}
