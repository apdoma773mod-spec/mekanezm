import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';

/**
 * 💹 أسعار السوق ومقارنة الشراء (mk_settings.market_prices القديمة): لكل صنف أسعار الموردين اللي بيكتبها المدير،
 * وبتتقارن بآخر سعر شراء من كل مورد (من فواتير الشراء). للمدير بس.
 */
const KEY = 'market_prices';
const offer = z.object({ s: z.string().trim().min(1).max(120), p: z.number().gt(0).max(1e9), at: z.string().max(10) });
const body = z.object({ prices: z.record(z.string().max(80), z.array(offer).max(200)) });

interface BuyRow {
  pid: string;
  supplier: string;
  price: Prisma.Decimal;
  date: Date;
}

export default async function marketRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.get('/', { preHandler: app.requireAdmin }, async () => {
    const saved = await db.setting.findUnique({ where: { key: KEY } });
    // last purchase price per product and supplier, and the very last purchase of each product
    const perSupplier = await db.$queryRaw<BuyRow[]>`
      SELECT DISTINCT ON (ii."productId", i.person) ii."productId" AS pid, i.person AS supplier, ii.price, i.date
      FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
      WHERE i.kind = 'PURCHASE' AND i.status = 'ACTIVE' AND ii."productId" IS NOT NULL AND ii.price > 0
      ORDER BY ii."productId", i.person, i.date DESC, i."createdAt" DESC`;
    const last = await db.$queryRaw<BuyRow[]>`
      SELECT DISTINCT ON (ii."productId") ii."productId" AS pid, i.person AS supplier, ii.price, i.date
      FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
      WHERE i.kind = 'PURCHASE' AND i.status = 'ACTIVE' AND ii."productId" IS NOT NULL AND ii.price > 0
      ORDER BY ii."productId", i.date DESC, i."createdAt" DESC`;
    const row = (r: BuyRow) => ({ pid: r.pid, s: r.supplier.trim(), p: Number(r.price), at: r.date.toISOString().slice(0, 10) });
    return {
      prices: (saved?.value as Record<string, unknown> | null) ?? {},
      buys: perSupplier.map(row),
      last: last.map(row),
    };
  });

  app.put('/', { preHandler: app.requireAdmin }, async (request) => {
    const { prices } = body.parse(request.body);
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: prices as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: prices as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: KEY, ip: actor.ip });
    });
    return { ok: true };
  });
}
