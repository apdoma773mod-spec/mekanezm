import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NO_KEY } from './routes.js';
import { MAX_B64, MODEL, TYPES } from './read-image.js';
import { parse } from '../../lib/validate.js';
import { getFile } from '../../lib/files.js';
import { AppError } from '../../lib/errors.js';

/**
 * «📷 صوّر القطعة يطلعلك الصنف» (old match-product) and «✨ اكتب الوصف» (old describe-product).
 * The old edge functions are not in the repo, so the prompts here are written from how the old screens used them:
 *  match-product({image}) → {seen, matches:[{code, score 0-100, why}]}   describe-product({name,cat,hint,image_url,kind}) → {description}
 */
const GEMINI_MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))] as string[];

type Schema = { gemini: Record<string, unknown>; claude: Record<string, unknown>; tool: string };

/** One JSON answer from Gemini (preferred) or Claude, with or without a picture. */
async function askJson(prompt: string, schema: Schema, img?: { data: string; mt: string }): Promise<Record<string, unknown>> {
  const gkey = process.env.GEMINI_API_KEY;
  const akey = process.env.ANTHROPIC_API_KEY;
  if (!gkey && !akey) throw new AppError(503, 'BAD_REQUEST', NO_KEY);
  let last = '';
  if (gkey) {
    for (const m of GEMINI_MODELS) {
      const parts: unknown[] = [{ text: prompt + '\nرجّع JSON بس.' }];
      if (img) parts.push({ inline_data: { mime_type: img.mt, data: img.data } });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': gkey, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema.gemini, temperature: 0.2 } }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };
      if (!r.ok) {
        last = body?.error?.message || `Gemini ${r.status}`;
        // مفتاح غلط = مفيش فايدة نكمل؛ أي حاجة تانية (موديل اتقفل/زحمة) نجرّب اللي بعده
        if (r.status === 401) break;
        continue;
      }
      try {
        return JSON.parse(body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '') as Record<string, unknown>;
      } catch {
        last = 'رد مش مفهوم';
      }
    }
    if (!akey) throw new AppError(502, 'BAD_REQUEST', last || 'الذكاء الاصطناعي مردش');
  }
  const content: unknown[] = [];
  if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.mt, data: img.data } });
  content.push({ type: 'text', text: prompt });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': akey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [{ name: schema.tool, description: 'سجّل الرد', input_schema: schema.claude }],
      tool_choice: { type: 'tool', name: schema.tool },
      messages: [{ role: 'user', content }],
    }),
  });
  const body = (await r.json()) as { error?: { message?: string }; content?: { type: string; input?: Record<string, unknown> }[] };
  if (!r.ok) throw new AppError(502, 'BAD_REQUEST', body?.error?.message || `Anthropic ${r.status}`);
  const tu = (body.content || []).find((c) => c.type === 'tool_use');
  if (!tu?.input) throw new AppError(422, 'BAD_REQUEST', 'الذكاء الاصطناعي مردش');
  return tu.input;
}

const MATCH_SCHEMA: Schema = {
  tool: 'record_match',
  gemini: {
    type: 'OBJECT',
    properties: {
      seen: { type: 'STRING' },
      matches: { type: 'ARRAY', items: { type: 'OBJECT', properties: { code: { type: 'STRING' }, score: { type: 'NUMBER' }, why: { type: 'STRING' } }, required: ['code', 'score'] } },
    },
    required: ['seen', 'matches'],
  },
  claude: {
    type: 'object',
    properties: {
      seen: { type: 'string', description: 'وصف قصير للقطعة اللي في الصورة' },
      matches: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['code', 'score'] } },
    },
    required: ['seen', 'matches'],
  },
};

const DESC_SCHEMA: Schema = {
  tool: 'record_description',
  gemini: {
    type: 'OBJECT',
    properties: {
      description: { type: 'STRING' },
      specs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { k: { type: 'STRING' }, v: { type: 'STRING' } }, required: ['k', 'v'] } },
    },
    required: ['description', 'specs'],
  },
  claude: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      specs: { type: 'array', items: { type: 'object', properties: { k: { type: 'string' }, v: { type: 'string' } }, required: ['k', 'v'] } },
    },
    required: ['description', 'specs'],
  },
};

