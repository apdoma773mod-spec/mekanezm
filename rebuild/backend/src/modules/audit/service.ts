import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditEntry, ListAuditQuery, Paginated } from '@mk/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListAuditQuery): Promise<Paginated<AuditEntry>> {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) createdAt.lt = new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + DAY_MS);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to ? { createdAt } : {}),
      ...(query.q
        ? {
            OR: [
              { entity: { contains: query.q, mode: 'insensitive' } },
              { entityId: { contains: query.q } },
              { user: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
        ip: r.ip,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
