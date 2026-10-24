import { Prisma, type PrismaClient } from '@prisma/client';

const MAX_ATTEMPTS = 3;

/**
 * Runs `fn` in a SERIALIZABLE transaction, retrying when Postgres aborts it
 * because of a concurrent conflicting write (Prisma code P2034).
 */
export async function withTx<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const retryable =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}
