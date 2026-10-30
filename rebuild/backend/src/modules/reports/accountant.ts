import type { PrismaClient } from '@prisma/client';
import { addDays, dateToDay, dayToDate } from '../../lib/dates.js';
import { num } from '../../lib/money.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const PAY: Record<string, string> = { CASH: 'كاش', INSTAPAY: 'إنستاباي', WALLET: 'محفظة', TRANSFER: 'تحويل بنكي' };

export interface Sheet {
  name: string;
  rows: (string | number)[][];
}

/** «📤 تصدير للمحاسب»: one month as sheets — ملخص، مبيعات، مشتريات، مصاريف، دفعات، مرتجعات، أرصدة العملاء والموردين. */
export async function accountantExport(db: PrismaClient, month: string): Promise<Sheet[]> {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = addDays(m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`, -1);
  const range = { gte: dayToDate(first), lte: dayToDate(last) };
  const [invs, exps, pays, rets, contacts] = await Promise.all([
    db.invoice.findMany({ where: { status: 'ACTIVE', date: range }, include: { items: { select: { unitCost: true, qty: true } } }, orderBy: [{ date: 'asc' }, { no: 'asc' }] }),
    db.expense.findMany({ where: { date: range }, orderBy: { date: 'asc' } }),
    db.payment.findMany({ where: { date: range, cancelledAt: null }, include: { contact: { select: { name: true } } }, orderBy: { date: 'asc' } }),
    db.return.findMany({ where: { date: range }, include: { product: { select: { name: true } } }, orderBy: { date: 'asc' } }),
    db.contact.findMany({ where: { deletedAt: null, NOT: { balance: 0 } }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
  ]);
  const sales = invs.filter((i) => i.kind === 'SALE');
  const purs = invs.filter((i) => i.kind === 'PURCHASE');
  const sum = <T,>(L: T[], f: (x: T) => number) => r2(L.reduce((a, x) => a + f(x), 0));
  const cogs = (i: (typeof invs)[number]) => i.items.reduce((a, it) => a + num(it.unitCost) * num(it.qty), 0);
  const profit = sum(sales, (i) => num(i.subtotal) - num(i.discount) - cogs(i));
  const rSale = rets.filter((r) => r.kind === 'SALE');
  const rPur = rets.filter((r) => r.kind === 'PURCHASE');

  return [
    {
      name: 'ملخص',
      rows: [
        ['الشهر', month],
        [],
        ['البند', 'القيمة'],
        ['عدد فواتير البيع', sales.length],
        ['إجمالي المبيعات', sum(sales, (i) => num(i.total))],
        ['المحصّل من المبيعات وقت البيع', sum(sales, (i) => num(i.paid))],
        ['آجل (باقي على العملاء من فواتير الشهر)', sum(sales, (i) => num(i.remaining))],
        ['مرتجعات البيع', sum(rSale, (r) => num(r.total))],
        ['تكلفة البضاعة المباعة وأرباح المبيعات', profit],
        ['عدد فواتير الشراء', purs.length],
        ['إجمالي المشتريات', sum(purs, (i) => num(i.total))],
        ['المدفوع للموردين وقت الشراء', sum(purs, (i) => num(i.paid))],
        ['مرتجعات الشراء', sum(rPur, (r) => num(r.total))],
        ['إجمالي المصروفات', sum(exps, (e) => num(e.amount))],
        ['دفعات مستلمة من العملاء', sum(pays.filter((p) => p.direction === 'IN'), (p) => num(p.amount))],
        ['دفعات مسدّدة للموردين', sum(pays.filter((p) => p.direction === 'OUT'), (p) => num(p.amount))],
        ['صافي الربح التقريبي (أرباح المبيعات − المصروفات)', r2(profit - sum(exps, (e) => num(e.amount)))],
      ],
    },
    { name: 'مبيعات', rows: [['الرقم', 'التاريخ', 'العميل', 'الإجمالي', 'خصم', 'شحن', 'المدفوع', 'الباقي', 'طريقة الدفع'], ...sales.map((i) => [i.no, dateToDay(i.date), i.person, num(i.total), num(i.discount), num(i.shipping), num(i.paid), num(i.remaining), PAY[i.payMethod] ?? i.payMethod])] },
    { name: 'مشتريات', rows: [['الرقم', 'التاريخ', 'المورد', 'الإجمالي', 'المدفوع', 'الباقي'], ...purs.map((i) => [i.no, dateToDay(i.date), i.person, num(i.total), num(i.paid), num(i.remaining)])] },
    { name: 'مصروفات', rows: [['التاريخ', 'البيان', 'الفئة', 'المبلغ', 'اتدفع من'], ...exps.map((e) => [dateToDay(e.date), e.note, e.category, num(e.amount), PAY[e.method] ?? e.method])] },
    { name: 'دفعات', rows: [['التاريخ', 'الاسم', 'النوع', 'المبلغ', 'طريقة الدفع', 'ملاحظة'], ...pays.map((p) => [dateToDay(p.date), p.contact?.name ?? '', p.direction === 'IN' ? 'استلام' : 'سداد', num(p.amount), PAY[p.method] ?? p.method, p.note])] },
    { name: 'مرتجعات', rows: [['التاريخ', 'النوع', 'الصنف', 'الشخص', 'الكمية', 'السعر', 'الإجمالي', 'السبب'], ...rets.map((r) => [dateToDay(r.date), r.kind === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء', r.product.name, r.person, num(r.qty), num(r.price), num(r.total), r.note])] },
    { name: 'أرصدة', rows: [['الاسم', 'النوع', 'التليفون', 'الرصيد (موجب = عليه / ليه عندنا)'], ...contacts.map((c) => [c.name, c.type === 'CUSTOMER' ? 'عميل' : 'مورد', c.phone, num(c.balance)])] },
  ];
}
