import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';

const UPLOADS = path.resolve(process.cwd(), 'uploads');

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

  // ---- 📷 طلبات بالصور (public) ----
  app.post('/public/media', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const { data, ext } = parse(z.object({ data: z.string().min(10), ext: z.enum(['jpg', 'jpeg', 'png', 'webp']).default('jpg') }), request.body);
    const buf = Buffer.from(data.includes(',') ? data.slice(data.indexOf(',') + 1) : data, 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) throw badRequest('الصورة كبيرة أو فاضية');
    await mkdir(UPLOADS, { recursive: true });
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(path.join(UPLOADS, name), buf);
    return { url: `/api/v1/work/files/${name}` };
  });

  const fileUrl = z.string().max(300).regex(/^(\/api\/v1\/work\/files\/[a-z0-9-]+\.(jpg|jpeg|png|webp)|https:\/\/[^\s]+)$/);
  app.post('/public/requests', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30).default(''), imgs: z.array(fileUrl).max(8).default([]), note: z.string().trim().max(1500).default('') }), request.body);
    if (!b.imgs.length && !b.note) throw badRequest('ابعت صورة أو اكتب وصف');
    const r = await db.webRequest.create({ data: { name: b.name, phone: b.phone, imgs: b.imgs as Prisma.InputJsonValue, note: b.note } });
    return { id: r.id };
  });

  app.post('/public/custom', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30).default(''), kind: z.enum(['steel', 'bamboo', 'delf']), summary: z.string().trim().max(2000).default(''), note: z.string().trim().max(1500).default(''), img: fileUrl.or(z.literal('')).default(''), spec: z.record(z.unknown()).default({}) }), request.body);
    const r = await db.webCustom.create({ data: { ...b, spec: b.spec as Prisma.InputJsonValue } });
    return { id: r.id };
  });

  // ---- admin: photo requests and custom orders ----
  app.get('/counts', { preHandler: app.requireAdmin }, async () => {
    const [orders, requests, custom] = await Promise.all([db.webOrder.count({ where: { status: 'new' } }), db.webRequest.count({ where: { status: 'new' } }), db.webCustom.count({ where: { status: 'new' } })]);
    return { orders, requests, custom };
  });

  app.get('/requests', { preHandler: app.requireAdmin }, async () => ({ items: await db.webRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) }));
  app.patch('/requests/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const b = parse(z.object({ status: z.enum(['new', 'replied', 'closed']).optional(), reply: z.string().trim().max(1000).optional() }), request.body);
    const cur = await db.webRequest.findUnique({ where: { id } });
    if (!cur) throw notFound('الطلب مش موجود');
    const actor = actorOf(request);
    const who = (await db.user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name ?? '';
    const row = await db.webRequest.update({ where: { id }, data: { ...(b.status ? { status: b.status } : {}), ...(b.reply !== undefined ? { reply: b.reply, repliedAt: new Date(), repliedBy: who, status: b.status ?? 'replied' } : {}) } });
    return { request: row };
  });

  app.get('/custom', { preHandler: app.requireAdmin }, async () => ({ items: await db.webCustom.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) }));
  app.patch('/custom/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { status } = parse(z.object({ status: z.enum(['new', 'opened', 'closed', 'cancelled']) }), request.body);
    if (!(await db.webCustom.findUnique({ where: { id }, select: { id: true } }))) throw notFound('الطلب مش موجود');
    return { custom: await db.webCustom.update({ where: { id }, data: { status } }) };
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
