import type { PrismaClient } from '@prisma/client';
import { dayRange } from '../../lib/dates.js';
import { num } from '../../lib/money.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ReturnsAnalysis {
  sale: { count: number; total: number; salesTotal: number; ratePct: number };
  purchase: { count: number; total: number };
  products: { productId: string; name: string; qty: number; total: number; count: number; soldQty: number; ratePct: number; kind: 'SALE' | 'PURCHASE' }[];
  people: { name: string; kind: 'SALE' | 'PURCHASE'; count: number; total: number }[];
  reasons: { note: string; count: number }[];
}

/** «↩️ تحليل المرتجعات»: which products come back most and why, and which supplier sends the goods that go back. */
export async function returnsAnalysis(db: PrismaClient, q: { from?: string; to?: string }): Promise<ReturnsAnalysis> {
  const range = q.from || q.to ? { date: dayRange(q.from, q.to) } : {};
  const [rets, sold] = await Promise.all([
    db.return.findMany({ where: range, include: { product: { select: { name: true } } } }),
    db.invoiceItem.groupBy({ by: ['productId'], where: { invoice: { kind: 'SALE', status: 'ACTIVE', ...range } }, _sum: { qty: true, total: true } }),
  ]);
  const soldBy = new Map(sold.map((s) => [s.productId, num(s._sum.qty)]));
  const salesTotal = sold.reduce((a, s) => a + num(s._sum.total), 0);
  const sale = rets.filter((r) => r.kind === 'SALE');
  const pur = rets.filter((r) => r.kind === 'PURCHASE');
  const sum = (L: typeof rets) => r2(L.reduce((a, r) => a + num(r.total), 0));

  const byP = new Map<string, ReturnsAnalysis['products'][number]>();
  for (const r of rets) {
    const k = `${r.kind}:${r.productId}`;
    const x = byP.get(k) ?? { productId: r.productId, name: r.product.name, qty: 0, total: 0, count: 0, soldQty: soldBy.get(r.productId) ?? 0, ratePct: 0, kind: r.kind as 'SALE' | 'PURCHASE' };
    x.qty = Math.round((x.qty + num(r.qty)) * 1000) / 1000;
    x.total = r2(x.total + num(r.total));
    x.count++;
    byP.set(k, x);
  }
  const products = [...byP.values()]
    .map((x) => ({ ...x, ratePct: x.kind === 'SALE' && x.soldQty > 0 ? r2((x.qty / x.soldQty) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  const byPerson = new Map<string, ReturnsAnalysis['people'][number]>();
  for (const r of rets) {
    const name = r.person.trim() || 'بدون اسم';
    const k = `${r.kind}:${name}`;
    const x = byPerson.get(k) ?? { name, kind: r.kind as 'SALE' | 'PURCHASE', count: 0, total: 0 };
    x.count++;
    x.total = r2(x.total + num(r.total));
    byPerson.set(k, x);
  }
  const reasons = new Map<string, number>();
  for (const r of rets) {
    const n = r.note.trim();
    if (n) reasons.set(n, (reasons.get(n) ?? 0) + 1);
  }
  return {
    sale: { count: sale.length, total: sum(sale), salesTotal: r2(salesTotal), ratePct: salesTotal ? r2((sum(sale) / salesTotal) * 100) : 0 },
    purchase: { count: pur.length, total: sum(pur) },
    products,
    people: [...byPerson.values()].sort((a, b) => b.total - a.total).slice(0, 20),
    reasons: [...reasons.entries()].map(([note, count]) => ({ note, count })).sort((a, b) => b.count - a.count).slice(0, 15),
  };
}
