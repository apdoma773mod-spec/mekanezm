import type { Prisma, PrismaClient } from '@prisma/client';
import type { Paginated, StockCountDto, StockCountInput, StockCountLine } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ZERO, money, num, qty as roundQty } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';

type CountWithUser = Prisma.StockCountGetPayload<{ include: { createdBy: { select: { name: true } } } }>;

function toDto(c: CountWithUser): StockCountDto {
  return {
    id: c.id,
    no: c.no,
    note: c.note,
    items: c.items as unknown as StockCountLine[],
    itemCount: c.itemCount,
    shortValue: num(c.shortValue),
    excessValue: num(c.excessValue),
    createdBy: c.createdBy?.name ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export class CountsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * «✔ حفظ الجرد»: every counted product is set to what was on the shelf, and the shortage and
   * excess are valued at cost (the old mk_stock_count).
   */
  async create(input: StockCountInput, actor: Actor): Promise<StockCountDto> {
    const id = await withTx(this.prisma, async (tx) => {
      const n = (await tx.stockCount.count()) + 1;
      const no = `JR-${String(n).padStart(4, '0')}`;
      const lines: StockCountLine[] = [];
      let short = ZERO;
      let excess = ZERO;
      const seen = new Set<string>();
      for (const it of input.items) {
        if (seen.has(it.productId)) continue;
        seen.add(it.productId);
        const p = await tx.product.findUnique({ where: { id: it.productId } });
        if (!p || p.deletedAt) continue;
        const counted = roundQty(it.counted);
        const diff = counted.minus(p.qty);
        if (diff.isNegative()) short = short.plus(diff.negated().times(p.cost));
        else excess = excess.plus(diff.times(p.cost));
        lines.push({ productId: p.id, code: p.code, name: p.name, before: num(p.qty), counted: num(counted), diff: num(diff), cost: num(p.cost) });
        if (!diff.isZero()) {
          await moveStock(tx, { productId: p.id, change: diff, reason: 'COUNT', refType: 'StockCount', refId: no, note: input.note || no, userId: actor.id });
        }
      }
      if (!lines.length) throw badRequest('اعدّ صنف واحد على الأقل');
      const c = await tx.stockCount.create({
        data: {
          no,
          note: input.note,
          items: lines as unknown as Prisma.InputJsonValue,
          itemCount: lines.length,
          shortValue: money(short),
          excessValue: money(excess),
          createdById: actor.id,
        },
      });
      await tx.stockMove.updateMany({ where: { refType: 'StockCount', refId: no }, data: { refId: c.id } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'STOCK_COUNT',
        entity: 'StockCount',
        entityId: c.id,
        after: { no, items: lines.length, short: num(money(short)), excess: num(money(excess)) },
        ip: actor.ip,
      });
      return c.id;
    });
    return toDto(await this.prisma.stockCount.findUniqueOrThrow({ where: { id }, include: { createdBy: { select: { name: true } } } }));
  }

  async list(page: number, pageSize: number): Promise<Paginated<StockCountDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockCount.findMany({
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockCount.count(),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }
}