/** أرقام عربي/إنجليزي → إنجليزي، عشان نقارن أرقام الوصف بأرقام المعلومات اللي اتبعتت */
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const numsOf = (s: string) => new Set(toLatin(s).match(/\d+(?:[.,]\d+)?/g)?.map((x) => x.replace(',', '.')) ?? []);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const PRICE = /(جنيه|ج\.م|سعر|EGP|LE\b)/i;

/**
 * الدقة قبل أي حاجة: أي جملة أو مواصفة فيها رقم مش مذكور في اللي اتبعت (الاسم/المعلومات) بتتشال —
 * الموديل ممكن «يتخيّل» مقاس أو تحميل أو سنين ضمان، والعميل هيتبني على الكلام ده.
 */
export function cleanDescription(out: { description?: unknown; specs?: unknown }, source: string) {
  const known = numsOf(source);
  const safe = (t: string) => [...numsOf(t)].every((n) => known.has(n)) && !PRICE.test(t);
  const sentences = String(out.description ?? '')
    .replace(EMOJI, '')
    .replace(/[ \t]+([.!؟?،])/g, '$1')
    .split(/(?<=[.!؟?۔])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x && safe(x));
  const seen = new Set<string>();
  const specs: { k: string; v: string }[] = [];
  for (const s of Array.isArray(out.specs) ? (out.specs as { k?: unknown; v?: unknown }[]) : []) {
    const k = String(s.k ?? '').replace(EMOJI, '').trim().slice(0, 40);
    const v = String(s.v ?? '').replace(EMOJI, '').trim().slice(0, 80);
    if (!k || !v || seen.has(k) || !safe(`${k} ${v}`)) continue;
    seen.add(k);
    specs.push({ k, v });
    if (specs.length >= 8) break;
  }
  return { description: sentences.join(' ').slice(0, 900), specs };
}

const sniff = (b: Buffer): string | undefined =>
  b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : undefined;

async function fetchImage(url: string): Promise<{ data: string; mt: string } | undefined> {
  // صورة اتخزنت في السيستم (بلينك كامل أو نسبي): بنقراها من التخزين على طول من غير طلب شبكة
  const f = /^(?:https?:\/\/[^/]+)?\/api\/v1\/work\/files\/([\w.-]+)$/.exec(url);
  if (f) {
    const buf = await getFile(f[1]!).catch(() => null);
    const mt = buf ? sniff(buf) : undefined;
    return buf && mt && buf.length < 5_000_000 ? { data: buf.toString('base64'), mt } : undefined;
  }
  const m = /^data:([^;]+);base64,(.+)$/s.exec(url);
  if (m) return TYPES.includes(m[1]!) && m[2]!.length < MAX_B64 ? { data: m[2]!, mt: m[1]! } : undefined;
  if (!/^https?:\/\//.test(url)) return undefined;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const mt = (r.headers.get('content-type') || '').split(';')[0] ?? '';
    if (!r.ok || !TYPES.includes(mt) || buf.length > 5_000_000) return undefined;
    return { data: buf.toString('base64'), mt };
  } catch {
    return undefined;
  }
}

