import type { Prisma } from '@prisma/client';

export const COUNTER = {
  product: 'product',
  sale: 'invoice.SALE',
  purchase: 'invoice.PURCHASE',
} as const;

const PREFIX: Record<string, string> = {
  [COUNTER.product]: 'P',
  [COUNTER.sale]: 'MK-',
  [COUNTER.purchase]: 'SH-',
};

/** Next number in a sequence. Must run inside the caller's transaction so a rollback doesn't burn a number. */
export async function nextNumber(tx: Prisma.TransactionClient, key: string): Promise<string> {
  const row = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX[key] ?? ''}${String(row.value).padStart(4, '0')}`;
}
