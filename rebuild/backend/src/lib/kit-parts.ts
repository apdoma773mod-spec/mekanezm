import type { Prisma, Product } from '@prisma/client';
import { D, money, qty as roundQty } from './money.js';

/**
 * 🧩 «طقم بيتباع بالقطعة»: صنف (الطقم المقفول زي ما بييجي من المورد) ليه «محتويات» — كل واحدة صنف عادي في المخزون
 * (دلفة، قضيب، صباع…) بعددها جوه الطقم: ProductInfo.parts = [{productId, n}].
 *
 * البيع: القطعة بتتباع زي أي صنف. لو رصيدها مش مكفّي وفيه طقم مقفول، السيستم «بيفك» أطقم على قد المطلوب لوحده:
 * الطقم ينقص، وكل محتوياته تزيد بعددها، وتكلفة الطقم تتوزع عليها بنسبة قيمتها (العدد × سعر البيع) —
 * فالباقي من الطقم المفتوح بيفضل رصيد حقيقي بسعره وتكلفته، والربح في التقارير بيطلع صح.
 */
export interface KitPart {
  productId: string;
  n: number;
}

export const partsOf = (v: unknown): KitPart[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => ({ productId: String((x as KitPart)?.productId ?? ''), n: Number((x as KitPart)?.n) }))
    .filter((x) => x.productId && x.n > 0);

/** The kit a product is a piece of (a piece belongs to one kit only). */
export async function kitOfPart(tx: Prisma.TransactionClient, productId: string): Promise<{ kit: Product; parts: KitPart[]; n: number } | null> {
  const info = await tx.productInfo.findFirst({ where: { parts: { array_contains: [{ productId }] } }, select: { productId: true, parts: true } });
  if (!info) return null;
  const parts = partsOf(info.parts);
  const mine = parts.find((x) => x.productId === productId);
  const kit = await tx.product.findUnique({ where: { id: info.productId } });
  if (!mine || !kit || kit.deletedAt) return null;
  return { kit, parts, n: mine.n };
}

/** Each piece's share of one kit's cost, per piece: by value (n × sale price); by count when no prices are set. */
export function costShares(kitCost: Prisma.Decimal, parts: { n: number; price: Prisma.Decimal }[]): Prisma.Decimal[] {
  const byValue = parts.map((p) => p.price.mul(p.n));
  const total = byValue.reduce((a, x) => a.plus(x), D(0));
  const w = total.isZero() ? parts.map((p) => D(p.n)) : byValue;
  const sum = w.reduce((a, x) => a.plus(x), D(0));
  return parts.map((p, i) => (sum.isZero() ? D(0) : kitCost.mul(w[i]!).div(sum).div(p.n)));
}

/** Opens `count` closed kits into their pieces. Raw stock rows are written here (not through moveStock) so the two can't recurse. */
export async function openKits(tx: Prisma.TransactionClient, kit: Product, parts: KitPart[], count: number, userId: string | null, why = ''): Promise<void> {
  if (!(count > 0) || !parts.length) return;
  const rows = await tx.product.findMany({ where: { id: { in: parts.map((p) => p.productId) } } });
  const live = parts.map((p) => ({ ...p, row: rows.find((r) => r.id === p.productId && !r.deletedAt) })).filter((p): p is KitPart & { row: Product } => !!p.row);
  if (!live.length) return;
  const shares = costShares(kit.cost, live.map((p) => ({ n: p.n, price: p.row.price })));
  const note = `🧩 فك ${count} ${kit.name}${why ? ` — ${why}` : ''}`;
  const move = async (productId: string, change: Prisma.Decimal, text: string) => {
    const u = await tx.product.update({ where: { id: productId }, data: { qty: { increment: change } }, select: { qty: true } });
    await tx.stockMove.create({ data: { productId, qtyChange: change, qtyAfter: u.qty, reason: 'ADJUST', refType: 'KitOpen', refId: kit.id, note: text, userId } });
  };
  await move(kit.id, D(count).neg(), note);
  for (const [i, p] of live.entries()) {
    const add = roundQty(D(p.n).mul(count));
    const had = p.row.qty.greaterThan(0) ? p.row.qty : D(0);
    // weighted average with what was already on the shelf, like «فك لفة»
    const cost = money(had.plus(add).isZero() ? p.row.cost : had.mul(p.row.cost).plus(add.mul(shares[i]!)).div(had.plus(add)));
    await tx.product.update({ where: { id: p.productId }, data: { cost, costEst: false } });
    await move(p.productId, add, `من ${note}`);
  }
}

/**
 * Before a piece leaves the stock: when there isn't enough of it, open as many closed kits as needed (and available).
 * Returns how many kits were opened. Not a piece of a kit, or enough stock → nothing happens.
 */
export async function ensurePartStock(tx: Prisma.TransactionClient, productId: string, need: Prisma.Decimal.Value, userId: string | null, why = ''): Promise<number> {
  const want = D(need);
  if (!want.greaterThan(0)) return 0;
  const p = await tx.product.findUnique({ where: { id: productId }, select: { qty: true } });
  if (!p || p.qty.greaterThanOrEqualTo(want)) return 0;
  const k = await kitOfPart(tx, productId);
  if (!k) return 0;
  const short = want.minus(p.qty.greaterThan(0) ? p.qty : D(0));
  const needKits = Math.ceil(short.div(k.n).toNumber() - 1e-9);
  const have = Math.floor(k.kit.qty.toNumber() + 1e-9);
  const open = Math.min(needKits, have);
  if (open <= 0) return 0;
  await openKits(tx, k.kit, k.parts, open, userId, why);
  return open;
}
