import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { actorName } from '../../lib/names.js';

/**
 * 📥 صناديق الوارد للمدير: طلبات الواتساب وصور الواتساب (الفلوس الواصلة في sms.ts).
 * كل شاشة بتعرض تبويبات زي القديم: جديدة / اتعملها / متجاهلة.
 */
const WA_ORDER_TABS: Record<string, string[]> = { new: ['new'], done: ['done', 'promoted'], other: ['ignored'] };
const PHOTO_TABS: Record<string, string[]> = { new: ['new'], done: ['sent', 'paid', 'transfer'], other: ['missing', 'ignored'] };

const tabQuery = z.object({ tab: z.enum(['new', 'done', 'other']).default('new') });
const statusBody = (allowed: string[]) => z.object({ status: z.enum(allowed as [string, ...string[]]) });

export async function inboxAdminRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  /** 🔑 كلمات الواتساب المفتاحية: القواعد اللي الجسر بيفلتر بيها الرسايل (نفس شكل mk_settings.wa_rules القديم). */
  app.get("/wa-rules", async () => {
    const s = await db.setting.findUnique({ where: { key: "wa_rules" } });
    const stat = await db.setting.findUnique({ where: { key: "wa_rules_stat" } });
    return { rules: s?.value ?? null, stat: stat?.value ?? null };
  });

  app.put("/wa-rules", async (request) => {
    const body = z.object({ rules: z.record(z.unknown()) }).parse(request.body);
    if (!Array.isArray(body.rules.rules) || body.rules.rules.length === 0) throw badRequest("لازم قاعدة واحدة على الأقل");
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "wa_rules" },
        create: { key: "wa_rules", value: body.rules as object, updatedById: actor.id },
        update: { value: body.rules as object, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "wa_rules", ip: actor.ip });
    });
    return { ok: true };
  });

  /** Badge numbers for the sidebar and the dashboard tiles. */
  app.get('/counts', async () => {
    const [sms, waOrders, waPhotos] = await Promise.all([
      db.smsIn.count({ where: { status: 'pending' } }),
      db.waOrder.count({ where: { status: 'new' } }),
      db.waPhoto.count({ where: { status: 'new' } }),
    ]);
    return { sms, waOrders, waPhotos };
  });

  app.get('/wa-orders', async (request) => {
    const { tab } = tabQuery.parse(request.query);
    const rows = await db.waOrder.findMany({
      where: { status: { in: WA_ORDER_TABS[tab] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        customerName: r.customerName,
        body: r.body,
        status: r.status,
        invoiceNo: r.invoiceNo,
        createdAt: r.createdAt.toISOString(),
        handledAt: r.handledAt?.toISOString() ?? null,
      })),
    };
  });

  app.post('/wa-orders/:id/status', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = statusBody(['new', 'done', 'ignored', 'promoted']).parse(request.body);
    const row = await db.waOrder.findUnique({ where: { id } });
    if (!row) throw notFound('الطلب ده مش موجود');
    await db.waOrder.update({ where: { id }, data: { status, handledAt: new Date() } });
    return { ok: true };
  });

  app.get('/wa-photos', async (request) => {
    const { tab } = tabQuery.parse(request.query);
    const rows = await db.waPhoto.findMany({
      where: { status: { in: PHOTO_TABS[tab] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, phone: true, name: true, caption: true, img: true, status: true, handledBy: true, createdAt: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: r.name,
        caption: r.caption,
        img: r.img,
        status: r.status,
        handledBy: r.handledBy,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post('/wa-photos/:id/status', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = statusBody(['new', 'sent', 'missing', 'ignored', 'paid', 'transfer']).parse(request.body);
    const row = await db.waPhoto.findUnique({ where: { id } });
    if (!row) throw notFound('الصورة دي مش موجودة');
    await db.waPhoto.update({
      where: { id },
      data: { status, handledBy: await actorName(db, actorOf(request)), handledAt: new Date() },
    });
    return { ok: true };
  });
}
