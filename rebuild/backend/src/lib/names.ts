import type { Prisma, PrismaClient } from '@prisma/client';
import type { Actor } from './actor.js';

/** The actor's display name, stored on rows the old system showed «by whom» for. */
export async function actorName(db: PrismaClient | Prisma.TransactionClient, actor: Actor): Promise<string> {
  const u = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  return u?.name ?? '';
}
