import type { Prisma, PrismaClient, Quote } from '@prisma/client';
import type { Paginated, QuoteDto, QuoteInput, QuoteItem } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { notFound } from '../../lib/errors.js';
import { money, num, sum } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { withTx } from '../../lib/tx.js';

function toDto(q: Quote): QuoteDto {
  return {
    id: q.id,
    no: q.no,
    date: dateToDay(q.date),
    person: q.person,
    phone: q.phone,
    address: q.address,
    note: q.note,
    shipping: num(q.shipping),
    total: num(q.total),
    items: q.items as unknown as QuoteItem[],
    status: q.status === 'converted' ? 'converted' : 'open',
    invoiceId: q.invoiceId,
    invoiceNo: q.invoiceNo,
    createdBy: q.createdBy,
    createdAt: q.createdAt.toISOString(),
  };
}

function build(input: QuoteInput) {
  const items: QuoteItem[] = input.items.map((x) => ({
    productId: x.productId ?? null,
    name: x.name,
    unit: x.unit,
    qty: x.qty,
    price: x.price,
    total: num(money(x.qty * x.price)),
  }));
  const shipping = money(input.shipping);
  const total = money(sum(items.map((x) => money(x.total))).plus(shipping));
  return {
    person: input.person,
    phone: input.phone,
    address: input.address,
    note: input.note,
    shipping,
    total,
    items: items as unknown as Prisma.InputJsonValue,
  };
}

/** «📝 عروض الأسعار»: never touch stock, sales or reports. */
export class QuotesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: string | undefined, page: number, pageSize: number): Promise<Paginated<QuoteDto>> {
    const words = (q ?? '').split(/\s+/).filter(Boolean);
    const where: Prisma.QuoteWhereInput = words.length
      ? {
          AND: words.map((w) => ({
            OR: [{ no: { contains: w, mode: 'insensitive' } }, { person: { contains: w, mode: 'insensitive' } }, { phone: { contains: w } }],
          })),
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.quote.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }

  async get(id: string): Promise<QuoteDto> {
    const q = await this.prisma.quote.findUnique({ where: { id } });
    if (!q) throw notFound('عرض السعر ده مش موجود');
    return toDto(q);
  }

  async create(input: QuoteInput, actor: Actor): Promise<QuoteDto> {
    const by = await actorName(this.prisma, actor);
    const q = await withTx(this.prisma, async (tx) => {
      const no = await nextNumber(tx, COUNTER.quote);
      const row = await tx.quote.create({ data: { ...build(input), no, date: dayToDate(todayYmd()), createdById: actor.id, createdBy: by } });
      await writeAudit(tx, { userId: actor.id, action: 'QUOTE_SAVE', entity: 'Quote', entityId: row.id, after: { no, total: num(row.total) }, ip: actor.ip });
      return row;
    });
    return toDto(q);
  }

  async update(id: string, input: QuoteInput, actor: Actor): Promise<QuoteDto> {
    await this.get(id);
    const q = await withTx(this.prisma, async (tx) => {
      const row = await tx.quote.update({ where: { id }, data: build(input) });
      await writeAudit(tx, { userId: actor.id, action: 'QUOTE_SAVE', entity: 'Quote', entityId: id, after: { no: row.no, total: num(row.total) }, ip: actor.ip });
      return row;
    });
    return toDto(q);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const q = await this.get(id);
    await withTx(this.prisma, async (tx) => {
      await tx.quote.delete({ where: { id } });
      await writeAudit(tx, { userId: actor.id, action: 'QUOTE_DELETE', entity: 'Quote', entityId: id, before: { no: q.no, total: q.total }, ip: actor.ip });
    });
  }

  /** Marks the quote as turned into the given sale invoice. */
  async converted(id: string, invoiceId: string, actor: Actor): Promise<QuoteDto> {
    await this.get(id);
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { no: true, kind: true } });
    if (!inv || inv.kind !== 'SALE') throw notFound('الفاتورة دي مش موجودة');
    const q = await withTx(this.prisma, async (tx) => {
      const row = await tx.quote.update({ where: { id }, data: { status: 'converted', invoiceId, invoiceNo: inv.no } });
      await writeAudit(tx, { userId: actor.id, action: 'QUOTE_SAVE', entity: 'Quote', entityId: id, after: { converted: inv.no }, ip: actor.ip });
      return row;
    });
    return toDto(q);
  }
}
