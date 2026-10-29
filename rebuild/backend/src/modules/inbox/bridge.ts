import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { forbidden } from '../../lib/errors.js';

/**
 * 🔌 الجسر اللي على جهاز المحل (واتساب + الطابعة). بيكلّم السيستم بسر واحد في الهيدر x-bridge-secret،
 * وده نفس شكل الدوال القديمة في Supabase (wa_out_claim, wa_out_done, wa_submit, wa_photo_submit, …).
 * أوامر الطباعة بتتسجل في OutboundMessage بـ toPhone = «PRINT:receipt|label|a4» زي القديم.
 */
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_PHOTO_CHARS = 2_500_000;
const PHOTO = /^data:image\/(jpeg|png|webp);base64,/;

function checkBridge(app: FastifyInstance, request: FastifyRequest) {
  const secret = app.config.BRIDGE_SECRET;
  if (!secret) throw forbidden('الجسر مش متفعّل (BRIDGE_SECRET)');
  if (String(request.headers['x-bridge-secret'] ?? '') !== secret) throw forbidden('السر غلط');
}

const last10 = (p: string) => p.replace(/\D/g, '').slice(-10);

export async function bridgeRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', async (request) => {
    checkBridge(app, request);
  });

  // ── صندوق الصادر: رسايل واتساب وأوامر طباعة
  app.post('/out/claim', async () => {
    const stale = new Date(Date.now() - CLAIM_TIMEOUT_MS);
    const rows = await db.outboundMessage.findMany({
      where: { status: 'queued', OR: [{ claimedAt: null }, { claimedAt: { lt: stale } }] },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });
    if (!rows.length) return [];
    await db.outboundMessage.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { claimedAt: new Date() } });
    return rows.map((r) => ({ id: r.id, to_phone: r.toPhone, body: r.body, by_name: r.byName }));
  });

  app.post('/out/done', async (request) => {
    const b = z.object({ id: z.string().min(1), ok: z.boolean(), err: z.string().max(300).default('') }).parse(request.body);
    await db.outboundMessage.update({
      where: { id: b.id },
      data: { status: b.ok ? 'sent' : 'failed', err: b.err, doneAt: new Date() },
    });
    return { ok: true };
  });

  // ── الرسايل اللي فيها «طلب» (الفلتر بيحصل في الجسر نفسه)
  app.post('/wa/submit', async (request) => {
    const b = z
      .object({
        msgId: z.string().max(200).optional(),
        phone: z.string().max(30).default(''),
        name: z.string().max(120).default(''),
        body: z.string().min(1).max(4000),
      })
      .parse(request.body);
    try {
      const row = await db.waOrder.create({
        data: { msgId: b.msgId || null, phone: b.phone, customerName: b.name, body: b.body },
      });
      return { id: row.id };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { id: 'duplicate' };
      throw e;
    }
  });

  // ── صور الواتساب (صور صغيرة من العملاء)
  app.post('/photo/submit', { bodyLimit: 4 * 1024 * 1024 }, async (request) => {
    const b = z
      .object({
        msgId: z.string().max(200).optional(),
        phone: z.string().max(30).default(''),
        name: z.string().max(120).default(''),
        caption: z.string().max(1000).default(''),
        img: z.string(),
      })
      .parse(request.body);
    if (!PHOTO.test(b.img)) throw forbidden('مش صورة (jpeg/png/webp)');
    if (b.img.length > MAX_PHOTO_CHARS) throw forbidden('الصورة كبيرة');
    try {
      const row = await db.waPhoto.create({
        data: { msgId: b.msgId || null, phone: b.phone, name: b.name, caption: b.caption, img: b.img },
      });
      await db.waPhoto.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 45 * 864e5) }, status: { not: 'new' } } });
      return { id: row.id };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { id: 'duplicate' };
      throw e;
    }
  });

  // ── أرقام العملاء والموردين المتسجلين (عشان صور وتحويلات أصحابهم تدخل حتى من غير كلمة)
  app.get('/known-phones', async () => {
    const contacts = await db.contact.findMany({ select: { phone: true } });
    const set = new Set<string>();
    for (const c of contacts) {
      const d = last10(c.phone ?? '');
      if (d.length === 10) set.add(d);
    }
    return [...set];
  });

  app.get('/rules', async () => {
    const s = await db.setting.findUnique({ where: { key: 'wa_rules' } });
    return s?.value ?? {};
  });

  app.post('/rules-stat', async (request) => {
    const stat = request.body ?? {};
    await db.setting.upsert({
      where: { key: 'wa_rules_stat' },
      create: { key: 'wa_rules_stat', value: stat as object },
      update: { value: stat as object },
    });
    return { ok: true };
  });
}
