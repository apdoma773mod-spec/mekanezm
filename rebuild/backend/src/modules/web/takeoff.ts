import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { geminiKey } from './catalog-ai.js';

/**
 * 📐 «ارفع رسمتك → حصر الإكسسوارات» للموقع العام (site: /takeoff) — نسخة 2.
 * هنا بس «القراءة»: Gemini بيطلّع وصف منظّم للوحدات. العدّ نفسه بيتحسب في الموقع (site/src/lib/takeoff.ts).
 *
 * الجديد في النسخة دي (طلبات عبده بعد أول تجربة حقيقية):
 *  - العدّ بالتعليم: كل درج وكل ضلفة لازم يتعلّم عليها بمربع (marks) على الصفحة، والعدد = عدد المربعات.
 *    الموقع بيرسم المربعات فوق رسمة الصنايعي، فيشوف بعينه لو فيه درج اتنسى (٢٠ درج ما يطلعوش ٦).
 *  - جرار ولا مفصلي: الموديل بيقول هو متأكد قد إيه (`sure`) وليه، ولو مش متأكد الموقع بيسأل الصنايعي بضغطة.
 *  - القواطيع الرأسية: `dividers = -1` لو الرسمة مقفولة ومش مبيّنة اللي جوه (الموقع بيحسبها من الضلف).
 *  - قراءة تانية مستقلة بالتوازي بتعدّ بس (ضلف / أدراج / نوع الضلف) — أي فرق بيرجع في `doubt`.
 *  - تفكير 'low' في القراءة الأساسية (العدّ محتاج تركيز) ولو اتأخرت بنرجع لـ 'minimal'.
 *
 * POST /api/v1/web/public/takeoff
 *   { files: [{ mt, data(base64), name? }] (≤ 8), text?: string, note?: string }
 *   → { model: Model, doubt: string[], reads: number }
 */

