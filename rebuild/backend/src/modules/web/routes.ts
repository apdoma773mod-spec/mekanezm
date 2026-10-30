import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';

/**
 * «🌐 الموقع»: orders sent from the public shop page (web_orders) and the site's own content
 * (sections, products shown, works, reviews, delivery…, the old site_content row) kept as one versioned document.
 */
const SITE_KEY = 'site_content';

const orderBody = z.object({
  customerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).default(''),
  items: z
    .array(z.object({ code: z.string().trim().min(1).max(40), qty: z.number().gt(0).max(100000), backorder: z.boolean().optional() }))
    .min(1)
    .max(100),
});
const patchBody = z.object({
  status: z.enum(['new', 'done', 'cancelled']).optional(),
  eta: z.string().trim().max(200).optional(),
  invoiceNo: z.string().trim().max(40).nullable().optional(),
});
const idParam = z.object({ id: z.string().min(1).max(64) });

interface SiteDoc {
  data: Record<string, unknown>;
  version: number;
}
const EMPTY: SiteDoc = { data: { theme: {}, sections: [], products: [] }, version: 0 };

export default async function webRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const readSite = async (): Promise<SiteDoc> => {
    const row = await db.setting.findUnique({ where: { key: SITE_KEY } });
    const v = row?.value as unknown as SiteDoc | null;
    return v && typeof v === 'object' && v.data ? v : EMPTY;
  };

  // ---- public (the shop page): what to show, and where orders go ----
  app.get('/public/site', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async () => ({ site: await readSite() }));

  app.post('/public/orders', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(orderBody, request.body);
    const o = await db.webOrder.create({ data: { customerName: b.customerName, phone: b.phone, items: b.items as Prisma.InputJsonValue } });
    return { id: o.id, no: o.id.slice(0, 8) };
  });

  // ---- admin ----
  app.get('/orders', { preHandler: app.requireAdmin }, async () => {
    const rows = await db.webOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return { items: rows };
  });

  app.get('/orders/count', { preHandler: app.requireAdmin }, async () => ({ count: await db.webOrder.count({ where: { status: 'new' } }) }));

  app.patch('/orders/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const b = parse(patchBody, request.body);
    const cur = await db.webOrder.findUnique({ where: { id } });
    if (!cur) throw notFound('الطلب مش موجود');
    const data: Prisma.WebOrderUpdateInput = {};
    if (b.status) {
      data.status = b.status;
      data.handledAt = new Date();
    }
    if (b.eta !== undefined) {
      data.eta = b.eta;
      data.repliedAt = new Date();
    }
    if (b.invoiceNo !== undefined) data.invoiceNo = b.invoiceNo;
    const actor = actorOf(request);
    const row = await db.$transaction(async (tx) => {
      const r = await tx.webOrder.update({ where: { id }, data });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'WebOrder', entityId: id, before: { status: cur.status }, after: { status: r.status, eta: r.eta, invoiceNo: r.invoiceNo }, ip: actor.ip });
      return r;
    });
    return { order: row };
  });

  app.get('/site', { preHandler: app.requireAdmin }, async () => ({ site: await readSite() }));

  /** Save with the version the editor loaded: if someone else saved first the editor reloads and tries again. */
  app.put('/site', { preHandler: app.requireAdmin, bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    const { data, version } = parse(z.object({ data: z.record(z.unknown()), version: z.number().int().min(0) }), request.body);
    const actor = actorOf(request);
    const next = await db.$transaction(async (tx) => {
      const row = await tx.setting.findUnique({ where: { key: SITE_KEY } });
      const cur = (row?.value as unknown as SiteDoc | undefined)?.version ?? 0;
      if (cur !== version) throw conflict('في تعديل تاني على الموقع في نفس اللحظة — جرّب تاني');
      const doc: SiteDoc = { data, version: cur + 1 };
      await tx.setting.upsert({
        where: { key: SITE_KEY },
        create: { key: SITE_KEY, value: doc as unknown as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: doc as unknown as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: SITE_KEY, ip: actor.ip });
      return doc;
    });
    return { site: next };
  });
}
