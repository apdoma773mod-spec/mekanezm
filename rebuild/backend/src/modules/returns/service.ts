import type { Prisma, PrismaClient } from '@prisma/client';
import type { ListReturnsQuery, Paginated, ReturnDto, ReturnInput } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num, qty as roundQty } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';
import { changeBalance, liveContact } from '../contacts/service.js';

const INCLUDE = {
  product: { select: { id: true, code: true, name: true, unit: true } },
  contact: { select: { id: true, name: true } },
  invoice: { select: { id: true, no: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ReturnInclude;

type ReturnWithRels = Prisma.ReturnGetPayload<{ include: typeof INCLUDE }>;

function toDto(r: ReturnWithRels): ReturnDto {
  return {
    id: r.id,
    kind: r.kind,
    product: r.product,
    contact: r.contact,
    invoice: r.invoice,
    person: r.person,
    qty: num(r.qty),
    price: num(r.price),
    total: num(r.total),
    settlement: r.settlement,
    method: r.method,
    company: r.company,
    date: dateToDay(r.date),
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export class ReturnsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListReturnsQuery): Promise<Paginated<ReturnDto>> {
    const q = query.q?.trim();
    const where: Prisma.ReturnWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(query.from || query.to ? { date: dayRange(query.from, query.to) } : {}),
      ...(q
        ? {
            OR: [
              { person: { contains: q, mode: 'insensitive' } },
              { product: { name: { contains: q, mode: 'insensitive' } } },
              { note: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.return.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * A sale return puts the goods back on the shelf; a purchase return sends them back to the
   * supplier. Settled in cash from/to the drawer, or against the contact's balance.
   */
  async create(input: ReturnInput, actor: Actor): Promise<ReturnDto> {
    const id = await withTx(this.prisma, async (tx) => {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product || product.deletedAt) throw notFound('الصنف ده مش موجود');
      const contact = input.contactId ? await liveContact(tx, input.contactId) : null;
      if (contact && contact.type !== (input.kind === 'SALE' ? 'CUSTOMER' : 'SUPPLIER')) {
        throw badRequest(input.kind === 'SALE' ? 'مرتجع البيع بيكون من عميل' : 'مرتجع الشراء بيكون لمورد');
      }
      if (input.settlement === 'BALANCE' && !contact) {
        throw badRequest('اختار العميل أو المورد عشان المرتجع يتخصم من حسابه', [{ path: 'contactId', message: 'مطلوب' }]);
      }
      if (input.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId }, select: { kind: true, status: true } });
        if (!inv || inv.status !== 'ACTIVE') throw badRequest('الفاتورة دي مش موجودة أو ملغية');
        if (inv.kind !== input.kind) throw badRequest('نوع الفاتورة مش زي نوع المرتجع');
      }
      const qty = roundQty(input.qty);
      const price = money(input.price);
      const total = money(qty.times(price));
      const ret = await tx.return.create({
        data: {
          kind: input.kind,
          productId: product.id,
          contactId: contact?.id ?? null,
          invoiceId: input.invoiceId ?? null,
          person: contact?.name ?? input.person,
          qty,
          price,
          total,
          unitCost: product.cost,
          settlement: input.settlement,
          method: input.method,
          company: input.company,
          date: dayToDate(todayYmd()),
          note: input.note,
          createdById: actor.id,
        },
      });
      await moveStock(tx, {
        productId: product.id,
        change: input.kind === 'SALE' ? qty : qty.negated(),
        reason: input.kind === 'SALE' ? 'SALE_RETURN' : 'PURCHASE_RETURN',
        refType: 'Return',
        refId: ret.id,
        userId: actor.id,
      });
      if (input.settlement === 'BALANCE' && contact) await changeBalance(tx, contact.id, total.negated());
      await writeAudit(tx, {
        userId: actor.id,
        action: 'RETURN_CREATE',
        entity: 'Return',
        entityId: ret.id,
        after: { kind: input.kind, product: product.name, qty: num(qty), total: num(total), settlement: input.settlement },
        ip: actor.ip,
      });
      return ret.id;
    });
    return toDto(await this.prisma.return.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }
}
