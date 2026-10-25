import type { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_DEBT_TEMPLATE, type DashboardCharts, type DebtsDto, type ReorderSuggestion } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { addDays, dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { notFound } from '../../lib/errors.js';
import { num } from '../../lib/money.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / DAY_MS);
const AR_M = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Reminders = Record<string, { at: string; by: string; amount: number }>;
const REM_KEY = 'debt_reminders';
const TPL_KEY = 'debt_template';

/** Debts and reminders, reorder suggestions and the dashboard charts of the old system. */
export class InsightsService {
  constructor(private readonly prisma: PrismaClient) {}

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    return (s?.value as T | undefined) ?? fallback;
  }
  private async putSetting(tx: Prisma.TransactionClient, key: string, value: unknown, actor: Actor) {
    await tx.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: actor.id },
      update: { value: value as Prisma.InputJsonValue, updatedById: actor.id },
    });
  }

  async debts(): Promise<DebtsDto> {
    const [contacts, rem, tpl] = await Promise.all([
      this.prisma.contact.findMany({ where: { type: 'CUSTOMER', deletedAt: null, balance: { gt: 0.009 } } }),
      this.setting<Reminders>(REM_KEY, {}),
      this.setting<{ text?: string }>(TPL_KEY, {}),
    ]);
    const ids = contacts.map((c) => c.id);
    const [invs, pays] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { kind: 'SALE', status: 'ACTIVE', contactId: { in: ids }, remaining: { gt: 0 } },
        select: { id: true, no: true, date: true, remaining: true, contactId: true, createdAt: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.payment.findMany({
        where: { direction: 'IN', cancelledAt: null, contactId: { in: ids } },
        select: { contactId: true, amount: true, date: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const today = todayYmd();
    const debtors = contacts.map((c) => {
      const bal = num(c.balance);
      // Walk the credit invoices from newest to oldest until they cover the balance, as before.
      let left = bal;
      let since: string | null = null;
      const open: DebtsDto['debtors'][number]['open'] = [];
      for (const i of invs.filter((x) => x.contactId === c.id)) {
        if (left <= 0.009) break;
        const d = dateToDay(i.date);
        open.push({ id: i.id, no: i.no, date: d, remaining: num(i.remaining) });
        since = d;
        left = r2(left - num(i.remaining));
      }
      const lp = pays.find((p) => p.contactId === c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: bal,
        since,
        old: left > 0.009,
        days: since ? daysBetween(since, today) : null,
        open,
        lastPay: lp ? { amount: num(lp.amount), date: dateToDay(lp.date) } : null,
        reminder: rem[c.id] ?? null,
      };
    });
    return { debtors, template: tpl.text || DEFAULT_DEBT_TEMPLATE };
  }

  /** «💬 ذكّره»: remembers when the customer was last reminded and by whom. */
  async remind(contactId: string, actor: Actor) {
    const c = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!c || c.deletedAt) throw notFound('العميل ده مش موجود');
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.setting.findUnique({ where: { key: REM_KEY } });
      const rem = { ...((s?.value as Reminders | undefined) ?? {}) };
      rem[contactId] = { at: new Date().toISOString(), by: user?.name ?? '', amount: num(c.balance) };
      await this.putSetting(tx, REM_KEY, rem, actor);
      await writeAudit(tx, { userId: actor.id, action: 'DEBT_REMIND', entity: 'Contact', entityId: contactId, after: { amount: num(c.balance) }, ip: actor.ip });
    });
  }

  async saveTemplate(text: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      await this.putSetting(tx, TPL_KEY, { text }, actor);
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: TPL_KEY, ip: actor.ip });
    });
  }

  /** Net pieces sold per product since a day (sales minus sale returns). */
  private async soldSince(from: string) {
    const [items, rets] = await Promise.all([
      this.prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: { productId: { not: null }, invoice: { kind: 'SALE', status: 'ACTIVE', date: { gte: dayToDate(from) } } },
        _sum: { qty: true },
      }),
      this.prisma.return.groupBy({ by: ['productId'], where: { kind: 'SALE', date: { gte: dayToDate(from) } }, _sum: { qty: true } }),
    ]);
    const m = new Map<string, number>();
    for (const i of items) m.set(i.productId!, num(i._sum.qty));
    for (const r of rets) m.set(r.productId, (m.get(r.productId) ?? 0) - num(r._sum.qty));
    return m;
  }

  /** «📦 اقتراحات الطلب»: what runs out soon at its selling speed, grouped by the last supplier. */
  async reorder(days: number): Promise<ReorderSuggestion[]> {
    const today = todayYmd();
    const WIN = 60;
    const [products, sold, first, lastBuy, suppliers] = await Promise.all([
      this.prisma.product.findMany({ where: { deletedAt: null } }),
      this.soldSince(addDays(today, -WIN)),
      this.prisma.invoice.findFirst({ where: { kind: 'SALE', status: 'ACTIVE' }, orderBy: { date: 'asc' }, select: { date: true } }),
      this.prisma.$queryRaw<{ productId: string; person: string }[]>`
        SELECT DISTINCT ON (ii."productId") ii."productId", i.person
        FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
        WHERE i.kind = 'PURCHASE' AND i.status = 'ACTIVE' AND ii."productId" IS NOT NULL AND i.person <> ''
        ORDER BY ii."productId", i.date DESC, i."createdAt" DESC`,
      this.prisma.contact.findMany({ where: { type: 'SUPPLIER', deletedAt: null }, select: { name: true, phone: true } }),
    ]);
    const eff = first ? Math.min(WIN, Math.max(14, daysBetween(dateToDay(first.date), today) + 1)) : WIN;
    const sup = new Map(lastBuy.map((x) => [x.productId, x.person.trim()]));
    const phone = new Map(suppliers.map((s) => [s.name, s.phone]));
    const out: ReorderSuggestion[] = [];
    for (const p of products) {
      const daily = Math.max(0, sold.get(p.id) ?? 0) / eff;
      const qty = num(p.qty);
      const min = num(p.minQty);
      const cover = daily > 0 ? qty / daily : null;
      const low = qty <= min && (min > 0 || daily > 0);
      const soon = cover !== null && cover <= days / 2;
      if (!low && !soon) continue;
      const s = sup.get(p.id) ?? '';
      out.push({
        productId: p.id,
        name: p.name,
        unit: p.unit,
        qty,
        min,
        daily,
        cover,
        need: Math.ceil(Math.max(daily * days - qty, min * 1.5 - qty, 1)),
        supplier: s,
        supplierPhone: phone.get(s) ?? '',
      });
    }
    return out.sort((a, b) => (a.cover ?? Infinity) - (b.cover ?? Infinity) || a.qty - b.qty);
  }

  async charts(top: number, stag: number): Promise<DashboardCharts> {
    const today = todayYmd();
    const now = dayToDate(today);
    const monthStart = (i: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const from6 = dateToDay(monthStart(5));
    const [sales, rets, exps, stagSold, products] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { kind: 'SALE', status: 'ACTIVE', date: { gte: dayToDate(top ? addDays(today, -Math.max(top, 30)) : '2000-01-01') } },
        select: { date: true, subtotal: true, discount: true, items: { select: { name: true, qty: true, total: true, unitCost: true } } },
      }),
      this.prisma.return.findMany({ where: { kind: 'SALE', date: { gte: dayToDate(from6 < addDays(today, -30) ? from6 : addDays(today, -30)) } }, select: { date: true, total: true, qty: true, unitCost: true } }),
      this.prisma.expense.findMany({ where: { deletedAt: null, date: { gte: dayToDate(from6) } }, select: { date: true, amount: true } }),
      this.soldSince(addDays(today, -stag)),
      this.prisma.product.findMany({ where: { deletedAt: null, qty: { gt: 0 } }, select: { id: true, name: true, qty: true, cost: true, unit: true } }),
    ]);
    // Monthly profit needs six months of sales even when «top» looks at fewer days.
    const sales6 =
      top && Math.max(top, 30) < daysBetween(from6, today)
        ? await this.prisma.invoice.findMany({
            where: { kind: 'SALE', status: 'ACTIVE', date: { gte: dayToDate(from6) } },
            select: { date: true, subtotal: true, discount: true, items: { select: { name: true, qty: true, total: true, unitCost: true } } },
          })
        : sales;
    const net = (i: (typeof sales)[number]) => num(i.subtotal) - num(i.discount);

    const byDay = new Map<string, number>();
    for (const i of sales6) byDay.set(dateToDay(i.date), (byDay.get(dateToDay(i.date)) ?? 0) + net(i));
    for (const r of rets) byDay.set(dateToDay(r.date), (byDay.get(dateToDay(r.date)) ?? 0) - num(r.total));
    const daily = Array.from({ length: 30 }, (_, k) => {
      const d = addDays(today, -(29 - k));
      return { l: String(Number(d.slice(8))), t: d, v: r2(byDay.get(d) ?? 0) };
    });

    const monthly = Array.from({ length: 6 }, (_, k) => {
      const d = monthStart(5 - k);
      const pre = dateToDay(d).slice(0, 7);
      const inM = (x: { date: Date }) => dateToDay(x.date).startsWith(pre);
      const S = sales6.filter(inM);
      const R = rets.filter(inM);
      const s = r2(S.reduce((a, i) => a + net(i), 0) - R.reduce((a, r) => a + num(r.total), 0));
      const cogs = r2(
        S.reduce((a, i) => a + i.items.reduce((b, it) => b + num(it.unitCost) * num(it.qty), 0), 0) - R.reduce((a, r) => a + num(r.unitCost) * num(r.qty), 0),
      );
      const exp = r2(exps.filter(inM).reduce((a, e) => a + num(e.amount), 0));
      const m = d.getUTCMonth();
      return { l: AR_M[m]!, t: `${AR_M[m]} ${d.getUTCFullYear()}`, v: r2(s - cogs - exp), sales: s, gross: r2(s - cogs), exp };
    });

    const from = top ? addDays(today, -top) : '';
    const t = new Map<string, number>();
    for (const i of sales) {
      if (from && dateToDay(i.date) < from) continue;
      for (const it of i.items) t.set(it.name, (t.get(it.name) ?? 0) + num(it.total));
    }
    const topItems = [...t].map(([n, v]) => ({ n, v: r2(v) })).sort((a, b) => b.v - a.v).slice(0, 10);

    const stagnant = products
      .filter((p) => (stagSold.get(p.id) ?? 0) <= 0)
      .map((p) => ({ n: p.name, v: r2(num(p.qty) * num(p.cost)), q: num(p.qty), u: p.unit }))
      .sort((a, b) => b.v - a.v);

    return { daily, monthly, top: topItems, stagnant };
  }
}
