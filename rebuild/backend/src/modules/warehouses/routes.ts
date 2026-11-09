import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';

/**
 * 🏬 إدارة المخازن: قايمة المخازن (غير المحل) وإيه اللي جوه كل واحد.
 * المنتج بيتسجل في المخزن من شاشته (ProductInfo.stores = [{w, s}]) — هنا بنقراها ونجمعها.
 * القراية لأي مستخدم داخل (العامل محتاج يعرف يجيب البضاعة منين)، والتعديل للمدير بس.
 */
const body = z.object({ name: z.string().trim().min(1, 'اكتب اسم المخزن').max(60), note: z.string().trim().max(200).default('') });
const idp = z.object({ id: z.string().min(1).max(64) });

export default async function warehouseRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.get('/', { preHandler: app.authenticate }, async () => {
    const [rows, counts] = await Promise.all([
      db.warehouse.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      db.$queryRaw<{ w: string; n: bigint }[]>(Prisma.sql`
        SELECT e->>'w' AS w, COUNT(DISTINCT i."productId") AS n
        FROM "ProductInfo" i
        JOIN "Product" p ON p."id" = i."productId" AND p."deletedAt" IS NULL,
        LATERAL jsonb_array_elements(i."stores") e
        GROUP BY 1`),
    ]);
    const by = new Map(counts.map((c) => [c.w, Number(c.n)]));
    return { warehouses: rows.map((w) => ({ id: w.id, name: w.name, note: w.note, products: by.get(w.id) ?? 0 })) };
  });

  /** كل المنتجات المسجلة في مخزن معين، بمكانها وكميتها المتوقعة (الرصيد − اللي على الرف). */
  app.get('/:id/products', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(idp, request.params);
    const w = await db.warehouse.findUnique({ where: { id } });
    if (!w) throw notFound('المخزن ده مش موجود');
    const rows = await db.$queryRaw<{ id: string; code: string; name: string; unit: string; qty: Prisma.Decimal; shelf: Prisma.Decimal | null; spot: string }[]>(Prisma.sql`
      SELECT p."id", p."code", p."name", p."unit", p."qty", i."shelfQty" AS shelf, e->>'s' AS spot
      FROM "ProductInfo" i
      JOIN "Product" p ON p."id" = i."productId" AND p."deletedAt" IS NULL,
      LATERAL jsonb_array_elements(i."stores") e
      WHERE e->>'w' = ${id}
      ORDER BY e->>'s', p."name"
      LIMIT 2000`);
    return {
      warehouse: { id: w.id, name: w.name, note: w.note },
      items: rows.map((r) => {
        const qty = num(r.qty);
        const shelf = r.shelf == null ? null : Math.min(num(r.shelf), Math.max(qty, 0));
        return { id: r.id, code: r.code, name: r.name, unit: r.unit, qty, spot: r.spot ?? '', inStore: shelf == null ? null : Math.max(qty - shelf, 0) };
      }),
    };
  });

  app.post('/', { preHandler: app.requireAdmin }, async (request) => {
    const b = parse(body, request.body);
    if (await db.warehouse.findUnique({ where: { name: b.name } })) throw badRequest('فيه مخزن بنفس الاسم ده');
    const actor = actorOf(request);
    const last = await db.warehouse.aggregate({ _max: { sort: true } });
    const w = await db.$transaction(async (tx) => {
      const created = await tx.warehouse.create({ data: { ...b, sort: (last._max.sort ?? 0) + 1 } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Warehouse', entityId: created.id, after: { name: b.name }, ip: actor.ip });
      return created;
    });
    return { id: w.id, name: w.name, note: w.note, products: 0 };
  });

  app.put('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idp, request.params);
    const b = parse(body, request.body);
    if (!(await db.warehouse.findUnique({ where: { id } }))) throw notFound('المخزن ده مش موجود');
    const dup = await db.warehouse.findUnique({ where: { name: b.name } });
    if (dup && dup.id !== id) throw badRequest('فيه مخزن بنفس الاسم ده');
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.warehouse.update({ where: { id }, data: b });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Warehouse', entityId: id, after: { name: b.name }, ip: actor.ip });
    });
    return { ok: true };
  });

  /** مش بيتمسح لو فيه منتجات متسجلة فيه — لازم تنقلها الأول (عشان مكان بضاعة ما يضيعش). */
  app.delete('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idp, request.params);
    const w = await db.warehouse.findUnique({ where: { id } });
    if (!w) throw notFound('المخزن ده مش موجود');
    const [{ n }] = await db.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS n FROM "ProductInfo" i, LATERAL jsonb_array_elements(i."stores") e WHERE e->>'w' = ${id}`);
    if (Number(n) > 0) throw badRequest(`مينفعش تمسح «${w.name}» — فيه ${Number(n)} منتج مسجل جواه. انقلهم لمخزن تاني الأول.`);
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.warehouse.delete({ where: { id } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Warehouse', entityId: id, before: { name: w.name }, ip: actor.ip });
    });
    return { ok: true };
  });
}
