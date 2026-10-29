import type { PrismaClient } from '@prisma/client';
import { dateToDay, dayRange } from '../../lib/dates.js';
import { num } from '../../lib/money.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ContactReport {
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  contact: { id: string; phone: string; balance: number } | null;
  items: { name: string; qty: number; total: number; profit: number }[];
  invoices: { id: string; no: string; date: string; total: number; paid: number; remaining: number }[];
  payments: { date: string; amount: number; note: string }[];
  totals: { total: number; shipping: number; paid: number; remaining: number; returns: number; payments: number; net: number; profit: number; count: number };
}

/** «كشف عميل / مورد (اشترى منك بكام)» — الأصناف والفواتير والأرباح في فترة (contactReport القديمة). */
export async function contactReport(prisma: PrismaClient, input: { name: string; type: 'CUSTOMER' | 'SUPPLIER'; from?: string; to?: string }): Promise<ContactReport> {
  const isC = input.type === 'CUSTOMER';
  const name = input.name.trim();
  const range = input.from || input.to ? { date: dayRange(input.from, input.to) } : {};
  const contact = await prisma.contact.findFirst({ where: { name, type: input.type, deletedAt: null } });
  const invs = await prisma.invoice.findMany({
    where: { kind: isC ? 'SALE' : 'PURCHASE', status: 'ACTIVE', person: name, ...range },
    include: { items: { select: { name: true, qty: true, total: true, unitCost: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  const rets = await prisma.return.findMany({ where: { kind: isC ? 'SALE' : 'PURCHASE', person: name, ...range } });
  const pays = contact
    ? await prisma.payment.findMany({ where: { contactId: contact.id, cancelledAt: null, direction: isC ? 'IN' : 'OUT', ...range }, orderBy: { date: 'desc' } })
    : [];
  const items = new Map<string, { name: string; qty: number; total: number; profit: number }>();
  for (const i of invs) {
    for (const it of i.items) {
      const o = items.get(it.name) ?? { name: it.name, qty: 0, total: 0, profit: 0 };
      o.qty = r2(o.qty + num(it.qty));
      o.total += num(it.total);
      o.profit += num(it.total) - num(it.unitCost) * num(it.qty);
      items.set(it.name, o);
    }
  }
  const total = r2(invs.reduce((s, i) => s + num(i.total), 0));
  const shipping = r2(invs.reduce((s, i) => s + num(i.shipping), 0));
  const returns = r2(rets.reduce((s, r) => s + num(r.total), 0));
  const retProfit = rets.reduce((s, r) => s + num(r.total) - num(r.unitCost) * num(r.qty), 0);
  const profit = isC ? r2([...items.values()].reduce((s, o) => s + o.profit, 0) - retProfit) : 0;
  return {
    name,
    type: input.type,
    contact: contact ? { id: contact.id, phone: contact.phone, balance: num(contact.balance) } : null,
    items: [...items.values()].map((o) => ({ ...o, total: r2(o.total), profit: r2(o.profit) })).sort((a, b) => b.total - a.total),
    invoices: invs.map((i) => ({ id: i.id, no: i.no, date: dateToDay(i.date), total: num(i.total), paid: num(i.paid), remaining: num(i.remaining) })),
    payments: pays.map((p) => ({ date: dateToDay(p.date), amount: num(p.amount), note: p.note })),
    totals: {
      total,
      shipping,
      paid: r2(invs.reduce((s, i) => s + num(i.paid), 0)),
      remaining: r2(invs.reduce((s, i) => s + num(i.remaining), 0)),
      returns,
      payments: r2(pays.reduce((s, p) => s + num(p.amount), 0)),
      net: r2(total - returns),
      profit,
      count: invs.length,
    },
  };
}

/** «أكتر العملاء شراءً»: أول 15 عميل بالصافي بعد المرتجعات، مع الربح والحساب. */
export async function topCustomers(prisma: PrismaClient) {
  const invs = await prisma.invoice.findMany({
    where: { kind: 'SALE', status: 'ACTIVE', person: { not: '' } },
    select: { no: true, person: true, total: true, shipping: true, items: { select: { total: true, qty: true, unitCost: true } } },
  });
  const m = new Map<string, { name: string; total: number; profit: number; count: number }>();
  for (const i of invs) {
    if (i.person === 'يومية') continue;
    const o = m.get(i.person) ?? { name: i.person, total: 0, profit: 0, count: 0 };
    o.total += num(i.total);
    o.count++;
    o.profit += i.items.reduce((s, it) => s + num(it.total) - num(it.unitCost) * num(it.qty), 0);
    m.set(i.person, o);
  }
  const rets = await prisma.return.findMany({ where: { kind: 'SALE' }, select: { person: true, total: true, qty: true, unitCost: true } });
  for (const r of rets) {
    const o = m.get(r.person);
    if (!o) continue;
    o.total -= num(r.total);
    o.profit -= num(r.total) - num(r.unitCost) * num(r.qty);
  }
  const top = [...m.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  const contacts = await prisma.contact.findMany({ where: { type: 'CUSTOMER', deletedAt: null, name: { in: top.map((t) => t.name) } } });
  const bal = new Map(contacts.map((c) => [c.name, { id: c.id, balance: num(c.balance) }]));
  return top.map((t) => ({ name: t.name, count: t.count, total: r2(t.total), profit: r2(t.profit), contactId: bal.get(t.name)?.id ?? null, balance: bal.get(t.name)?.balance ?? null }));
}
