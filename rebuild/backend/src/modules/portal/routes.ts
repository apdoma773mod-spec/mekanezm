import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { dateToDay } from '../../lib/dates.js';
import { num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';

/**
 * 🔗 رابط العميل: a private link per customer (token in the URL, nothing else to log in with). The page shows his balance, invoices
 * (with what was missing at delivery and handed over later), payments and returns, and lets him write a request with photos or video.
 */
const UPLOADS = path.resolve(process.cwd(), 'uploads');
const token = z.object({ token: z.string().regex(/^[a-z0-9]{20,40}$/) });
const cid = z.object({ contactId: z.string().min(1).max(64) });
const msgBody = z.object({
  body: z.string().trim().max(3000).default(''),
  media: z.array(z.object({ u: z.string().max(300).regex(/^\/api\/v1\/work\/files\/[a-z0-9-]+\.(jpg|jpeg|png|webp|mp4)$/), t: z.enum(['i', 'v']) })).max(12).default([]),
});

interface InvNote {
  recv?: string;
  miss?: string;
  gotDate?: string;
  got?: string;
}

export default async function portalRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const tight = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

  const byToken = async (t: string) => {
    const p = await db.portal.findUnique({ where: { token: t } });
    if (!p) throw notFound('الرابط ده مش شغال');
    const c = await db.contact.findFirst({ where: { id: p.contactId, deletedAt: null, type: 'CUSTOMER' } });
    if (!c) throw notFound('الرابط ده مش شغال');
    return c;
  };

  // ---- the customer's page ----
  app.get('/public/:token', tight(60), async (request) => {
    const { token: t } = parse(token, request.params);
    const c = await byToken(t);
    const [invs, pays, rets, notesRow, settingsRow] = await Promise.all([
      db.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', OR: [{ contactId: c.id }, { person: c.name }] }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 150, include: { items: { orderBy: { position: 'asc' } } } }),
      db.payment.findMany({ where: { contactId: c.id, cancelledAt: null, direction: 'IN' }, orderBy: { date: 'desc' }, take: 100 }),
      db.return.findMany({ where: { kind: 'SALE', OR: [{ contactId: c.id }, { person: c.name }] }, orderBy: { date: 'desc' }, take: 60, include: { product: { select: { name: true } } } }),
      db.setting.findUnique({ where: { key: 'inv_notes' } }),
      db.setting.findUnique({ where: { key: 'store' } }),
    ]);
    const notes = ((notesRow?.value ?? {}) as Record<string, InvNote>) || {};
    const store = (settingsRow?.value ?? {}) as { name?: string; phones?: string[] };
    return {
      shop: { name: store.name || 'ميكانيزم', phone: store.phones?.[0] ?? '' },
      customer: c.name,
      bal: num(c.balance),
      inv: invs.map((i) => {
        const n = notes[i.no] ?? {};
        const items = i.items.map((x) => ({ n: x.name, q: num(x.qty), u: x.unit, t: num(x.total) }));
        if (num(i.shipping)) items.push({ n: 'مصاريف النقل', q: 1, u: '', t: num(i.shipping) });
        return { no: i.no, date: dateToDay(i.date), items, tot: num(i.total), paid: num(i.paid), rem: num(i.remaining), recv: n.recv ?? '', miss: n.miss ?? '', got: n.got ?? '', gotDate: n.gotDate ?? '' };
      }),
      pays: pays.map((p) => ({ date: dateToDay(p.date), amount: num(p.amount), note: p.note })),
      rets: rets.map((r) => ({ date: dateToDay(r.date), n: r.product.name, q: num(r.qty), t: num(r.total) })),
    };
  });

  app.post('/public/:token/media', { ...tight(20), bodyLimit: 30 * 1024 * 1024 }, async (request) => {
    const { token: t } = parse(token, request.params);
    await byToken(t);
    const { data, ext } = parse(z.object({ data: z.string().min(10), ext: z.enum(['jpg', 'jpeg', 'png', 'webp', 'mp4']).default('jpg') }), request.body);
    const buf = Buffer.from(data.includes(',') ? data.slice(data.indexOf(',') + 1) : data, 'base64');
    const max = ext === 'mp4' ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!buf.length || buf.length > max) throw badRequest('الملف كبير أو فاضي');
    await mkdir(UPLOADS, { recursive: true });
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(path.join(UPLOADS, name), buf);
    return { u: `/api/v1/work/files/${name}`, t: ext === 'mp4' ? 'v' : 'i' };
  });

  app.post('/public/:token/msg', tight(6), async (request) => {
    const { token: t } = parse(token, request.params);
    const c = await byToken(t);
    const b = parse(msgBody, request.body);
    if (!b.body && !b.media.length) throw badRequest('اكتب طلبك الأول');
    await db.portalMsg.create({ data: { contactId: c.id, body: b.body, media: b.media as Prisma.InputJsonValue } });
    return { ok: true };
  });

  // ---- the shop's side ----
  app.post('/link/:contactId', { preHandler: app.requireAdmin }, async (request) => {
    const { contactId } = parse(cid, request.params);
    const c = await db.contact.findFirst({ where: { id: contactId, deletedAt: null, type: 'CUSTOMER' } });
    if (!c) throw notFound('العميل مش موجود');
    const cur = await db.portal.findUnique({ where: { contactId } });
    if (cur) return { token: cur.token };
    const created = await db.portal.create({ data: { contactId, token: randomBytes(18).toString('hex').slice(0, 28) } });
    return { token: created.token };
  });

  app.get('/link/:contactId', { preHandler: app.requireAdmin }, async (request) => {
    const { contactId } = parse(cid, request.params);
    const p = await db.portal.findUnique({ where: { contactId } });
    return { token: p?.token ?? null };
  });

  app.delete('/link/:contactId', { preHandler: app.requireAdmin }, async (request) => {
    const { contactId } = parse(cid, request.params);
    await db.portal.deleteMany({ where: { contactId } });
    return { ok: true };
  });

  app.get('/msgs', { preHandler: app.requireAdmin }, async (request) => {
    const q = parse(z.object({ contactId: z.string().max(64).optional(), unseen: z.enum(['1']).optional() }), request.query);
    const rows = await db.portalMsg.findMany({ where: { ...(q.contactId ? { contactId: q.contactId } : {}), ...(q.unseen ? { seen: false } : {}) }, orderBy: { createdAt: 'desc' }, take: q.unseen ? 50 : 30 });
    const names = new Map((await db.contact.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.contactId))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    return { items: rows.map((r) => ({ id: r.id, contactId: r.contactId, name: names.get(r.contactId) ?? '', body: r.body, media: r.media as { u: string; t: 'i' | 'v' }[], seen: r.seen, createdAt: r.createdAt.toISOString() })) };
  });

  app.get('/msgs/count', { preHandler: app.requireAdmin }, async () => ({ count: await db.portalMsg.count({ where: { seen: false } }) }));

  app.post('/msgs/:id/seen', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    await db.portalMsg.updateMany({ where: { id }, data: { seen: true } });
    return { ok: true };
  });

  app.post('/msgs/seen-contact/:contactId', { preHandler: app.requireAdmin }, async (request) => {
    const { contactId } = parse(cid, request.params);
    await db.portalMsg.updateMany({ where: { contactId, seen: false }, data: { seen: true } });
    return { ok: true };
  });
}
