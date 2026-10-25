import type { Contact, ContactType, Prisma, PrismaClient } from '@prisma/client';
import type {
  ContactDto,
  ContactInput,
  ContactStatement,
  ListContactsQuery,
  Paginated,
  StatementLine,
  UpdateContactInput,
  ZeroAccountInput,
} from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { D, ZERO, money, num } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';

export function toContactDto(c: Contact): ContactDto {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    phone: c.phone,
    address: c.address,
    note: c.note,
    balance: num(c.balance),
    openingBalance: num(c.openingBalance),
    createdAt: c.createdAt.toISOString(),
  };
}

const TYPE_LABEL: Record<ContactType, string> = { CUSTOMER: 'عميل', SUPPLIER: 'مورد' };

export async function liveContact(tx: Prisma.TransactionClient, id: string): Promise<Contact> {
  const c = await tx.contact.findUnique({ where: { id } });
  if (!c || c.deletedAt) throw notFound('العميل أو المورد ده مش موجود');
  return c;
}

async function findByName(tx: Prisma.TransactionClient, type: ContactType, name: string, exceptId?: string) {
  return tx.contact.findFirst({
    where: {
      type,
      deletedAt: null,
      name: { equals: name.trim(), mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

/** Used by invoices: reuse the contact with this exact name, or create it. Fills a missing phone/address. */
export async function findOrCreateContact(
  tx: Prisma.TransactionClient,
  type: ContactType,
  data: { name: string; phone: string; address: string },
  actor: Actor,
): Promise<Contact> {
  const existing = await findByName(tx, type, data.name);
  if (existing) {
    const fill: Prisma.ContactUpdateInput = {
      ...(!existing.phone && data.phone ? { phone: data.phone } : {}),
      ...(!existing.address && data.address ? { address: data.address } : {}),
    };
    return Object.keys(fill).length ? tx.contact.update({ where: { id: existing.id }, data: fill }) : existing;
  }
  const created = await tx.contact.create({
    data: { type, name: data.name.trim(), phone: data.phone, address: data.address },
  });
  await writeAudit(tx, {
    userId: actor.id,
    action: 'CONTACT_CREATE',
    entity: 'Contact',
    entityId: created.id,
    after: toContactDto(created),
    ip: actor.ip,
  });
  return created;
}

/** Every balance change goes through here so rounding is identical everywhere. */
export async function changeBalance(tx: Prisma.TransactionClient, contactId: string, delta: Prisma.Decimal) {
  if (delta.isZero()) return;
  await tx.contact.update({ where: { id: contactId }, data: { balance: { increment: money(delta) } } });
}

export class ContactsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListContactsQuery): Promise<Paginated<ContactDto>> {
    const q = query.q?.trim();
    const where: Prisma.ContactWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.withBalance ? { balance: { not: 0 } } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
        : {}),
    };
    const orderBy: Prisma.ContactOrderByWithRelationInput =
      query.sort === 'balance' ? { balance: 'desc' } : query.sort === 'recent' ? { updatedAt: 'desc' } : { name: 'asc' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.contact.count({ where }),
    ]);
    return { items: rows.map(toContactDto), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<ContactDto> {
    return toContactDto(await liveContact(this.prisma, id));
  }

  async create(input: ContactInput, actor: Actor): Promise<ContactDto> {
    const contact = await withTx(this.prisma, async (tx) => {
      if (await findByName(tx, input.type, input.name)) {
        throw conflict(`فيه ${TYPE_LABEL[input.type]} بنفس الاسم`, [{ path: 'name', message: 'الاسم مستخدم' }]);
      }
      const opening = money(input.openingBalance);
      const created = await tx.contact.create({ data: { ...input, openingBalance: opening, balance: opening } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'CONTACT_CREATE',
        entity: 'Contact',
        entityId: created.id,
        after: toContactDto(created),
        ip: actor.ip,
      });
      return created;
    });
    return toContactDto(contact);
  }

  async update(id: string, input: UpdateContactInput, actor: Actor): Promise<ContactDto> {
    const contact = await withTx(this.prisma, async (tx) => {
      const before = await liveContact(tx, id);
      if (input.name && (await findByName(tx, before.type, input.name, id))) {
        throw conflict(`فيه ${TYPE_LABEL[before.type]} بنفس الاسم`, [{ path: 'name', message: 'الاسم مستخدم' }]);
      }
      const updated = await tx.contact.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'CONTACT_UPDATE',
        entity: 'Contact',
        entityId: id,
        before: toContactDto(before),
        after: toContactDto(updated),
        ip: actor.ip,
      });
      return updated;
    });
    return toContactDto(contact);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await withTx(this.prisma, async (tx) => {
      const before = await liveContact(tx, id);
      if (!before.balance.isZero()) throw badRequest('مينفعش يتمسح وعليه حساب، صفّي الحساب الأول');
      await tx.contact.update({ where: { id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'CONTACT_DELETE',
        entity: 'Contact',
        entityId: id,
        before: toContactDto(before),
        ip: actor.ip,
      });
    });
  }

  /**
   * «💯 صفّر الحساب»: one payment for the whole balance, as in the old system. A positive balance is
   * collected/paid in full; a negative one is refunded in cash or settled on the books only.
   */
  async zero(id: string, input: ZeroAccountInput, actor: Actor): Promise<ContactDto> {
    const contact = await withTx(this.prisma, async (tx) => {
      const c = await liveContact(tx, id);
      const b = money(c.balance);
      if (b.isZero()) throw badRequest('الحساب خالص أصلًا');
      const owed = b.greaterThan(0);
      const affectsCash = owed || input.cash;
      const note = owed
        ? 'تصفير الحساب'
        : affectsCash
          ? `رد رصيد ${c.type === 'CUSTOMER' ? 'للعميل' : 'من المورد'} (تصفير الحساب)`
          : 'رصيد: تسوية تصفير الحساب (من غير فلوس)';
      const payment = await tx.payment.create({
        data: {
          contactId: id,
          direction: c.type === 'CUSTOMER' ? 'IN' : 'OUT',
          amount: b,
          method: 'CASH',
          date: dayToDate(todayYmd()),
          note,
          affectsCash,
          createdById: actor.id,
        },
      });
      await changeBalance(tx, id, b.negated());
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PAYMENT_CREATE',
        entity: 'Payment',
        entityId: payment.id,
        after: { contact: c.name, amount: num(b), zeroAccount: true, affectsCash },
        ip: actor.ip,
      });
      return tx.contact.findUniqueOrThrow({ where: { id } });
    });
    return toContactDto(contact);
  }

  /**
   * Account statement. Every line that moved the balance, oldest first, with a running balance;
   * lines before `from` are folded into the opening balance.
   */
  async statement(id: string, from?: string, to?: string): Promise<ContactStatement> {
    const contact = await liveContact(this.prisma, id);
    const [invoices, payments, returns] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { contactId: id, status: 'ACTIVE' },
        select: { id: true, no: true, kind: true, date: true, total: true, paid: true, payMethod: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { contactId: id, cancelledAt: null },
        select: { id: true, amount: true, method: true, date: true, note: true, createdAt: true, invoice: { select: { no: true } } },
      }),
      this.prisma.return.findMany({
        where: { contactId: id, settlement: 'BALANCE' },
        select: { id: true, total: true, date: true, createdAt: true, product: { select: { name: true } }, qty: true },
      }),
    ]);

    type Raw = Omit<StatementLine, 'balance'> & { at: Date };
    const openingLine: Raw[] = contact.openingBalance.isZero()
      ? []
      : [
          {
            kind: 'OPENING',
            id: contact.id,
            date: dateToDay(contact.createdAt),
            at: new Date(0),
            label: 'رصيد سابق',
            debit: Math.max(0, num(contact.openingBalance)),
            credit: Math.max(0, -num(contact.openingBalance)),
          },
        ];
    const raw: Raw[] = [
      ...openingLine,
      ...invoices.map((i) => ({
        kind: 'INVOICE' as const,
        id: i.id,
        date: dateToDay(i.date),
        at: i.createdAt,
        label: `فاتورة ${i.kind === 'SALE' ? 'بيع' : 'شراء'} ${i.no}`,
        debit: num(i.total),
        credit: num(i.paid),
        method: i.payMethod,
      })),
      ...payments.map((p) => ({
        kind: 'PAYMENT' as const,
        id: p.id,
        date: dateToDay(p.date),
        at: p.createdAt,
        label: p.note || (p.invoice ? `دفعة على ${p.invoice.no}` : contact.type === 'CUSTOMER' ? 'تحصيل' : 'سداد'),
        debit: 0,
        credit: num(p.amount),
        method: p.method,
      })),
      ...returns.map((r) => ({
        kind: 'RETURN' as const,
        id: r.id,
        date: dateToDay(r.date),
        at: r.createdAt,
        label: `مرتجع ${r.product.name} × ${num(r.qty)}`,
        debit: 0,
        credit: num(r.total),
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.at.getTime() - b.at.getTime());

    let running = ZERO;
    let opening = ZERO;
    const lines: StatementLine[] = [];
    for (const { at: _at, ...line } of raw) {
      running = running.plus(D(line.debit)).minus(D(line.credit));
      if (from && line.date < from) {
        opening = running;
        continue;
      }
      if (to && line.date > to) continue;
      lines.push({ ...line, balance: num(money(running)) });
    }
    return {
      contact: toContactDto(contact),
      from: from ?? null,
      to: to ?? null,
      opening: num(money(opening)),
      closing: lines.length ? lines[lines.length - 1]!.balance : num(money(opening)),
      lines,
    };
  }
}
