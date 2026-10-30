import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf, isAdmin } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { dayToDate, todayYmd, addDays } from '../../lib/dates.js';
import { money, num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';
import { withTx } from '../../lib/tx.js';

const text = (n: number) => z.string().trim().max(n).default('');
const pack = z.object({ u: z.string().trim().min(1).max(40), n: z.number().positive(), x: z.number().positive().optional(), small: z.boolean().optional() });
const infoBody = z.object({
  brand: text(80),
  finish: text(80),
  size: text(80),
  specs: text(2000),
  loc: text(120),
  grp: text(120),
  descr: text(2000),
  packs: z.array(pack).max(10).default([]),
  imgs: z.array(z.string().max(500)).max(30).default([]),
});

const EMPTY = { brand: '', finish: '', size: '', specs: '', loc: '', grp: '', descr: '', packs: [], imgs: [] };
type Row = { productId: string; brand: string; finish: string; size: string; specs: string; loc: string; grp: string; descr: string; packs: unknown; imgs: unknown };
const dto = (r: Row | null | undefined) => ({
  brand: r?.brand ?? '',
  finish: r?.finish ?? '',
  size: r?.size ?? '',
  specs: r?.specs ?? '',
  loc: r?.loc ?? '',
  grp: r?.grp ?? '',
  descr: r?.descr ?? '',
  packs: (r?.packs as unknown[]) ?? [],
  imgs: (r?.imgs as unknown[]) ?? [],
});

/** «شاشة المنتج»: تفاصيل المنتج (mk_product_info القديمة) + كارت المدير + المقاسات والألوان. */
export function productInfoRoutes(app: FastifyInstance) {
  const db = app.prisma;

  // everyone signed in: the invoice needs the packs (a box = N pieces) and the shelf place
  app.get('/info/all', { preHandler: app.authenticate }, async () => {
    const rows = await db.productInfo.findMany();
    return { infos: Object.fromEntries(rows.map((r) => [r.productId, dto(r)])) };
  });

  app.get('/info/groups', { preHandler: app.requireAdmin }, async () => {
    const rows = await db.productInfo.findMany({ where: { grp: { not: '' } }, distinct: ['grp'], select: { grp: true }, orderBy: { grp: 'asc' } });
    return { groups: rows.map((r) => r.grp) };
  });

  app.get('/:id/info', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    return { info: dto(await db.productInfo.findUnique({ where: { productId: id } })) };
  });

  app.put('/:id/info', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    const b = parse(infoBody, request.body);
    if (!(await db.product.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw notFound('الصنف ده مش موجود');
    const data = { ...b, packs: b.packs as Prisma.InputJsonValue, imgs: b.imgs as Prisma.InputJsonValue };
    const row = await db.productInfo.upsert({ where: { productId: id }, create: { productId: id, ...data }, update: data });
    const actor = actorOf(request);
    await db.$transaction((tx) => writeAudit(tx, { userId: actor.id, action: 'PRODUCT_UPDATE', entity: 'ProductInfo', entityId: id, after: { grp: row.grp, packs: b.packs.length, imgs: b.imgs.length }, ip: actor.ip }));
    return { info: dto(row) };
  });

  /** Other sizes/colors of the same group (the old «المقاسات والألوان»). */
  app.get('/:id/siblings', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    const me = await db.productInfo.findUnique({ where: { productId: id } });
    if (!me?.grp) return { group: '', items: [] };
    const rows = await db.productInfo.findMany({ where: { grp: me.grp, productId: { not: id }, product: { deletedAt: null } }, include: { product: true } });
    const admin = isAdmin(actorOf(request));
    return {
      group: me.grp,
      items: rows.map((r) => ({ id: r.productId, name: r.product.name, qty: num(r.product.qty), size: r.size, finish: r.finish, ...(admin ? { price: num(r.product.price) } : {}) })),
    };
  });

  /** The owner's card: sold in 90 days, best customers, last purchase. */
  app.get('/:id/card', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    const since = dayToDate(addDays(todayYmd(), -90));
    const items = await db.invoiceItem.findMany({ where: { productId: id, invoice: { kind: 'SALE', status: 'ACTIVE' } }, select: { qty: true, invoice: { select: { person: true, date: true } } } });
    const by = new Map<string, number>();
    let sold90 = 0;
    for (const it of items) {
      if (it.invoice.date >= since) sold90 += num(it.qty);
      if (it.invoice.person) by.set(it.invoice.person, (by.get(it.invoice.person) ?? 0) + num(it.qty));
    }
    const last = await db.invoiceItem.findFirst({ where: { productId: id, invoice: { kind: 'PURCHASE', status: 'ACTIVE' } }, orderBy: [{ invoice: { date: 'desc' } }, { invoice: { createdAt: 'desc' } }], select: { price: true, invoice: { select: { person: true, date: true } } } });
    return {
      sold90: Math.round(sold90 * 100) / 100,
      top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, qty]) => ({ name, qty: Math.round(qty * 100) / 100 })),
      lastBuy: last ? { price: num(last.price), person: last.invoice.person, date: last.invoice.date.toISOString().slice(0, 10) } : null,
    };
  });

  /** «➕ مقاس أو لون جديد»: new product, zero stock, same brand/specs/packs and group. */
  app.post('/:id/variant', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(64) }), request.params);
    const b = parse(z.object({ name: z.string().trim().min(1).max(200), size: text(80), finish: text(80), price: z.number().min(0), cost: z.number().min(0) }), request.body);
    const actor = actorOf(request);
    return withTx(db, async (tx) => {
      const p = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw notFound('الصنف ده مش موجود');
      const inf = await tx.productInfo.findUnique({ where: { productId: id } });
      const grp = inf?.grp || p.name;
      const dup = await tx.product.findFirst({ where: { name: b.name, deletedAt: null, info: { is: { size: b.size, finish: b.finish } } } });
      if (dup) throw badRequest('الصنف ده موجود بنفس المقاس واللون');
      let code = '';
      for (;;) {
        code = await nextNumber(tx, COUNTER.product);
        if (!(await tx.product.findUnique({ where: { code }, select: { id: true } }))) break;
      }
      const created = await tx.product.create({ data: { code, name: b.name, category: p.category, unit: p.unit, price: money(b.price), cost: money(b.cost), minQty: p.minQty, company: p.company } });
      await tx.productInfo.create({ data: { productId: created.id, brand: inf?.brand ?? '', finish: b.finish, size: b.size, specs: inf?.specs ?? '', grp, packs: (inf?.packs ?? []) as Prisma.InputJsonValue, imgs: [] } });
      if (!inf?.grp) await tx.productInfo.upsert({ where: { productId: id }, create: { productId: id, ...EMPTY, grp, packs: [], imgs: [] }, update: { grp } });
      await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_CREATE', entity: 'Product', entityId: created.id, after: { variantOf: id, code }, ip: actor.ip });
      return { id: created.id, code };
    });
  });
}
