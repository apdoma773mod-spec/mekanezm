import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { geminiKey } from './catalog-ai.js';

/**
 * 📐 «ارفع رسمتك → حصر الإكسسوارات» للموقع العام (site: /takeoff).
 * الصنايعي بيرفع رسمة / PDF / صورة / جدول تقطيع، والموقع بيبعت هنا الصفحات كصور أو PDF + أي نص مستخرج (Excel / DXF).
 * هنا بس «القراءة»: Gemini بيطلّع وصف منظّم للوحدات (ضلف، أدراج، أرفف، مواسير…) — من غير أي عدّ للإكسسوار.
 * العدّ نفسه (كام مفصلة، كام مجر…) بيتحسب في الموقع بقواعد ثابتة (site/src/lib/takeoff.ts) عشان يبقى دقيق ومتكرر.
 * الدقة: قراءتين مستقلتين بالتوازي؛ لو اختلفوا في إجمالي الضلف/الأدراج/الأرفف بنرجّع الفرق في `doubt` والموقع يقول «اتأكد».
 *
 * POST /api/v1/web/public/takeoff
 *   { files: [{ mt, data(base64), name? }] (≤ 8), text?: string, note?: string }
 *   → { model: Model, doubt: string[], reads: number }
 */

// نفس ترتيب موديلات القراءة الشغالة في باقي السيستم (catalog-ai.ts)
const MODELS = [...new Set([process.env.TAKEOFF_MODEL, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-latest'].filter(Boolean))] as string[];
const DAY_KEY = 'takeoff_day';
const DAILY_MAX = Math.max(1, Number(process.env.TAKEOFF_DAILY_MAX) || 150);
const MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const PROMPT = `انت خبير نجارة وتركيب مطابخ ودريسنج ودواليب في مصر. قدامك ملفات مشروع لصنايعي (رسم 2D أو 3D، مساقط، واجهات، جدول تقطيع، صورة اسكتش بالإيد، أو صورة مطبخ/دولاب حقيقي).
المطلوب: توصف كل «وحدة» (دولاب/بلاكار/كابينة) موجودة في المشروع وصف منظّم ودقيق. ماتحسبش إكسسوارات خالص — احنا هنحسبها. انت بس اقرا الرسم صح.

قواعد القراءة (مهمة جدًا):
1) عِدّ من الرسم نفسه، وحدة وحدة، من الشمال لليمين، ومن الأرضي للعلوي. ماتخمّنش عدد من شكل عام.
2) كل الأبعاد بالسنتيمتر. لو الرسم بالمليمتر حوّل (600 مم = 60 سم). لو البُعد مش مكتوب ومش واضح حطه 0 — ماتألّفش مقاس.
3) الضلفة = باب. فرّق بين: مفصلي (hinged)، جرار/سحاب (sliding)، قلاب لفوق (lift_up)، قلاب لتحت (flap_down)، أكورديون (folding). لو الدولاب جرار ماتحسبوش مفصلي.
4) خامة الضلفة: خشب (wood)، زجاج (glass)، ألمنيوم بزجاج (alu_frame)، مراية (mirror).
5) الدرج: عدد الأدراج، وعمق الوحدة (d) هو اللي بيحدد طول المجر. لو فيه درج داخلي (جوه ضلفة) علّم inner=true.
6) الأرفف: فرّق بين رف متحرك على تكايات (shelves_adjustable) ورف ثابت/قاطوع أفقي (shelves_fixed). القواطيع الرأسية (dividers) عددها لوحده.
7) مواسير التعليق (rails): طول كل ماسورة بالسنتيمتر.
8) الوحدة المعلّقة على الحيطة mount="wall"، والواقفة على الأرض mount="floor". لو فيها قاعدة خشب/وزرة تحتها plinth=true، ولو واقفة على رجول legs=true.
9) الركنة: لو وحدة ركنة عمياء أو L علّم corner=true.
10) الإكسسوارات الجاهزة اللي ظاهرة أو مكتوبة (pullouts): استخدم الكلمات دي بس: magic_corner, bean_corner, pantry, basket, dish_rack, bin, spice, shoe_rack, trouser, tie, safe, mirror_pull, ironing, hanger_lift, jewelry, led, lock.
11) المقابض: handle (مقبض عادي)، gola (بروفيل جولا/من غير مقبض بقطاع)، push (طباشة/بوش)، unknown.
12) لو نفس الوحدة متكررة بنفس التفاصيل، اكتبها مرة واحدة بـ count.
13) لو الملف جدول تقطيع (cut list) من غير رسم: استنتج الوحدات من أسماء القطع (جنب، قاعدة، سقف، رف، ضلفة، وش درج…) وعدّها بنفس الطريقة.
14) confidence لكل وحدة من 0 لـ 1: 0.9+ لو العدد والمقاس مكتوبين صريح، 0.6 لو واضح بالنظر بس، أقل لو مش متأكد.
15) questions: اكتب بالعامية المصرية أي حاجة مش واضحة ومحتاج الصنايعي يأكدها (سؤال قصير لكل نقطة). assumptions: أي افتراض عملته.
16) لو الملفات مش رسمة أثاث أصلًا (فاتورة، صورة شخص، حاجة تانية) رجّع units فاضية و kind="other" واكتب في summary إيه اللي شفته.

رجّع JSON بس بالشكل ده بالظبط:
{"kind":"kitchen|dressing|wardrobe|tv|bathroom|office|other","summary":"سطر واحد بالعامية","quality":"clear|partial|poor",
 "units":[{"name":"اسم قصير بالعربي (مثلاً: أرضي 60 ضلفة)","type":"base|wall|tall|wardrobe|drawer_unit|open|island|other","count":1,
   "w":0,"h":0,"d":0,"mount":"floor|wall","plinth":false,"legs":false,"corner":false,
   "doors":[{"kind":"hinged|sliding|lift_up|flap_down|folding","material":"wood|glass|alu_frame|mirror","count":0,"h":0,"w":0}],
   "drawers":[{"count":0,"inner":false,"front_h":0}],
   "shelves_adjustable":0,"shelves_fixed":0,"dividers":0,
   "rails":[{"len":0}],
   "pullouts":[{"kind":"magic_corner","count":1}],
   "handles":"handle|gola|push|unknown","note":"","confidence":0.0}],
 "questions":[""],"assumptions":[""]}`;

type Door = { kind?: string; material?: string; count?: number; h?: number; w?: number };
type Unit = {
  name?: string; type?: string; count?: number; w?: number; h?: number; d?: number; mount?: string; plinth?: boolean; legs?: boolean; corner?: boolean;
  doors?: Door[]; drawers?: { count?: number; inner?: boolean; front_h?: number }[]; shelves_adjustable?: number; shelves_fixed?: number; dividers?: number;
  rails?: { len?: number }[]; pullouts?: { kind?: string; count?: number }[]; handles?: string; note?: string; confidence?: number;
};
type Model = { kind?: string; summary?: string; quality?: string; units?: Unit[]; questions?: string[]; assumptions?: string[] };

const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);

/** Totals used to compare two independent reads. */
function totals(m: Model) {
  const t = { units: 0, hinged: 0, sliding: 0, flaps: 0, drawers: 0, shelves: 0, rails: 0 };
  for (const u of m.units ?? []) {
    const c = Math.max(1, Math.round(n(u.count) || 1));
    t.units += c;
    for (const d of u.doors ?? []) {
      const k = Math.round(n(d.count)) * c;
      if (d.kind === 'sliding') t.sliding += k;
      else if (d.kind === 'lift_up' || d.kind === 'flap_down') t.flaps += k;
      else t.hinged += k;
    }
    for (const d of u.drawers ?? []) t.drawers += Math.round(n(d.count)) * c;
    t.shelves += (Math.round(n(u.shelves_adjustable)) + Math.round(n(u.shelves_fixed))) * c;
    t.rails += (u.rails ?? []).length * c;
  }
  return t;
}
const avgConf = (m: Model) => {
  const us = m.units ?? [];
  return us.length ? us.reduce((s, u) => s + (typeof u.confidence === 'number' ? u.confidence : 0.5), 0) / us.length : 0;
};

async function ask(key: string, parts: unknown[], deadline: number): Promise<Model | null> {
  for (const model of MODELS) {
    const left = deadline - Date.now();
    if (left < 4000) return null;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 16000, thinkingConfig: { thinkingLevel: 'low' } } }),
        // مهلة لكل محاولة (مش كل الوقت الباقي) عشان موديل واحد بطيء ما ياكلش فرصة اللي بعده
        signal: AbortSignal.timeout(Math.min(left, 26_000)),
      });
      const body = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      if (!r.ok) {
        console.warn('[takeoff]', model, r.status, JSON.stringify(body).slice(0, 300));
        if ([400, 404, 429, 500, 503].includes(r.status)) continue; // model closed / busy → next one
        return null;
      }
      const t = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || '').join('');
      const j = t.match(/\{[\s\S]*\}/)?.[0];
      if (!j) continue;
      const m = JSON.parse(j) as Model;
      if (m && typeof m === 'object') return m;
    } catch (e) {
      console.warn('[takeoff]', model, (e as Error)?.name, String((e as Error)?.message).slice(0, 200)); // timeout or bad JSON → next model if there is time
    }
  }
  return null;
}

