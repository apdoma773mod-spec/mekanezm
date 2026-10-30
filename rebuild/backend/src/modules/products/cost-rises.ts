import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';
import { ProductsService } from './service.js';

/**
 * 📈 «التكلفة غلت»: when a purchase brings a product in at a price at least 3% above the cost we had, the product goes on a list
 * with a suggested new selling price (same margin as before); the owner applies or dismisses it.
 */
export const RISES_KEY = 'cost_rises';
export const RISE_MIN = 0.03;

export interface CostRise {
  productId: string;
  name: string;
  oldCost: number;
  newCost: number;
  sell: number;
  invoiceNo: string;
  at: string;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Same margin as before, rounded up to the next half pound. */
export const suggestPrice = (sell: number, oldCost: number, newCost: number) => (oldCost > 0 && sell > 0 ? Math.ceil(((sell * newCost) / oldCost) * 2) / 2 : sell);

type Db = PrismaClient | Prisma.TransactionClient;
export async function readRises(db: Db): Promise<CostRise[]> {
  const v = (await db.setting.findUnique({ where: { key: RISES_KEY } }))?.value;
  return Array.isArray(v) ? (v as unknown as CostRise[]) : [];
}
const writeRises = (db: Db, L: CostRise[]) => db.setting.upsert({ where: { key: RISES_KEY }, create: { key: RISES_KEY, value: L as never }, update: { value: L as never } });

/** Called inside the purchase transaction, before the product cost is replaced. */
export async function noteCostRise(tx: Prisma.TransactionClient, p: { id: string; name: string; cost: Prisma.Decimal; price: Prisma.Decimal; costEst: boolean }, newCost: Prisma.Decimal, invoiceNo: string) {
  const old = num(p.cost);
  const now = num(newCost);
  if (p.costEst || old <= 0 || now < old * (1 + RISE_MIN)) return;
  const L = (await readRises(tx)).filter((x) => x.productId !== p.id);
  L.unshift({ productId: p.id, name: p.name, oldCost: old, newCost: now, sell: num(p.price), invoiceNo, at: new Date().toISOString() });
  await writeRises(tx, L.slice(0, 200));
}

export default async function costRiseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAdmin);
  const db = app.prisma;

  app.get('/', async () => {
    const L = await readRises(db);
    const prods = await db.product.findMany({ where: { id: { in: L.map((x) => x.productId) }, deletedAt: null }, select: { id: true, price: true, cost: true } });
    const by = new Map(prods.map((p) => [p.id, p]));
    return {
      items: L.filter((x) => by.has(x.productId)).map((x) => {
        const p = by.get(x.productId)!;
        // the selling price may have been changed since: judge with today's numbers
        return { ...x, sell: num(p.price), pct: r2(((x.newCost - x.oldCost) / x.oldCost) * 100), suggested: suggestPrice(num(p.price), x.oldCost, x.newCost) };
      }),
    };
  });

  app.post('/:productId/apply', async (request) => {
    const { productId } = parse(z.object({ productId: z.string().max(64) }), request.params);
    const { price } = parse(z.object({ price: z.number().min(0).max(1e7) }), request.body);
    const L = await readRises(db);
    if (!L.some((x) => x.productId === productId)) throw notFound('الصنف ده مش في القايمة');
    if (!(price > 0)) throw badRequest('اكتب سعر البيع');
    await new ProductsService(db).update(productId, { price }, actorOf(request));
    await writeRises(db, L.filter((x) => x.productId !== productId));
    return { ok: true };
  });

  app.post('/:productId/dismiss', async (request) => {
    const { productId } = parse(z.object({ productId: z.string().max(64) }), request.params);
    await writeRises(db, (await readRises(db)).filter((x) => x.productId !== productId));
    return { ok: true };
  });
}