export default async function visionRoutes(app: FastifyInstance) {
  const db = app.prisma;

  /** POST /ai/match-product {image, media_type?} → {seen, matches:[{code,score,why}]} (only codes that exist). */
  app.post('/match-product', { preHandler: app.authenticate, bodyLimit: 10 * 1024 * 1024 }, async (request) => {
    const { image: raw, media_type } = parse(z.object({ image: z.string().min(1), media_type: z.string().optional() }), request.body);
    const image = raw.replace(/^data:[^,]+,/, '');
    if (image.length > MAX_B64) throw new AppError(413, 'BAD_REQUEST', 'الصورة كبيرة — صوّرها تاني بحجم أصغر');
    const mt = TYPES.includes(media_type ?? '') ? media_type! : 'image/jpeg';
    const products = await db.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      take: 1500,
      select: { code: true, name: true, category: true, info: { select: { brand: true, finish: true, size: true } } },
    });
    if (!products.length) return { seen: '', matches: [] };
    const list = products.map((p) => [p.code, p.name, p.category, p.info?.brand, p.info?.finish, p.info?.size].filter(Boolean).join(' | ')).join('\n');
    const prompt = `دي صورة قطعة (إكسسوار أو مستلزم مطابخ/غرف دريسنج/نجارة) واحد عميل صوّرها في محل.
اوصف القطعة في سطر واحد بالعربي في seen (النوع، الخامة، اللون/التشطيب، الشكل).
بعدين اختار من قايمة أصناف المحل تحت أقرب ٣ أصناف على الأكتر للقطعة دي، مرتّبين من الأشبه للأقل، كل واحد فيه:
code = الكود زي ما هو في القايمة بالظبط، score = نسبة الشبه من ٠ لـ ١٠٠، why = سبب قصير بالعربي.
ماتختارش صنف مش شبهها فعلًا — لو مفيش شبه حقيقي رجّع matches فاضية. ماتخترعش أكواد مش في القايمة.

قايمة الأصناف (كود | الاسم | القسم | الماركة | التشطيب | المقاس):
${list}`;
    const out = await askJson(prompt, MATCH_SCHEMA, { data: image, mt });
    const known = new Set(products.map((p) => p.code));
    const matches = (Array.isArray(out.matches) ? (out.matches as { code?: unknown; score?: unknown; why?: unknown }[]) : [])
      .filter((m) => known.has(String(m.code)))
      .slice(0, 3)
      .map((m) => ({ code: String(m.code), score: Math.max(0, Math.min(100, Number(m.score) || 0)), why: String(m.why ?? '') }));
    return { seen: String(out.seen ?? ''), matches };
  });

  /**
   * POST /ai/describe-product {name,cat,hint,image_url?,kind?} → {description, specs:[{k,v}]}.
   * الوصف 2-4 جمل بالمصري المبسط + مواصفات قصيرة (المقاس/الخامة/اللون…) من اللي مذكور أو باين في الصورة بس.
   * أي رقم مش في المعلومات المبعوتة بيتشال (cleanDescription).
   */
  app.post('/describe-product', { preHandler: app.requireAdmin, bodyLimit: 10 * 1024 * 1024 }, async (request) => {
    const b = parse(z.object({ name: z.string().min(1).max(300), cat: z.string().max(200).optional(), hint: z.string().max(2000).optional(), image_url: z.string().max(8_000_000).optional(), kind: z.string().max(200).optional() }), request.body);
    const img = b.image_url ? await fetchImage(b.image_url) : undefined;
    const source = [b.name, b.cat, b.hint].filter(Boolean).join('\n');
    const prompt = `انت بتكتب وصف منتج لمحل ${b.kind || 'إكسسوارات ومستلزمات المطابخ وغرف الدريسنج والنجارة'} في مصر، والوصف هيتعرض للعميل على الموقع وفي الواتساب.
الاسم: ${b.name}${b.cat ? `\nالقسم: ${b.cat}` : ''}${b.hint ? `\nمعلومات مؤكدة: ${b.hint}` : ''}
${img ? 'في صورة للمنتج مرفقة: اعتمد عليها في النوع والشكل والخامة واللون الباين بوضوح بس.' : 'مفيش صورة، اعتمد على الاسم والمعلومات بس.'}

description: من ٢ لـ ٤ جمل بالعربي المصري المبسّط: المنتج إيه، بيتعمل منه إيه (لو باين أو مذكور)، وبيتستخدم في إيه. جمل كاملة ومترابطة، من غير حشو ولا مبالغة (مفيش «الأفضل» و«رقم واحد»).
specs: من ٠ لـ ٨ مواصفات قصيرة، كل واحدة k = اسم المواصفة (المقاس، الخامة، اللون، التشطيب، الماركة…) و v = قيمتها.

قواعد صارمة (الغلط هنا بيضيّع ثقة العميل):
- ماتكتبش أي رقم أو مقاس أو وزن أو حمولة أو ضمان أو بلد صنع إلا لو مكتوب بحروفه في الاسم أو المعلومات المؤكدة.
- ماتذكرش ماركة إلا لو مذكورة أو مكتوبة بوضوح على المنتج في الصورة.
- لو مش متأكد من مواصفة سيبها — مواصفة ناقصة أحسن من مواصفة غلط.
- من غير إيموجي، ومن غير أسعار أو كلام عن العروض.`;
    const out = await askJson(prompt, DESC_SCHEMA, img);
    const r = cleanDescription(out, source);
    if (!r.description) throw new AppError(422, 'BAD_REQUEST', 'مقدرتش أكتب وصف مضمون من البيانات دي — زوّد معلومات (الماركة أو المقاس أو الخامة) وجرّب تاني');
    return r;
  });
}