export async function takeoffRoutes(app: FastifyInstance) {
  const db = app.prisma;
  // Vercel caps the request body at 4.5 MB; the site keeps the whole request under ~4 MB.
  app.post('/public/takeoff', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } }, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const b = parse(
      z.object({
        files: z.array(z.object({ mt: z.string().max(40), data: z.string().min(20).max(11_000_000), name: z.string().max(200).optional() })).max(8).default([]),
        text: z.string().max(120_000).default(''),
        note: z.string().max(1000).default(''),
      }),
      request.body,
    );
    if (!b.files.length && b.text.trim().length < 10) throw badRequest('مفيش ملف اتبعت');
    for (const f of b.files) if (!MIME.test(f.mt)) throw badRequest('نوع الملف مش مدعوم');
    const key = await geminiKey(db);
    if (!key) throw badRequest('تحليل الرسومات مش شغال دلوقتي — ابعت الرسمة على الواتساب');
    // 🛡️ المسار ده مفتوح للزوار وكل طلب = قراءتين من Gemini: سقف يومي للكل (غير حد الـ6 في الدقيقة لكل جهاز) عشان الرصيد ما يتحرقش
    const day = new Date().toISOString().slice(0, 10);
    const used = ((await db.setting.findUnique({ where: { key: DAY_KEY } }))?.value ?? {}) as { d?: string; n?: number };
    const count = used.d === day ? (used.n ?? 0) : 0;
    if (count >= DAILY_MAX) throw badRequest('الخدمة عليها ضغط النهارده — ابعت الرسمة على الواتساب واحنا نحصرهالك');
    await db.setting.upsert({ where: { key: DAY_KEY }, create: { key: DAY_KEY, value: { d: day, n: count + 1 } }, update: { value: { d: day, n: count + 1 } } });

    const parts: unknown[] = [{ text: PROMPT }];
    if (b.note.trim()) parts.push({ text: 'ملاحظة من الصنايعي: ' + b.note.trim() });
    if (b.text.trim()) parts.push({ text: 'نص مستخرج من الملفات (جداول / DXF / نصوص):\n' + b.text });
    for (const f of b.files) parts.push({ inline_data: { mime_type: f.mt, data: f.data } });

    const deadline = Date.now() + 50_000; // the function itself is capped at 60 s
    const reads = (await Promise.all([ask(key, parts, deadline), ask(key, parts, deadline)])).filter((m): m is Model => !!m && Array.isArray(m.units));
    if (!reads.length) throw badRequest('مقدرناش نقرا الملف دلوقتي — جرّب تاني أو ابعته على الواتساب');

    // Two reads: keep the more confident one, and report every total they disagree on.
    reads.sort((a, c) => avgConf(c) - avgConf(a));
    const model = reads[0]!;
    const doubt: string[] = [];
    if (reads.length > 1) {
      const a = totals(reads[0]!), c = totals(reads[1]!);
      for (const k of Object.keys(a) as (keyof typeof a)[]) if (a[k] !== c[k]) doubt.push(k);
    }
    return { model, doubt, reads: reads.length };
  });
}
