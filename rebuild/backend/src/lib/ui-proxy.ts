import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * 🖥️ شاشات السيستم من جهاز المحل: أي طلب مش /api بيتبعت لنسخة الشاشة اللي شغالة على جهاز المحل (SHOP_UI_ORIGIN، مثلًا http://127.0.0.1:3207).
 * أيقونة عبده (mekanezm-admin.vercel.app) بتعدّي كل حاجة لهنا عن طريق ngrok، فأي تعديل في الشاشة يوصل فورًا
 * من غير ما يستنى حد Vercel اليومي (القاعدة: «بعد كل تعديل أفتح الأيقونة ألاقيه»).
 */
const DROP_REQ = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const DROP_RES = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie']);

export const uiOrigin = () => (process.env.SHOP_UI_ORIGIN || '').replace(/\/$/, '');

export async function proxyUi(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const origin = uiOrigin();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(request.headers)) if (!DROP_REQ.has(k) && v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : typeof request.body === 'string' ? request.body : request.body ? JSON.stringify(request.body) : undefined;
  let r: Response;
  try {
    r = await fetch(origin + request.url, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  } catch {
    return reply.code(503).header('content-type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;direction:rtl;padding:24px">⏳ شاشة السيستم بتتحدّث دلوقتي — استنى دقيقة وافتح تاني.</body>');
  }
  // helmet بيحط حماية للـ API بتمنع سكريبتات الصفحة: الصفحة نفسها ليها حمايتها من Next
  for (const h of ['content-security-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'cross-origin-embedder-policy', 'origin-agent-cluster']) reply.removeHeader(h);
  r.headers.forEach((v, k) => {
    if (DROP_RES.has(k)) return;
    // تحويل لصفحة تانية (مثلًا لصفحة الدخول): يفضل على نفس الدومين اللي عبده فاتح منه
    reply.header(k, k === 'location' ? v.replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, '') : v);
  });
  const cookies = r.headers.getSetCookie?.() ?? [];
  if (cookies.length) reply.header('set-cookie', cookies);
  reply.code(r.status);
  return reply.send(Buffer.from(await r.arrayBuffer()));
}
