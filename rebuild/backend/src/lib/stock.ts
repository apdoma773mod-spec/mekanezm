import type { Prisma, StockReason } from '@prisma/client';
import { D, qty as roundQty } from './money.js';

export interface StockChange {
  productId: string;
  change: Prisma.Decimal.Value;
  reason: StockReason;
  refType?: string;
  refId?: string;
  note?: string;
  userId: string | null;
}

/**
 * The only way stock changes: an atomic increment plus a StockMove row recording the
 * quantity after the change. Negative stock is allowed (the shop sometimes sells before
 * the purchase invoice is entered); the UI warns about it.
 */
export async function moveStock(tx: Prisma.TransactionClient, c: StockChange): Promise<Prisma.Decimal> {
  const change = roundQty(c.change);
  if (change.isZero()) {
    const p = await tx.product.findUniqueOrThrow({ where: { id: c.productId }, select: { qty: true } });
    return p.qty;
  }
  const updated = await tx.product.update({
    where: { id: c.productId },
    data: { qty: { increment: change } },
    select: { qty: true },
  });
  await tx.stockMove.create({
    data: {
      productId: c.productId,
      qtyChange: change,
      qtyAfter: updated.qty,
      reason: c.reason,
      refType: c.refType ?? null,
      refId: c.refId ?? null,
      note: c.note ?? '',
      userId: c.userId,
    },
  });
  return D(updated.qty);
}