// نفس ترتيب موديلات القراءة الشغالة في باقي السيستم (catalog-ai.ts)
const MODELS = [...new Set([process.env.TAKEOFF_MODEL, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-latest'].filter(Boolean))] as string[];
const DAY_KEY = 'takeoff_day';
// نفس مفتاح Gemini بيقرا فواتير الشراء في السيستم: سقف الزوار أقل عشان حصة جوجل المجانية تفضل للسيستم
const DAILY_MAX = Math.max(1, Number(process.env.TAKEOFF_DAILY_MAX) || 40);
const MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const PROMPT = `انت خبير نجارة وتركيب مطابخ ودريسنج ودواليب في مصر. قدامك ملفات مشروع لصنايعي (رسم 2D أو 3D، مساقط، واجهات، قطاعات، جدول تقطيع، اسكتش بالإيد، أو صورة مطبخ/دولاب حقيقي). الصور مرقّمة بالترتيب اللي اتبعتت بيه: أول صورة p=0، التانية p=1، وهكذا.
المطلوب: توصف كل «وحدة» (دولاب/بلاكار/كابينة) وصف منظّم ودقيق جدًا. ماتحسبش إكسسوارات — احنا هنحسبها. انت بس اقرا الرسم صح.

أهم قاعدة — العدّ بالتعليم:
- كل درج وكل ضلفة ظاهرين في الرسمة لازم تعلّم عليهم واحد واحد في "marks": مربع حوالين كل واحد لوحده [ymin,xmin,ymax,xmax] بأرقام صحيحة من 0 لـ 1000 على الصورة p.
- امشي على الرسمة بالترتيب: من الشمال لليمين، ومن فوق لتحت، وحدة وحدة. ماتسيبش أي درج أو ضلفة من غير علامة، وماتعلّمش على نفس الحاجة مرتين. لو نفس الوحدة مرسومة في أكتر من منظر (واجهة + منظور) علّم على منظر واحد بس — الواجهة الأوضح.
- بعد ما تخلّص التعليم، count بتاع الأدراج في كل وحدة = عدد علامات "drawer" بتاعتها بالظبط، وcount الضلف = عدد علامات الضلف بتاعتها بالظبط. لو الرسمة فيها 20 درج لازم يطلعوا 20 علامة و20 في العدد. ممنوع التقدير أو التقريب.
- الدرج: مستطيل عرضي قصير (غالبًا ارتفاعه 10–30 سم) متكرر فوق بعضه، غالبًا بمقبض في نصه. الضلفة: مستطيل طولي أعلى. الرف المفتوح مش درج ومش ضلفة.
- لو الملف جدول/نص من غير رسم، سيب marks فاضية.

جرار ولا مفصلي (مهمة جدًا — ماتفترضش مفصلي من غير دليل):
- دلائل الجرار (sliding): سهم عرضي ↔ على الضلف، ضلف راكبة على بعض (خط مزدوج أو إزاحة)، سكة/مجرى فوق وتحت، مقبض دفن طولي على حرف الضلفة، ضلف عريضة (60–120 سم) بطول الدولاب كله، في المسقط الأفقي ضلفتين على خطين متوازيين، أو مكتوب sliding / جرار / سحاب.
- دلائل المفصلي (hinged): مثلث أو خط منقّط مائل على الضلفة (راسه ناحية المفصلات)، قوس فتح في المسقط الأفقي، مفصلات مرسومة، ضلف ضيقة (30–60 سم) أزواج بمقابض جنب بعض في النص، أو مكتوب hinged / مفصلي.
- "sure" لكل مجموعة ضلف: 0.9+ لو فيه دليل صريح من دول، 0.6–0.7 لو استنتاج من العرض بس، 0.5 أو أقل لو الرسمة مستطيلات مقفولة من غير أي دليل. واكتب الدليل اللي اعتمدت عليه في "why". لو مفيش دليل اسأل في questions.

باقي قواعد القراءة:
1) كل الأبعاد بالسنتيمتر بدقة المليمتر (مثلاً 49.5). لو الرسم بالمليمتر حوّل (600 مم = 60 سم). لو البُعد مش مكتوب ومش واضح حطه 0 — ماتألّفش مقاس.
2) أنواع الضلف: hinged، sliding، lift_up (قلاب لفوق)، flap_down (قلاب لتحت)، folding (أكورديون). خامة الضلفة: wood، glass، alu_frame (ألمنيوم بزجاج)، mirror.
3) الدرج الداخلي (جوه ضلفة) inner=true. عمق الوحدة d هو اللي بيحدد طول المجر، فدوّر عليه في المسقط أو القطاع.
4) الأرفف: رف متحرك على تكايات (shelves_adjustable) ورف ثابت أفقي بيتجمع في الجناب (shelves_fixed).
5) القواطيع الرأسية (الجناب اللي في النص بين المربعات) = dividers. لو الرسمة مبيّنة اللي جوه الدولاب (قطاع، واجهة من غير ضلف، مسقط) اكتب العدد وخلّي dividers_seen=true حتى لو العدد 0. لو الدولاب مرسوم مقفول ومش باين اللي جوه اكتب dividers=-1 و dividers_seen=false.
6) مواسير التعليق (rails): طول كل ماسورة بالسنتيمتر.
7) الوحدة المعلّقة mount="wall"، والواقفة على الأرض mount="floor". لو تحتها قاعدة خشب/وزرة plinth=true، ولو على رجول legs=true.
8) الركنة العمياء أو L: corner=true.
9) الإكسسوارات الجاهزة الظاهرة أو المكتوبة (pullouts) بالكلمات دي بس: magic_corner, bean_corner, pantry, basket, dish_rack, bin, spice, shoe_rack, trouser, tie, safe, mirror_pull, ironing, hanger_lift, jewelry, led, lock.
10) المقابض: handle، gola (بروفيل جولا)، push (طباشة)، unknown.
11) الوحدات المتكررة بنفس التفاصيل تتكتب مرة واحدة بـ count — بس علاماتها كلها تتعلّم.
12) جدول تقطيع من غير رسم: استنتج الوحدات من أسماء القطع (جنب، قاعدة، سقف، رف، قاطوع، ضلفة، وش درج…).
13) confidence لكل وحدة: 0.9+ لو العدد والمقاس مكتوبين صريح، 0.6 لو واضح بالنظر بس، أقل لو مش متأكد.
14) questions: بالعامية المصرية، سؤال قصير لكل حاجة مش واضحة. assumptions: أي افتراض عملته.
15) لو الملفات مش رسمة أثاث أصلًا رجّع units فاضية و kind="other" واكتب في summary إيه اللي شفته.

رجّع JSON بس بالشكل ده بالظبط (u في marks = ترتيب الوحدة في units ابتداءً من 0، و k واحدة من: drawer, door, sliding, flap):
{"kind":"kitchen|dressing|wardrobe|tv|bathroom|office|other","summary":"سطر واحد بالعامية","quality":"clear|partial|poor",
 "units":[{"name":"اسم قصير بالعربي","type":"base|wall|tall|wardrobe|drawer_unit|open|island|other","count":1,
   "w":0,"h":0,"d":0,"mount":"floor|wall","plinth":false,"legs":false,"corner":false,
   "doors":[{"kind":"hinged|sliding|lift_up|flap_down|folding","material":"wood|glass|alu_frame|mirror","count":0,"h":0,"w":0,"sure":0.0,"why":""}],
   "drawers":[{"count":0,"inner":false,"front_h":0}],
   "shelves_adjustable":0,"shelves_fixed":0,"dividers":-1,"dividers_seen":false,
   "rails":[{"len":0}],
   "pullouts":[{"kind":"magic_corner","count":1}],
   "handles":"handle|gola|push|unknown","note":"","confidence":0.0}],
 "marks":[{"p":0,"u":0,"k":"drawer","box":[0,0,0,0]}],
 "questions":[""],"assumptions":[""]}`;

/** القراءة التانية المستقلة: عدّ بس، من غير وصف — عشان نقارن */
const CHECK = `قدامك رسومات أثاث (مطبخ / دريسنج / دولاب). عايز عدّ بس، بدقة كاملة، من الرسم نفسه (مش تخمين):
- drawers: عدد كل الأدراج الظاهرة (مستطيلات عرضية قصيرة فوق بعضها). عدّهم واحد واحد من الشمال لليمين ومن فوق لتحت. لو نفس الوحدة مرسومة في أكتر من منظر عدّها مرة واحدة.
- hinged: عدد الضلف المفصلي. sliding: عدد الضلف الجرار. flaps: عدد الضلف القلاب.
- door_type: نوع ضلف الدولاب الأساسي: "sliding" لو فيه دليل جرار (سهم عرضي، ضلف راكبة على بعض، سكة، ضلف عريضة بطول الدولاب)، "hinged" لو فيه دليل مفصلي (مثلث/خط منقّط مائل، قوس فتح، مفصلات، ضلف ضيقة أزواج)، "unknown" لو مفيش دليل.
رجّع JSON بس: {"drawers":0,"hinged":0,"sliding":0,"flaps":0,"door_type":"hinged|sliding|unknown"}`;

type Door = { kind?: string; material?: string; count?: number; h?: number; w?: number; sure?: number; why?: string };
type Unit = {
  name?: string; type?: string; count?: number; w?: number; h?: number; d?: number; mount?: string; plinth?: boolean; legs?: boolean; corner?: boolean;
  doors?: Door[]; drawers?: { count?: number; inner?: boolean; front_h?: number }[]; shelves_adjustable?: number; shelves_fixed?: number; dividers?: number; dividers_seen?: boolean;
  rails?: { len?: number }[]; pullouts?: { kind?: string; count?: number }[]; handles?: string; note?: string; confidence?: number;
};
type Model = { kind?: string; summary?: string; quality?: string; units?: Unit[]; marks?: unknown[]; questions?: string[]; assumptions?: string[] };
type Check = { drawers?: number; hinged?: number; sliding?: number; flaps?: number; door_type?: string };

const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);

function totals(m: Model) {
  const t = { hinged: 0, sliding: 0, flaps: 0, drawers: 0 };
  for (const u of m.units ?? []) {
    const c = Math.max(1, Math.round(n(u.count) || 1));
    for (const d of u.doors ?? []) {
      const k = Math.round(n(d.count)) * c;
      if (d.kind === 'sliding') t.sliding += k;
      else if (d.kind === 'lift_up' || d.kind === 'flap_down') t.flaps += k;
      else t.hinged += k;
    }
    for (const d of u.drawers ?? []) t.drawers += Math.round(n(d.count)) * c;
  }
  return t;
}

/** سؤال واحد لـ Gemini بيرجّع JSON. كل محاولة ليها مستوى تفكير ومهلة، ولو اتأخرت اللي بعدها أخف وأسرع. */
async function ask<T>(key: string, parts: unknown[], deadline: number, plan: { thinking: 'low' | 'minimal'; ms: number }[], tag: string): Promise<T | null> {
  let step = 0;
  for (const model of MODELS) {
    const at = plan[Math.min(step, plan.length - 1)]!;
    const left = deadline - Date.now();
    if (left < 4000) return null;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 24000, thinkingConfig: { thinkingLevel: at.thinking } } }),
        signal: AbortSignal.timeout(Math.min(left, at.ms)),
      });
      const body = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      if (!r.ok) {
        console.warn('[takeoff]', tag, model, r.status, JSON.stringify(body).slice(0, 300));
        if ([400, 404, 429, 500, 503].includes(r.status)) continue; // model closed / busy → next one
        return null;
      }
      const t = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || '').join('');
      const j = t.match(/\{[\s\S]*\}/)?.[0];
      if (!j) continue;
      const m = JSON.parse(j) as T;
      if (m && typeof m === 'object') return m;
    } catch (e) {
      console.warn('[takeoff]', tag, model, at.thinking, (e as Error)?.name, String((e as Error)?.message).slice(0, 200));
      step++; // timeout / bad JSON → next model, lighter and faster
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
    // 🛡️ المسار ده مفتوح للزوار وكل طلب = قراءتين من Gemini: سقف يومي للكل عشان الرصيد ما يتحرقش
    const day = new Date().toISOString().slice(0, 10);
    const used = ((await db.setting.findUnique({ where: { key: DAY_KEY } }))?.value ?? {}) as { d?: string; n?: number };
    const count = used.d === day ? (used.n ?? 0) : 0;
    if (count >= DAILY_MAX) throw badRequest('الخدمة عليها ضغط النهارده — ابعت الرسمة على الواتساب واحنا نحصرهالك');
    await db.setting.upsert({ where: { key: DAY_KEY }, create: { key: DAY_KEY, value: { d: day, n: count + 1 } }, update: { value: { d: day, n: count + 1 } } });

    const extra: unknown[] = [];
    if (b.note.trim()) extra.push({ text: 'ملاحظة من الصنايعي: ' + b.note.trim() });
    if (b.text.trim()) extra.push({ text: 'نص مستخرج من الملفات (جداول / DXF / نصوص):\n' + b.text });
    const files = b.files.map((f) => ({ inline_data: { mime_type: f.mt, data: f.data } }));

    const deadline = Date.now() + 110_000; // the function allows 300 s (vercel.json); the site waits 130 s
    const [model, check] = await Promise.all([
      ask<Model>(key, [{ text: PROMPT }, ...extra, ...files], deadline, [{ thinking: 'low', ms: 70_000 }, { thinking: 'minimal', ms: 38_000 }], 'read'),
      // the count-only check needs pictures; a table-only request has nothing to count on
      files.length ? ask<Check>(key, [{ text: CHECK }, ...extra, ...files], deadline, [{ thinking: 'low', ms: 45_000 }, { thinking: 'minimal', ms: 30_000 }], 'check') : null,
    ]);
    if (!model || !Array.isArray(model.units)) throw badRequest('مقدرناش نقرا الملف دلوقتي — جرّب تاني أو ابعته على الواتساب');

    // Every total the two independent reads disagree on → the site shows «اتأكد» on what depends on it.
    const doubt: string[] = [];
    if (check) {
      const t = totals(model);
      for (const k of ['drawers', 'hinged', 'sliding', 'flaps'] as const) if (typeof check[k] === 'number' && Math.round(check[k]!) !== t[k]) doubt.push(k);
      // The two reads disagree on hinged vs sliding, or the checker saw no evidence: the site asks the craftsman.
      const main = t.sliding > t.hinged ? 'sliding' : t.hinged ? 'hinged' : '';
      if (main && check.door_type && check.door_type !== main) {
        for (const u of model.units) for (const d of u.doors ?? []) if (d.kind === 'hinged' || d.kind === 'sliding') d.sure = Math.min(typeof d.sure === 'number' ? d.sure : 0.7, check.door_type === 'unknown' ? 0.7 : 0.4);
      }
    }
    return { model, doubt, reads: check ? 2 : 1 };
  });
}
