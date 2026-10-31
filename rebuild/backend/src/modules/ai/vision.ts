import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NO_KEY } from './routes.js';
import { MAX_B64, MODEL, TYPES } from './read-image.js';
import { parse } from '../../lib/validate.js';
import { AppError } from '../../lib/errors.js';

/**
 * «📷 صوّر القطعة يطلعلك الصنف» (old match-product) and «✨ اكتب الوصف» (old describe-product).
 * The old edge functions are not in the repo, so the prompts here are written from how the old screens used them:
 *  match-product({image}) → {seen, matches:[{code, score 0-100, why}]}   describe-product({name,cat,hint,image_url,kind}) → {description}
 */
const GEMINI_MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean))] as string[];

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
        if ([400, 404, 429, 500, 503].includes(r.status)) continue;
        break;
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
  gemini: { type: 'OBJECT', properties: { description: { type: 'STRING' } }, required: ['description'] },
  claude: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'] },
};

async function fetchImage(url: string): Promise<{ data: string; mt: string } | undefined> {
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

  /** POST /ai/describe-product {name,cat,hint,image_url?,kind?} → {description}. */
  app.post('/describe-product', { preHandler: app.requireAdmin, bodyLimit: 10 * 1024 * 1024 }, async (request) => {
    const b = parse(z.object({ name: z.string().min(1).max(300), cat: z.string().max(200).optional(), hint: z.string().max(2000).optional(), image_url: z.string().max(8_000_000).optional(), kind: z.string().max(200).optional() }), request.body);
    const img = b.image_url ? await fetchImage(b.image_url) : undefined;
    const prompt = `اكتب وصف تسويقي قصير (٢ لـ ٤ جمل) بالعربي المصري المبسّط لمنتج في محل ${b.kind || 'إكسسوارات ومستلزمات المطابخ وغرف الدريسنج'}.
الاسم: ${b.name}${b.cat ? `\nالقسم: ${b.cat}` : ''}${b.hint ? `\nمعلومات: ${b.hint}` : ''}
${img ? 'اعتمد على الصورة المرفقة كمان.' : ''}
اكتب الفايدة والخامة والاستخدام. ماتألفش مواصفات أو أرقام أو ضمان مش مذكورة. من غير إيموجي ومن غير أسعار.`;
    const out = await askJson(prompt, DESC_SCHEMA, img);
    const description = String(out.description ?? '').trim();
    if (!description) throw new AppError(422, 'BAD_REQUEST', 'ماجاش وصف');
    return { description };
  });
}
