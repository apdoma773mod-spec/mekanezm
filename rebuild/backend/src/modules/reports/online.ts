import type { PrismaClient } from '@prisma/client';
import { dateToDay, dayRange } from '../../lib/dates.js';
import { num } from '../../lib/money.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

interface Side {
  invoices: number;
  customers: number;
  total: number;
  paid: number;
  remaining: number;
  profit: number;
}

export interface OnlineReport {
  online: Side;
  shop: Side;
  /** «جه منين»: الموقع / واتساب / فيسبوك … */
  bySource: (Side & { from: string })[];
  customers: { name: string; phone: string; from: string; invoices: number; total: number; remaining: number; profit: number; first: string; last: string }[];
  items: { name: string; qty: number; total: number }[];
  invoices: { id: string; no: string; date: string; person: string; from: string; total: number; remaining: number }[];
}

/** «🌐 العملاء الأونلاين»: sales marked online in a period — how many customers, how much, profit — next to the shop's sales. */
export async function onlineReport(prisma: PrismaClient, q: { from?: string; to?: string }): Promise<OnlineReport> {
  const range = q.from || q.to ? { date: dayRange(q.from, q.to) } : {};
  const invs = await prisma.invoice.findMany({
    where: { kind: 'SALE', status: 'ACTIVE', ...range },
    select: {
      id: true,
      no: true,
      date: true,
      person: true,
      phone: true,
      contactId: true,
      online: true,
      onlineFrom: true,
      subtotal: true,
      discount: true,
      total: true,
      paid: true,
      remaining: true,
      items: { select: { name: true, qty: true, total: true, unitCost: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  const profitOf = (i: (typeof invs)[number]) => num(i.subtotal) - num(i.discount) - i.items.reduce((a, it) => a + num(it.unitCost) * num(it.qty), 0);
  // a sale with no name still counts as one customer
  const who = (i: (typeof invs)[number]) => i.contactId || i.person.trim() || i.phone.trim() || i.id;
  const side = (L: typeof invs): Side => ({
    invoices: L.length,
    customers: new Set(L.map(who)).size,
    total: r2(L.reduce((a, i) => a + num(i.total), 0)),
    paid: r2(L.reduce((a, i) => a + num(i.paid), 0)),
    remaining: r2(L.reduce((a, i) => a + num(i.remaining), 0)),
    profit: r2(L.reduce((a, i) => a + profitOf(i), 0)),
  });
  const on = invs.filter((i) => i.online);
  const byC = new Map<string, OnlineReport['customers'][number]>();
  const byI = new Map<string, OnlineReport['items'][number]>();
  for (const i of on) {
    const d = dateToDay(i.date);
    const c = byC.get(who(i)) ?? { name: i.person.trim() || 'بدون اسم', phone: i.phone, from: i.onlineFrom, invoices: 0, total: 0, remaining: 0, profit: 0, first: d, last: d };
    c.invoices++;
    c.total = r2(c.total + num(i.total));
    c.remaining = r2(c.remaining + num(i.remaining));
    c.profit = r2(c.profit + profitOf(i));
    if (d < c.first) c.first = d;
    if (d > c.last) c.last = d;
    if (!c.phone && i.phone) c.phone = i.phone;
    byC.set(who(i), c);
    for (const it of i.items) {
      const x = byI.get(it.name) ?? { name: it.name, qty: 0, total: 0 };
      x.qty = Math.round((x.qty + num(it.qty)) * 1000) / 1000;
      x.total = r2(x.total + num(it.total));
      byI.set(it.name, x);
    }
  }
  return {
    online: side(on),
    shop: side(invs.filter((i) => !i.online)),
    bySource: [...new Set(on.map((i) => i.onlineFrom))].map((from) => ({ from, ...side(on.filter((i) => i.onlineFrom === from)) })).sort((a, b) => b.total - a.total),
    customers: [...byC.values()].sort((a, b) => b.total - a.total),
    items: [...byI.values()].sort((a, b) => b.total - a.total).slice(0, 50),
    invoices: on.slice(0, 300).map((i) => ({ id: i.id, no: i.no, date: dateToDay(i.date), person: i.person, from: i.onlineFrom, total: num(i.total), remaining: num(i.remaining) })),
  };
}
