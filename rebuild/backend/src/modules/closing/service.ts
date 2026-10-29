import type { Prisma, PrismaClient } from '@prisma/client';
import { alertClosing } from '../../lib/alert-hooks.js';
import type { ClosingDto, ClosingInput, DaySummary, Paginated } from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayRange, dayToDate } from '../../lib/dates.js';
import { ZERO, money, num, sum } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';
import { CashService } from '../cash/service.js';

const n = (d: Prisma.Decimal | null | undefined) => num(d ?? ZERO);

export class ClosingService {
  private readonly cash: CashService;
  constructor(private readonly prisma: PrismaClient) {
    this.cash = new CashService(prisma);
  }

  /** The old mk_day_summary: everything that happened on one business day, for «تقفيل اليومية». */
  async summary(day: string, actor: Actor): Promise<DaySummary> {
    const date = dayRange(day, day);
    const [sales, purchases, collections, supplierPayments, expenses, saleRet, purRet, open, cash, items, byUser] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { kind: 'SALE', status: 'ACTIVE', date },
        _count: true,
        _sum: { total: true, paid: true, remaining: true, shipping: true },
      }),
      this.prisma.invoice.aggregate({ where: { kind: 'PURCHASE', status: 'ACTIVE', date }, _sum: { total: true, paid: true } }),
      this.prisma.payment.aggregate({ where: { direction: 'IN', cancelledAt: null, affectsCash: true, date }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { direction: 'OUT', cancelledAt: null, affectsCash: true, date }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { deletedAt: null, date }, _sum: { amount: true } }),
      this.prisma.return.aggregate({ where: { kind: 'SALE', date }, _sum: { total: true } }),
      this.prisma.return.aggregate({ where: { kind: 'PURCHASE', date }, _sum: { total: true } }),
      this.prisma.daybookEntry.count({ where: { day: dayToDate(day), postedAt: null } }),
      this.cash.summary({ from: day, to: day }),
      this.prisma.invoiceItem.findMany({
        where: { invoice: { kind: 'SALE', status: 'ACTIVE', date } },
        select: { name: true, qty: true, total: true, unitCost: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['createdById'],
        where: { kind: 'SALE', status: 'ACTIVE', date },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const top = new Map<string, { qty: Prisma.Decimal; total: Prisma.Decimal }>();
    for (const it of items) {
      const t = top.get(it.name) ?? { qty: ZERO, total: ZERO };
      top.set(it.name, { qty: t.qty.plus(it.qty), total: t.total.plus(it.total) });
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: byUser.map((u) => u.createdById).filter((x): x is string => !!x) } },
      select: { id: true, name: true },
    });
    const userName = new Map(users.map((u) => [u.id, u.name]));
    const salesNet = money(sum(items.map((it) => it.total)));
    const cogs = money(sum(items.map((it) => it.unitCost.times(it.qty))));
    const discounts = await this.prisma.invoice.aggregate({ where: { kind: 'SALE', status: 'ACTIVE', date }, _sum: { discount: true } });

    return {
      day,
      salesCount: sales._count,
      salesTotal: n(sales._sum.total),
      salesPaid: n(sales._sum.paid),
      salesCredit: n(sales._sum.remaining),
      shipping: n(sales._sum.shipping),
      collections: n(collections._sum.amount),
      purchasesTotal: n(purchases._sum.total),
      purchasesPaid: n(purchases._sum.paid),
      supplierPayments: n(supplierPayments._sum.amount),
      expenses: n(expenses._sum.amount),
      returnsSale: n(saleRet._sum.total),
      returnsPurchase: n(purRet._sum.total),
      instapay: cash.byMethod.INSTAPAY.in,
      wallet: cash.byMethod.WALLET.in,
      transfer: cash.byMethod.TRANSFER.in,
      daybookOpen: open,
      cashExpected: cash.byMethod.CASH.net,
      topItems: [...top.entries()]
        .map(([name, v]) => ({ name, qty: num(v.qty), total: num(money(v.total)) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      byUser: byUser
        .map((u) => ({ name: (u.createdById && userName.get(u.createdById)) || '—', count: u._count, total: n(u._sum.total) }))
        .sort((a, b) => b.total - a.total),
      ...(isAdmin(actor) ? { profit: num(money(salesNet.minus(discounts._sum.discount ?? ZERO).minus(cogs))) } : {}),
    };
  }

  async save(input: ClosingInput, actor: Actor): Promise<ClosingDto> {
    // The saved snapshot never carries profit, like the old one, since staff can read closings.
    const { profit: _profit, ...data } = await this.summary(input.day, actor);
    const id = await withTx(this.prisma, async (tx) => {
      const expected = money(data.cashExpected);
      const actual = input.cashActual === null ? null : money(input.cashActual);
      const row = await tx.dayClosing.create({
        data: {
          day: dayToDate(input.day),
          data: data as unknown as Prisma.InputJsonValue,
          cashExpected: expected,
          cashActual: actual,
          cashDiff: actual ? money(actual.minus(expected)) : null,
          note: input.note,
          createdById: actor.id,
        },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAY_CLOSE',
        entity: 'DayClosing',
        entityId: row.id,
        after: { day: input.day, expected: num(expected), actual: actual ? num(actual) : null },
        ip: actor.ip,
      });
      return row.id;
    });
    const saved = await this.prisma.dayClosing.findUniqueOrThrow({ where: { id }, include: { createdBy: { select: { name: true } } } });
    await alertClosing(this.prisma, { cashDiff: saved.cashDiff ? num(saved.cashDiff) : null, cashExpected: num(saved.cashExpected), cashActual: saved.cashActual ? num(saved.cashActual) : null, note: saved.note }, actor);
    return this.toDto(saved);
  }

  async list(page: number, pageSize: number): Promise<Paginated<ClosingDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dayClosing.findMany({
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dayClosing.count(),
    ]);
    return { items: rows.map((r) => this.toDto(r)), total, page, pageSize };
  }

  private toDto(r: Prisma.DayClosingGetPayload<{ include: { createdBy: { select: { name: true } } } }>): ClosingDto {
    return {
      id: r.id,
      day: dateToDay(r.day),
      data: r.data as unknown as DaySummary,
      cashExpected: num(r.cashExpected),
      cashActual: r.cashActual ? num(r.cashActual) : null,
      cashDiff: r.cashDiff ? num(r.cashDiff) : null,
      note: r.note,
      createdBy: r.createdBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
