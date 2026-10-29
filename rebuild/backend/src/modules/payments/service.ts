import type { Prisma, PrismaClient } from '@prisma/client';
import { alertPaymentCancelled } from '../../lib/alert-hooks.js';
import type { ListPaymentsQuery, Paginated, PaymentDto, PaymentInput } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';
import { changeBalance, liveContact } from '../contacts/service.js';

const INCLUDE = {
  contact: { select: { id: true, name: true, type: true } },
  invoice: { select: { id: true, no: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

type PaymentWithRels = Prisma.PaymentGetPayload<{ include: typeof INCLUDE }>;

function toDto(p: PaymentWithRels): PaymentDto {
  return {
    id: p.id,
    contact: p.contact,
    invoice: p.invoice,
    direction: p.direction,
    amount: num(p.amount),
    method: p.method,
    company: p.company,
    date: dateToDay(p.date),
    note: p.note,
    createdBy: p.createdBy,
    cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export class PaymentsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListPaymentsQuery): Promise<Paginated<PaymentDto>> {
    const q = query.q?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(query.includeCancelled ? {} : { cancelledAt: null }),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(query.from || query.to ? { date: dayRange(query.from, query.to) } : {}),
      ...(q
        ? { OR: [{ note: { contains: q, mode: 'insensitive' } }, { contact: { name: { contains: q, mode: 'insensitive' } } }] }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  /** Collecting from a customer or paying a supplier: lowers what is owed either way. */
  async create(input: PaymentInput, actor: Actor): Promise<PaymentDto> {
    const id = await withTx(this.prisma, async (tx) => {
      const contact = await liveContact(tx, input.contactId);
      const amount = money(input.amount);
      const payment = await tx.payment.create({
        data: {
          contactId: contact.id,
          direction: contact.type === 'CUSTOMER' ? 'IN' : 'OUT',
          amount,
          method: input.method,
          company: input.company,
          date: dayToDate(input.date ?? todayYmd()),
          note: input.note,
          createdById: actor.id,
        },
      });
      await changeBalance(tx, contact.id, amount.negated());
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PAYMENT_CREATE',
        entity: 'Payment',
        entityId: payment.id,
        after: { contact: contact.name, amount: num(amount), method: input.method },
        ip: actor.ip,
      });
      return payment.id;
    });
    return toDto(await this.prisma.payment.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }

  /** Cancelling restores the balance as if the payment never happened; the row stays for the audit trail. */
  async cancel(id: string, actor: Actor): Promise<PaymentDto> {
    const snap = await this.prisma.payment.findUnique({ where: { id }, include: { contact: { select: { name: true } } } });
    await withTx(this.prisma, async (tx) => {
      const p = await tx.payment.findUnique({ where: { id } });
      if (!p) throw notFound('الدفعة دي مش موجودة');
      if (p.cancelledAt) throw badRequest('الدفعة دي ملغية من قبل كده');
      await tx.payment.update({ where: { id }, data: { cancelledAt: new Date(), cancelledById: actor.id } });
      await changeBalance(tx, p.contactId, p.amount);
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PAYMENT_CANCEL',
        entity: 'Payment',
        entityId: id,
        before: { amount: num(p.amount), method: p.method, date: dateToDay(p.date) },
        ip: actor.ip,
      });
    });
    if (snap) await alertPaymentCancelled(this.prisma, { direction: snap.direction, amount: snap.amount, note: snap.note, contactName: snap.contact.name }, actor);
    return toDto(await this.prisma.payment.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }
}
