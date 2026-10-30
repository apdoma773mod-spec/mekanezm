import type { FastifyInstance } from 'fastify';
import { MAX_B64, MODEL, PROMPT, TOOL, TYPES, json, readTransfer, viaGemini } from './read-image.js';

/** POST /ai/read-image {image, media_type, kind?: 'transfer', part?} — the old parse-invoice, for logged-in users. */
export default async function aiRoutes(app: FastifyInstance) {
  app.post('/read-image', { preHandler: app.authenticate, bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
    // the old function answered {error: 'text'}; the new app reads {error: {code, message}}
    const send = (r: { status: number; body: Record<string, unknown> }) =>
      reply.code(r.status).send(r.status >= 400 && typeof r.body.error === 'string' ? { error: { code: 'AI_READ', message: r.body.error } } : r.body);
    try {
      const gkey = process.env.GEMINI_API_KEY;
      const key = process.env.ANTHROPIC_API_KEY;
      if (!gkey && !key) return send(json({ error: 'قراءة الصور محتاجة مفتاح ذكاء اصطناعي (GEMINI_API_KEY مجاني أو ANTHROPIC_API_KEY) — كلّم المطوّر' }, 503));
      const { image: raw, media_type, kind, part } = (request.body ?? {}) as { image?: unknown; media_type?: string; kind?: string; part?: { i?: number; n?: number } };
      if (typeof raw !== 'string' || !raw) return send(json({ error: 'مفيش صورة' }, 400));
      const image = raw.replace(/^data:[^,]+,/, '');
      if (image.length > MAX_B64) return send(json({ error: 'الصورة كبيرة — صوّرها تاني بحجم أصغر' }, 413));
      const mt = TYPES.includes(media_type ?? '') ? media_type! : 'image/jpeg';
      if (kind === 'transfer') {
        try {
          return send(json(await readTransfer(gkey, key, image, mt)));
        } catch (e) {
          return send(json({ error: String((e as Error).message || e) }, 502));
        }
      }
      if (gkey) return send(await viaGemini(gkey, image, mt, part && Number(part.n) > 1 ? { i: Number(part.i) || 1, n: Number(part.n) } : undefined));
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: 'record_invoice' },
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mt, data: image } }, { type: 'text', text: PROMPT }] }],
        }),
      });
      const body = (await r.json()) as { error?: { message?: string }; content?: { type: string; input?: unknown }[] };
      if (!r.ok) return send(json({ error: body?.error?.message || `Anthropic ${r.status}` }, 502));
      const tu = (body.content || []).find((c) => c.type === 'tool_use');
      if (!tu) return send(json({ error: 'ماقدرتش أقرا الفاتورة' }, 422));
      return send(json(tu.input));
    } catch (e) {
      return send(json({ error: String((e as Error).message || e) }, 500));
    }
  });
}
