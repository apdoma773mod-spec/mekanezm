import { Prisma, type Contact, type Invoice, type InvoiceItem, type PrismaClient, type Product } from '@prisma/client';
import type {
  PayMethod,
  InvoiceDto,
  InvoiceInput,
  InvoiceListResult,
  ListInvoicesQuery,
  UpdateInvoiceInput,
  VoidInvoiceInput,
} from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { dateToDay, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { ZERO, money, num, qty as roundQty, sum } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';
import { alertInvoiceSaved, alertInvoiceVoided } from '../../lib/alert-hooks.js';
import { changeBalance, findOrCreateContact, liveContact } from '../contacts/service.js';

type InvoiceWithRels = Invoice & {
  items: (InvoiceItem & { product: Pick<Product, 'code'> | null })[];
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
};

const INCLUDE = {
  items: { orderBy: { position: 'asc' }, include: { product: { select: { code: true } } } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceInclude;

function header(i: Invoice & { createdBy: InvoiceWithRels['createdBy']; updatedBy: InvoiceWithRels['updatedBy'] }) {
  return {
    id: i.id,
    kind: i.kind,
    no: i.no,
    status: i.status,
    company: i.company,
    online: i.online,
    onlineFrom: i.onlineFrom,
    date: dateToDay(i.date),
    contactId: i.contactId,
    person: i.person,
    phone: i.phone,
    address: i.address,
    note: i.note,
    subtotal: num(i.subtotal),
    discount: num(i.discount),
    shipping: num(i.shipping),
    total: num(i.total),
    paid: num(i.paid),
    remaining: num(i.remaining),
    payMethod: i.payMethod,
    createdBy: i.createdBy,
    updatedBy: i.updatedBy,
    voidedAt: i.voidedAt ? i.voidedAt.toISOString() : null,
    voidReason: i.voidReason,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export function toInvoiceDto(i: InvoiceWithRels, admin: boolean): InvoiceDto {
  const cogs = sum(i.items.map((it) => it.unitCost.times(it.qty)));
  // Profit only means something on sales: what the goods sold for minus what they cost.
  const profit = i.kind === 'SALE' ? money(i.subtotal.minus(i.discount).minus(cogs)) : ZERO;
  return {
    ...header(i),
    ...(admin ? { profit: num(profit) } : {}),
    items: i.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      code: it.product?.code ?? null,
      name: it.name,
      unit: it.unit,
      qty: num(it.qty),
      price: num(it.price),
      total: num(it.total),
      ...(admin ? { unitCost: num(it.unitCost) } : {}),
    })),
  };
}

interface PreparedLine {
  product: Product;
  qty: Prisma.Decimal;
  price: Prisma.Decimal;
  total: Prisma.Decimal;
}

interface Totals {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  shipping: Prisma.Decimal;
  total: Prisma.Decimal;
}

function computeTotals(lines: PreparedLine[], discountIn: number, shippingIn: number): Totals {
  const subtotal = money(sum(lines.map((l) => l.total)));
  const discount = money(discountIn);
  const shipping = money(shippingIn);
  if (discount.greaterThan(subtotal)) throw badRequest('الخصم أكبر من إجمالي الأصناف', [{ path: 'discount', message: 'الخصم كبير' }]);
  return { subtotal, discount, shipping, total: money(subtotal.minus(discount).plus(shipping)) };
}

/**
 * Resolves each line to a product. A line with only a name reuses the product with that
 * exact name, or creates one (a sale sets its price, a purchase its cost), like the old system.
 */
async function prepareLines(
  tx: Prisma.TransactionClient,
  kind: Invoice['kind'],
  company: Invoice['company'],
  items: InvoiceInput['items'],
  actor: Actor,
): Promise<PreparedLine[]> {
  const out: PreparedLine[] = [];
  for (const [index, it] of items.entries()) {
    let product: Product | null = null;
    if (it.productId) {
      product = await tx.product.findUnique({ where: { id: it.productId } });
      if (!product || product.deletedAt) {
        throw badRequest(`الصنف رقم ${index + 1} مش موجود`, [{ path: `items.${index}.productId`, message: 'الصنف مش موجود' }]);
      }
    } else {
      product = await tx.product.findFirst({
        where: { deletedAt: null, name: { equals: it.name.trim(), mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      });
      if (!product) {
        let code: string;
        for (;;) {
          code = await nextNumber(tx, COUNTER.product);
          if (!(await tx.product.findUnique({ where: { code }, select: { id: true } }))) break;
        }
        product = await tx.product.create({
          data: {
            code,
            name: it.name.trim(),
            company,
            price: kind === 'SALE' ? it.price : 0,
            cost: kind === 'PURCHASE' ? it.price : 0,
          },
        });
        await writeAudit(tx, {
          userId: actor.id,
          action: 'PRODUCT_CREATE',
          entity: 'Product',
          entityId: product.id,
          after: { code, name: product.name, from: 'invoice' },
          ip: actor.ip,
        });
      }
    }
    const qty = roundQty(it.qty);
    const price = money(it.price);
    out.push({ product, qty, price, total: money(qty.times(price)) });
  }
  return out;
}

/**
 * Writes the lines and moves stock. A sale snapshots the product cost; a purchase records its price as cost.
 * `skipStock` is for the daybook, whose lines already took their goods out of stock.
 */
import { noteCostRise } from '../products/cost-rises.js';

async function writeLines(
  tx: Prisma.TransactionClient,
  invoice: Invoice,
  lines: PreparedLine[],
  reason: 'SALE' | 'PURCHASE' | 'INVOICE_EDIT',
  actor: Actor,
  skipStock = false,
) {
  const sale = invoice.kind === 'SALE';
  for (const [position, l] of lines.entries()) {
    await tx.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        productId: l.product.id,
        name: l.product.name,
        unit: l.product.unit,
        qty: l.qty,
        price: l.price,
        total: l.total,
        unitCost: sale ? l.product.cost : l.price,
        position,
      },
    });
    if (!skipStock) {
      await moveStock(tx, {
        productId: l.product.id,
        change: sale ? l.qty.negated() : l.qty,
        reason,
        refType: 'Invoice',
        refId: invoice.id,
        userId: actor.id,
      });
    }
    if (!sale && !l.price.isZero() && (!l.product.cost.equals(l.price) || l.product.costEst)) {
      // Latest purchase price becomes the product cost, as in the old system.
      await noteCostRise(tx, l.product, l.price, invoice.no);
      await tx.product.update({ where: { id: l.product.id }, data: { cost: l.price, costEst: false } });
    }
  }
}

/**
 * A purchase can't be voided, or have a product dropped from it, once that product
 * was sold on or after the purchase date: the stock it supplied is already gone.
 */
async function assertNotSoldSince(tx: Prisma.TransactionClient, invoice: Invoice, productIds: string[]) {
  if (invoice.kind !== 'PURCHASE' || productIds.length === 0) return;
  const sold = await tx.invoiceItem.findMany({
    where: {
      productId: { in: productIds },
      invoice: { kind: 'SALE', status: 'ACTIVE', date: { gte: invoice.date } },
    },
    distinct: ['productId'],
    select: { name: true },
  });
  if (sold.length) {
    throw badRequest(`الأصناف دي اتباع منها بعد الشراء: ${sold.map((s) => s.name).join('، ')}`);
  }
}

/** Returns the stock of every line and takes the invoice's remaining amount off the contact's balance. */
async function reverseInvoice(tx: Prisma.TransactionClient, invoice: Invoice, reason: 'INVOICE_EDIT' | 'INVOICE_VOID', actor: Actor) {
  const items = await tx.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
  for (const it of items) {
    if (!it.productId) continue;
    await moveStock(tx, {
      productId: it.productId,
      change: invoice.kind === 'SALE' ? it.qty : it.qty.negated(),
      reason,
      refType: 'Invoice',
      refId: invoice.id,
      userId: actor.id,
    });
  }
  if (invoice.contactId) await changeBalance(tx, invoice.contactId, invoice.remaining.negated());
  return items;
}

async function resolveContact(
  tx: Prisma.TransactionClient,
  kind: Invoice['kind'],
  input: Pick<InvoiceInput, 'contactId' | 'person' | 'phone' | 'address'>,
  actor: Actor,
): Promise<Contact | null> {
  const type = kind === 'SALE' ? 'CUSTOMER' : 'SUPPLIER';
  if (input.contactId) {
    const c = await liveContact(tx, input.contactId);
    if (c.type !== type) throw badRequest(kind === 'SALE' ? 'اختار عميل مش مورد' : 'اختار مورد مش عميل');
    return c;
  }
  if (!input.person) return null;
  return findOrCreateContact(tx, type, { name: input.person, phone: input.phone, address: input.address }, actor);
}

function settle(total: Prisma.Decimal, paidIn: number | undefined, contact: Contact | null) {
  const paid = paidIn === undefined ? total : money(paidIn);
  const remaining = money(total.minus(paid));
  if (!remaining.isZero() && !contact) {
    throw badRequest('اكتب اسم العميل أو المورد عشان الباقي يتسجل عليه', [{ path: 'person', message: 'الاسم مطلوب للآجل' }]);
  }
  return { paid, remaining };
}

export interface CreateOptions {
  /** The goods already left stock (daybook lines). */
  skipStock?: boolean;
  /** Paid with several methods at once. */
  paidSplit?: Partial<Record<PayMethod, number>>;
  source?: string;
  /** A sale to nobody in particular («يومية»): never creates a contact for the name. */
  noContact?: boolean;
  /** Inter-company deal between Mekanizm and Hydrolek. */
  ic?: 'MK' | 'HY';
  icRef?: string;
}

/** Creates an invoice inside the caller's transaction; returns its id. */
export async function createInvoiceInTx(
  tx: Prisma.TransactionClient,
  input: InvoiceInput,
  actor: Actor,
  opts: CreateOptions = {},
): Promise<string> {
  const lines = await prepareLines(tx, input.kind, input.company, input.items, actor);
  const totals = computeTotals(lines, input.discount, input.shipping);
  const contact = opts.noContact ? null : await resolveContact(tx, input.kind, input, actor);
  const { paid, remaining } = settle(totals.total, input.paid, contact);
  if (remaining.isNegative()) {
    throw badRequest('المدفوع أكبر من إجمالي الفاتورة', [{ path: 'paid', message: 'المدفوع أكبر من الإجمالي' }]);
  }
  const no = await nextNumber(tx, input.kind === 'SALE' ? COUNTER.sale : COUNTER.purchase);
  const invoice = await tx.invoice.create({
    data: {
      kind: input.kind,
      no,
      company: input.company,
      date: dayToDate(input.date ?? todayYmd()),
      contactId: contact?.id ?? null,
      person: contact?.name ?? input.person,
      phone: input.phone || contact?.phone || '',
      address: input.address || contact?.address || '',
      note: input.note,
      ...totals,
      paid,
      remaining,
      payMethod: input.payMethod,
      ...(opts.paidSplit ? { paidSplit: opts.paidSplit } : {}),
      source: opts.source ?? '',
      online: input.kind === 'SALE' && !!input.online,
      onlineFrom: input.kind === 'SALE' && input.online ? (input.onlineFrom ?? '') : '',
      ...(opts.ic ? { ic: opts.ic, icRef: opts.icRef ?? null } : {}),
      createdById: actor.id,
    },
  });
  await writeLines(tx, invoice, lines, input.kind, actor, opts.skipStock);
  if (contact) await changeBalance(tx, contact.id, remaining);
  await writeAudit(tx, {
    userId: actor.id,
    action: 'INVOICE_CREATE',
    entity: 'Invoice',
    entityId: invoice.id,
    after: { no, kind: input.kind, total: num(totals.total), paid: num(paid), person: invoice.person, source: opts.source },
    ip: actor.ip,
  });
  return invoice.id;
}

/** Daybook lines still waiting to be handed over: their pieces never left stock. */
async function pendingOwed(tx: Prisma.TransactionClient, invoiceId: string) {
  return tx.daybookEntry.findMany({
    where: { invoiceId, kind: 'ITEM', owed: { gt: 0 }, deliveredAt: null, productId: { not: null } },
  });
}

export class InvoicesService {
  constructor(private readonly prisma: PrismaClient) {}

  private async load(id: string): Promise<InvoiceWithRels> {
    const inv = await this.prisma.invoice.findUnique({ where: { id }, include: INCLUDE });
    if (!inv) throw notFound('الفاتورة دي مش موجودة');
    return inv;
  }

  async list(query: ListInvoicesQuery): Promise<InvoiceListResult> {
    const q = query.q?.trim();
    const where: Prisma.InvoiceWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      status: query.status ?? 'ACTIVE',
      ...(query.company ? { company: query.company } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.unpaid || query.pay === 'credit' ? { remaining: { gt: 0 } } : {}),
      ...(query.pay === 'paid' ? { remaining: { lte: 0 } } : {}),
      ...(query.person ? { person: query.person } : {}),
      ...(query.from || query.to ? { date: dayRange(query.from, query.to) } : {}),
      ...(q
        ? {
            OR: [
              { no: { contains: q.toUpperCase() } },
              { person: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { note: { contains: q, mode: 'insensitive' } },
              { items: { some: { name: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [rows, total, agg] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          items: { select: { name: true, qty: true }, orderBy: { position: 'asc' }, take: 3 },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({ where, _sum: { total: true, remaining: true } }),
    ]);
    return {
      items: rows.map((r) => ({ ...header(r), itemCount: r._count.items, firstItem: r.items[0]?.name ?? '', preview: r.items.map((x) => ({ name: x.name, qty: num(x.qty) })) })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      sums: { total: num(agg._sum.total), remaining: num(agg._sum.remaining) },
    };
  }

  async get(id: string, actor: Actor): Promise<InvoiceDto> {
    return toInvoiceDto(await this.load(id), isAdmin(actor));
  }

  async create(input: InvoiceInput, actor: Actor): Promise<InvoiceDto> {
    const id = await withTx(this.prisma, (tx) => createInvoiceInTx(tx, input, actor));
    await alertInvoiceSaved(this.prisma, id, actor);
    return toInvoiceDto(await this.load(id), isAdmin(actor));
  }

  /** Admin edit: undo the old invoice's effect on stock and balance, then apply the new version. */
  async update(id: string, input: UpdateInvoiceInput, actor: Actor): Promise<InvoiceDto> {
    const oldTotal = num((await this.prisma.invoice.findUnique({ where: { id }, select: { total: true } }))?.total);
    await withTx(this.prisma, async (tx) => {
      const before = await tx.invoice.findUnique({ where: { id }, include: INCLUDE });
      if (!before) throw notFound('الفاتورة دي مش موجودة');
      if (before.status === 'VOID') throw badRequest('الفاتورة دي ملغية، مينفعش تتعدل');
      if ((await pendingOwed(tx, id)).length) {
        throw badRequest('الفاتورة دي فيها «باقي للعميل» لسه ماتسلّمش — سلّمه من اليومية الأول وبعدين عدّل');
      }

      const lines = await prepareLines(tx, before.kind, input.company, input.items, actor);
      const kept = new Set(lines.map((l) => l.product.id));
      const dropped = before.items.filter((it) => it.productId && !kept.has(it.productId)).map((it) => it.productId!);
      await assertNotSoldSince(tx, before, dropped);

      await reverseInvoice(tx, before, 'INVOICE_EDIT', actor);
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const totals = computeTotals(lines, input.discount, input.shipping);
      const contact = await resolveContact(tx, before.kind, input, actor);
      // Editing may leave the invoice overpaid; the negative remaining becomes credit on the contact.
      const { paid, remaining } = settle(totals.total, input.paid ?? num(before.paid), contact);
      if (remaining.isNegative() && !contact) {
        throw badRequest('المدفوع أكبر من الإجمالي، اختار العميل عشان الفرق يتسجل له', [
          { path: 'paid', message: 'المدفوع أكبر من الإجمالي' },
        ]);
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          company: input.company,
          ...(input.online !== undefined && before.kind === 'SALE' ? { online: input.online, onlineFrom: input.online ? (input.onlineFrom ?? before.onlineFrom) : '' } : {}),
          contactId: contact?.id ?? null,
          person: contact?.name ?? input.person,
          phone: input.phone || contact?.phone || '',
          address: input.address || contact?.address || '',
          note: input.note,
          ...totals,
          paid,
          remaining,
          payMethod: input.payMethod,
          // An edit re-states the paid amount with one method, so a daybook split no longer applies.
          paidSplit: Prisma.DbNull,
          updatedById: actor.id,
        },
      });
      await writeLines(tx, updated, lines, 'INVOICE_EDIT', actor);
      if (contact) await changeBalance(tx, contact.id, remaining);
      await writeAudit(tx, {
        userId: actor.id,
        action: 'INVOICE_UPDATE',
        entity: 'Invoice',
        entityId: id,
        before: toInvoiceDto(before, true),
        after: { total: num(totals.total), paid: num(paid), remaining: num(remaining), items: lines.length },
        ip: actor.ip,
      });
    });
    await alertInvoiceSaved(this.prisma, id, actor, { oldTotal });
    return toInvoiceDto(await this.load(id), true);
  }

  /**
   * Admin void, as in the old system: stock comes back and the unpaid part leaves the contact's
   * balance. When the invoice is on a contact, money already paid stays as credit for them;
   * otherwise it is treated as refunded.
   */
  /** Names that appear on invoices of one kind (the purchases screen's supplier filter). */
  async persons(kind: 'SALE' | 'PURCHASE', company?: 'MK' | 'HY'): Promise<string[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { kind, status: 'ACTIVE', person: { not: '' }, ...(company ? { company } : {}) },
      distinct: ['person'],
      select: { person: true },
      orderBy: { person: 'asc' },
    });
    return rows.map((r) => r.person);
  }

  /** «تغيّر التكلفة»: each purchase line against the previous purchase price of the same product, and the stock cost now. */
  async costChange(id: string): Promise<{ name: string; productId: string | null; price: number; prev: number | null; cost: number | null }[]> {
    const inv = await this.prisma.invoice.findUnique({ where: { id }, include: { items: { orderBy: { position: 'asc' } } } });
    if (!inv || inv.kind !== 'PURCHASE') throw notFound('فاتورة الشراء دي مش موجودة');
    const out = [];
    for (const it of inv.items) {
      const prev = it.productId
        ? await this.prisma.invoiceItem.findFirst({
            where: { productId: it.productId, invoiceId: { not: id }, invoice: { kind: 'PURCHASE', status: 'ACTIVE', date: { lte: inv.date } } },
            orderBy: [{ invoice: { date: 'desc' } }, { invoice: { createdAt: 'desc' } }],
            select: { price: true },
          })
        : null;
      const p = it.productId ? await this.prisma.product.findUnique({ where: { id: it.productId }, select: { cost: true } }) : null;
      out.push({ name: it.name, productId: it.productId, price: num(it.price), prev: prev ? num(prev.price) : null, cost: p ? num(p.cost) : null });
    }
    return out;
  }

  /** «🔄 حدّث سعر الشراء في المخزن بالأسعار دي». */
  async applyCost(id: string, actor: Actor): Promise<number> {
    return withTx(this.prisma, async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
      if (!inv || inv.kind !== 'PURCHASE') throw notFound('فاتورة الشراء دي مش موجودة');
      let n = 0;
      for (const it of inv.items) {
        if (!it.productId || !it.price.gt(0)) continue;
        await tx.product.update({ where: { id: it.productId }, data: { cost: it.price, costEst: false } });
        n++;
      }
      await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_UPDATE', entity: 'Invoice', entityId: id, after: { appliedCost: n }, ip: actor.ip });
      return n;
    });
  }

  /** Same supplier and the same total (with the supplier's own invoice number, or on the same day) = probably saved twice. */
  async duplicate(input: { person: string; total: number; sno?: string }): Promise<{ no: string; total: number } | null> {
    const day = dayToDate(todayYmd());
    const hit = await this.prisma.invoice.findFirst({
      where: {
        kind: 'PURCHASE',
        status: 'ACTIVE',
        person: input.person.trim(),
        total: { gte: money(input.total - 0.01), lte: money(input.total + 0.01) },
        ...(input.sno ? { note: { contains: `فاتورة المورد: ${input.sno}` } } : { date: day }),
      },
      select: { no: true, total: true },
    });
    return hit ? { no: hit.no, total: num(hit.total) } : null;
  }

  async void(id: string, input: VoidInvoiceInput, actor: Actor): Promise<InvoiceDto> {
    const snap = await this.prisma.invoice.findUnique({ where: { id }, select: { kind: true, no: true, total: true, person: true, createdById: true } });
    await withTx(this.prisma, async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id } });
      if (!inv) throw notFound('الفاتورة دي مش موجودة');
      if (inv.status === 'VOID') throw badRequest('الفاتورة دي ملغية من قبل كده');
      const items = await tx.invoiceItem.findMany({ where: { invoiceId: id }, select: { productId: true } });
      await assertNotSoldSince(tx, inv, items.flatMap((i) => (i.productId ? [i.productId] : [])));
      await reverseInvoice(tx, inv, 'INVOICE_VOID', actor);
      // Undelivered daybook pieces never left stock, so reversing the full line over-counted them.
      for (const e of await pendingOwed(tx, id)) {
        await moveStock(tx, {
          productId: e.productId!,
          change: e.owed.negated(),
          reason: 'INVOICE_VOID',
          refType: 'Invoice',
          refId: id,
          note: 'باقي للعميل اتلغى مع الفاتورة',
          userId: actor.id,
        });
        await tx.daybookEntry.update({
          where: { id: e.id },
          data: { deliveredAt: new Date(), note: `${e.note} (اتلغى مع الفاتورة)`.trim() },
        });
      }

      const keepPaidAsCredit = !!inv.contactId && inv.paid.greaterThan(0);
      if (keepPaidAsCredit && inv.contactId) {
        // The money stays in the drawer, now as a payment that reduces what the contact owes.
        await tx.payment.create({
          data: {
            contactId: inv.contactId,
            direction: inv.kind === 'SALE' ? 'IN' : 'OUT',
            amount: inv.paid,
            method: inv.payMethod,
            company: inv.company,
            date: dayToDate(todayYmd()),
            note: `رصيد من إلغاء فاتورة ${inv.no}`,
            createdById: actor.id,
          },
        });
        await changeBalance(tx, inv.contactId, inv.paid.negated());
      }

      await tx.invoice.update({
        where: { id },
        data: { status: 'VOID', voidedAt: new Date(), voidedById: actor.id, voidReason: input.reason },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'INVOICE_VOID',
        entity: 'Invoice',
        entityId: id,
        before: { no: inv.no, total: num(inv.total), paid: num(inv.paid) },
        after: { reason: input.reason, keepPaidAsCredit },
        ip: actor.ip,
      });
    });
    if (snap) await alertInvoiceVoided(this.prisma, snap, actor);
    return toInvoiceDto(await this.load(id), true);
  }
}
