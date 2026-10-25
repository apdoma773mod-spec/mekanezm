import type { Company, Prisma, PrismaClient } from '@prisma/client';
import { PAY_METHODS, type CashMove, type CashQuery, type CashSummary, type TodaySummary } from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { dateToDay, dayRange, todayYmd } from '../../lib/dates.js';
import { ZERO, money, num, sum } from '../../lib/money.js';

const KIND_LABEL = { SALE: 'بيع', PURCHASE: 'شراء' } as const;

export class CashService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Every movement of money in the range, from the records themselves (no separate ledger
   * that could drift): invoice payments, collections, supplier payments, cash returns, expenses.
   */
  async summary(query: CashQuery): Promise<CashSummary> {
    const from = query.from ?? todayYmd();
    const to = query.to ?? from;
    const date = dayRange(from, to);
    const co = query.company ? { company: query.company as Company } : {};

    const [invoices, payments, returns, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { status: 'ACTIVE', paid: { gt: 0 }, date, ...co },
        select: { id: true, kind: true, no: true, person: true, paid: true, payMethod: true, date: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { cancelledAt: null, affectsCash: true, date, ...co },
        select: { id: true, direction: true, amount: true, method: true, date: true, createdAt: true, note: true, contact: { select: { name: true } } },
      }),
      this.prisma.return.findMany({
        where: { settlement: 'CASH', date, ...co },
        select: { id: true, kind: true, total: true, method: true, date: true, createdAt: true, person: true, product: { select: { name: true } } },
      }),
      this.prisma.expense.findMany({
        where: { deletedAt: null, date, ...co },
        select: { id: true, category: true, note: true, amount: true, method: true, date: true, createdAt: true },
      }),
    ]);

    const moves: CashMove[] = [
      ...invoices.map((i) => ({
        kind: i.kind,
        id: `inv-${i.id}`,
        refId: i.id,
        date: dateToDay(i.date),
        at: i.createdAt.toISOString(),
        label: `${KIND_LABEL[i.kind]} ${i.no}${i.person ? ` — ${i.person}` : ''}`,
        method: i.payMethod,
        amount: num(i.kind === 'SALE' ? i.paid : i.paid.negated()),
      })),
      ...payments.map((p) => ({
        kind: p.direction === 'IN' ? ('PAYMENT_IN' as const) : ('PAYMENT_OUT' as const),
        id: `pay-${p.id}`,
        refId: p.id,
        date: dateToDay(p.date),
        at: p.createdAt.toISOString(),
        label: `${p.direction === 'IN' ? 'تحصيل من' : 'سداد لـ'} ${p.contact.name}${p.note ? ` — ${p.note}` : ''}`,
        method: p.method,
        amount: num(p.direction === 'IN' ? p.amount : p.amount.negated()),
      })),
      ...returns.map((r) => ({
        kind: r.kind === 'SALE' ? ('SALE_RETURN' as const) : ('PURCHASE_RETURN' as const),
        id: `ret-${r.id}`,
        refId: r.id,
        date: dateToDay(r.date),
        at: r.createdAt.toISOString(),
        label: `مرتجع ${r.kind === 'SALE' ? 'بيع' : 'شراء'} ${r.product.name}${r.person ? ` — ${r.person}` : ''}`,
        method: r.method,
        // Refunding a customer takes money out; a supplier refunding us brings it in.
        amount: num(r.kind === 'SALE' ? r.total.negated() : r.total),
      })),
      ...expenses.map((e) => ({
        kind: 'EXPENSE' as const,
        id: `exp-${e.id}`,
        refId: e.id,
        date: dateToDay(e.date),
        at: e.createdAt.toISOString(),
        label: `مصروف ${e.category}${e.note ? ` — ${e.note}` : ''}`,
        method: e.method,
        amount: -num(e.amount),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const byMethod = Object.fromEntries(PAY_METHODS.map((m) => [m, { in: 0, out: 0, net: 0 }])) as CashSummary['byMethod'];
    for (const m of moves) {
      const bucket = byMethod[m.method];
      if (m.amount >= 0) bucket.in += m.amount;
      else bucket.out += -m.amount;
    }
    let tin = 0;
    let tout = 0;
    for (const b of Object.values(byMethod)) {
      b.in = Math.round(b.in * 100) / 100;
      b.out = Math.round(b.out * 100) / 100;
      b.net = Math.round((b.in - b.out) * 100) / 100;
      tin += b.in;
      tout += b.out;
    }
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      from,
      to,
      byMethod,
      totals: { in: r2(tin), out: r2(tout), net: r2(tin - tout) },
      balance: num(await this.balance(query.company as Company | undefined)),
      moves,
    };
  }

  /** All money in minus all money out since the start, with database sums (no rows loaded). */
  async balance(company?: Company) {
    const co = company ? { company } : {};
    const [sales, purchases, payIn, payOut, saleRet, purRet, exp] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { kind: 'SALE', status: 'ACTIVE', ...co }, _sum: { paid: true } }),
      this.prisma.invoice.aggregate({ where: { kind: 'PURCHASE', status: 'ACTIVE', ...co }, _sum: { paid: true } }),
      this.prisma.payment.aggregate({ where: { direction: 'IN', cancelledAt: null, affectsCash: true, ...co }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { direction: 'OUT', cancelledAt: null, affectsCash: true, ...co }, _sum: { amount: true } }),
      this.prisma.return.aggregate({ where: { kind: 'SALE', settlement: 'CASH', ...co }, _sum: { total: true } }),
      this.prisma.return.aggregate({ where: { kind: 'PURCHASE', settlement: 'CASH', ...co }, _sum: { total: true } }),
      this.prisma.expense.aggregate({ where: { deletedAt: null, ...co }, _sum: { amount: true } }),
    ]);
    const v = (d: Prisma.Decimal | null) => d ?? ZERO;
    return money(
      sum([v(sales._sum.paid), v(payIn._sum.amount), v(purRet._sum.total)]).minus(
        sum([v(purchases._sum.paid), v(payOut._sum.amount), v(saleRet._sum.total), v(exp._sum.amount)]),
      ),
    );
  }

  async today(actor: Actor): Promise<TodaySummary> {
    const day = todayYmd();
    const date = dayRange(day, day);
    const [sales, purchases, cash, expenses, low, receivables, payables, saleItems] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { kind: 'SALE', status: 'ACTIVE', date },
        _count: true,
        _sum: { total: true, paid: true },
      }),
      this.prisma.invoice.aggregate({ where: { kind: 'PURCHASE', status: 'ACTIVE', date }, _count: true, _sum: { total: true } }),
      this.summary({ from: day, to: day }),
      this.prisma.expense.aggregate({ where: { deletedAt: null, date }, _sum: { amount: true } }),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Product" WHERE "deletedAt" IS NULL AND qty <= "minQty"`,
      this.prisma.contact.aggregate({ where: { type: 'CUSTOMER', deletedAt: null, balance: { gt: 0 } }, _sum: { balance: true } }),
      this.prisma.contact.aggregate({ where: { type: 'SUPPLIER', deletedAt: null, balance: { gt: 0 } }, _sum: { balance: true } }),
      isAdmin(actor)
        ? this.prisma.invoice.findMany({
            where: { kind: 'SALE', status: 'ACTIVE', date },
            select: { subtotal: true, discount: true, items: { select: { qty: true, unitCost: true } } },
          })
        : Promise.resolve(null),
    ]);
    const profit = saleItems
      ? money(sum(saleItems.map((i) => i.subtotal.minus(i.discount).minus(sum(i.items.map((it) => it.unitCost.times(it.qty)))))))
      : null;
    return {
      date: day,
      sales: { count: sales._count, total: num(sales._sum.total ?? ZERO), paid: num(sales._sum.paid ?? ZERO) },
      purchases: { count: purchases._count, total: num(purchases._sum.total ?? ZERO) },
      cashNet: cash.totals.net,
      expenses: num(expenses._sum.amount ?? ZERO),
      lowStockCount: Number(low[0]?.n ?? 0),
      receivables: num(receivables._sum.balance ?? ZERO),
      payables: num(payables._sum.balance ?? ZERO),
      ...(profit ? { profit: num(profit) } : {}),
    };
  }
}
