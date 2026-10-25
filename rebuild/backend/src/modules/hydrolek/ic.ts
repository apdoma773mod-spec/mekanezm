import { randomUUID } from 'node:crypto';
import type { Company, Prisma, PrismaClient } from '@prisma/client';
import { PARTY, type IcAccount, type IcDeal, type IcTransferInput, type IcTransferResult } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { dateToDay, todayYmd } from '../../lib/dates.js';
import { badRequest } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';
import { createInvoiceInTx, InvoicesService } from '../invoices/service.js';
import { PaymentsService } from '../payments/service.js';

export const other = (c: Company): Company => (c === 'MK' ? 'HY' : 'MK');
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The buyer's product with the same name, created (empty, at the transfer price) when missing — the old icTransfer twins. */
export async function twinOf(tx: Prisma.TransactionClient, productId: string, company: Company, cost: number): Promise<string> {
  const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  if (p.company === company) return p.id;
  const t = await tx.product.findFirst({ where: { company, name: p.name.trim(), deletedAt: null } });
  if (t) return t.id;
  const code = await nextNumber(tx, COUNTER.product);
  const created = await tx.product.create({
    data: { code, name: p.name, category: p.category, unit: p.unit, price: p.price, cost: money(cost), qty: 0, minQty: 0, company },
  });
  return created.id;
}

/**
 * «🔁 التعامل بين الشركتين»: a sale in the seller's books and a purchase in the buyer's, sharing
 * one reference, in one transaction (the old version could leave half of it behind).
 */
export async function icTransferInTx(tx: Prisma.TransactionClient, input: IcTransferInput, actor: Actor): Promise<IcTransferResult> {
  const seller = input.seller as Company;
  const buyer = other(seller);
  const short: string[] = [];
  const lines = [];
  for (const l of input.lines) {
    const p = await tx.product.findUnique({ where: { id: l.productId } });
    if (!p || p.deletedAt || p.company !== seller) throw badRequest(`الصنف مش في مخزن ${seller === 'MK' ? 'ميكانيزم' : 'هيدرولك'}`);
    if (num(p.qty) < l.qty - 1e-9) short.push(`«${p.name}» متاح ${num(p.qty)} والمطلوب ${l.qty}`);
    lines.push({ ...l, name: p.name });
  }
  if (short.length && !input.force) throw badRequest(`الرصيد أقل من المطلوب:\n${short.join('\n')}`, [{ path: 'force', message: 'محتاج تأكيد' }]);
  const ref = randomUUID();
  const total = r2(lines.reduce((t, l) => t + l.qty * l.price, 0));
  const paid = Math.min(total, Math.max(0, input.paid));
  const note = `تعامل داخلي${input.note ? ` — ${input.note}` : ''}`;
  const base = { date: todayYmd(), phone: '', address: '', note, shipping: 0, discount: 0, paid, payMethod: 'CASH' as const };
  const saleId = await createInvoiceInTx(
    tx,
    { ...base, kind: 'SALE', company: seller, person: PARTY[buyer], items: lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price })) },
    actor,
    { ic: buyer, icRef: ref },
  );
  const buyerProducts: string[] = [];
  for (const l of lines) buyerProducts.push(await twinOf(tx, l.productId, buyer, l.price));
  const buyId = await createInvoiceInTx(
    tx,
    { ...base, kind: 'PURCHASE', company: buyer, person: PARTY[seller], items: lines.map((l, i) => ({ productId: buyerProducts[i], name: l.name, qty: l.qty, price: l.price })) },
    actor,
    { ic: seller, icRef: ref },
  );
  const [sale, buy] = await Promise.all([
    tx.invoice.findUniqueOrThrow({ where: { id: saleId }, select: { id: true, no: true } }),
    tx.invoice.findUniqueOrThrow({ where: { id: buyId }, select: { id: true, no: true } }),
  ]);
  await writeAudit(tx, { userId: actor.id, action: 'IC_TRANSFER', entity: 'Invoice', entityId: saleId, after: { seller, sale: sale.no, buy: buy.no, total }, ip: actor.ip });
  return { sale, buy, buyerProducts };
}

export class IcService {
  constructor(private readonly prisma: PrismaClient) {}

  transfer(input: IcTransferInput, actor: Actor) {
    return withTx(this.prisma, (tx) => icTransferInTx(tx, input, actor));
  }

  /** «سجل التعاملات». */
  async deals(): Promise<IcDeal[]> {
    const sales = await this.prisma.invoice.findMany({
      where: { kind: 'SALE', status: 'ACTIVE', ic: { not: null } },
      include: { items: { select: { name: true, qty: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const refs = sales.map((s) => s.icRef).filter((x): x is string => !!x);
    const buys = await this.prisma.invoice.findMany({ where: { kind: 'PURCHASE', status: 'ACTIVE', icRef: { in: refs } }, select: { id: true, icRef: true } });
    const buyOf = new Map(buys.map((b) => [b.icRef, b.id]));
    return sales.map((s) => ({
      ref: s.icRef ?? s.id,
      no: s.no,
      date: dateToDay(s.date),
      seller: s.company,
      buyer: s.ic!,
      items: s.items.map((i) => `${i.name} × ${num(i.qty)}`),
      total: num(s.total),
      remaining: num(s.remaining),
      saleId: s.id,
      buyId: (s.icRef && buyOf.get(s.icRef)) || null,
    }));
  }

  /** «🗑️ إلغاء»: voids the sale and the matching purchase. */
  async cancel(ref: string, actor: Actor) {
    const rows = await this.prisma.invoice.findMany({ where: { OR: [{ icRef: ref }, { id: ref }], status: 'ACTIVE' }, select: { id: true, kind: true } });
    if (!rows.length) throw badRequest('مش لاقي الفواتير');
    const inv = new InvoicesService(this.prisma);
    // The purchase first: it can't be voided once its goods are sold, and then nothing changes.
    for (const r of rows.sort((a, b) => (a.kind === 'PURCHASE' ? -1 : 1) - (b.kind === 'PURCHASE' ? -1 : 1))) {
      await inv.void(r.id, { reason: 'إلغاء تعامل بين الشركتين' }, actor);
    }
  }

  private async party(name: string, type: 'CUSTOMER' | 'SUPPLIER') {
    return this.prisma.contact.findFirst({ where: { name, type, deletedAt: null } });
  }

  /** «⚖️ حساب الشركتين» and its statement. */
  async account(): Promise<IcAccount> {
    const sales = await this.prisma.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', ic: { not: null } }, select: { company: true, ic: true, total: true, date: true, no: true } });
    const [c1, c2] = await Promise.all([this.party(PARTY.HY, 'CUSTOMER'), this.party(PARTY.MK, 'CUSTOMER')]);
    const ids = (await this.prisma.contact.findMany({ where: { name: { in: [PARTY.HY, PARTY.MK] } }, select: { id: true } })).map((c) => c.id);
    const pays = await this.prisma.payment.findMany({
      where: { contactId: { in: ids }, cancelledAt: null },
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const hyTook = r2(sales.filter((s) => s.company === 'MK' && s.ic === 'HY').reduce((a, s) => a + num(s.total), 0));
    const mkTook = r2(sales.filter((s) => s.company === 'HY' && s.ic === 'MK').reduce((a, s) => a + num(s.total), 0));
    const hyOwes = c1 ? num(c1.balance) : 0;
    const mkOwes = c2 ? num(c2.balance) : 0;
    const rows: IcAccount['rows'] = [];
    for (const s of sales) {
      const t = num(s.total);
      if (s.company === 'MK' && s.ic === 'HY') rows.push({ d: dateToDay(s.date), t: 'فاتورة', n: `هيدرولك أخدت من ميكانيزم #${s.no}`, v: t, b: 0 });
      else if (s.company === 'HY' && s.ic === 'MK') rows.push({ d: dateToDay(s.date), t: 'فاتورة', n: `ميكانيزم أخدت من هيدرولك #${s.no}`, v: -t, b: 0 });
    }
    for (const p of pays) {
      if (c1 && p.contactId === c1.id) rows.push({ d: dateToDay(p.date), t: 'سداد', n: `هيدرولك سددت${p.note ? ` — ${p.note}` : ''}`, v: -num(p.amount), b: 0 });
      else if (c2 && p.contactId === c2.id) rows.push({ d: dateToDay(p.date), t: 'سداد', n: `ميكانيزم سددت${p.note ? ` — ${p.note}` : ''}`, v: num(p.amount), b: 0 });
    }
    rows.sort((a, b) => a.d.localeCompare(b.d));
    let run = 0;
    for (const r of rows) r.b = run = r2(run + r.v);
    return {
      hyTook,
      mkTook,
      hyOwes,
      mkOwes,
      net: r2(hyOwes - mkOwes),
      rows,
      payments: pays.slice(0, 30).map((p) => ({ id: p.id, date: dateToDay(p.date), name: p.contact.name, company: p.company, note: p.note, amount: num(p.amount) })),
    };
  }

  /** «💸 سداد بين الشركتين»: a collection at the one that got paid and a payment at the one that paid. */
  async settle(dir: 'h2m' | 'm2h', amount: number, note: string, actor: Actor) {
    const P: [Awaited<ReturnType<IcService['party']>>, Company][] =
      dir === 'h2m'
        ? [
            [await this.party(PARTY.HY, 'CUSTOMER'), 'MK'],
            [await this.party(PARTY.MK, 'SUPPLIER'), 'HY'],
          ]
        : [
            [await this.party(PARTY.MK, 'CUSTOMER'), 'HY'],
            [await this.party(PARTY.HY, 'SUPPLIER'), 'MK'],
          ];
    if (!P[0][0] || !P[1][0]) throw badRequest('لسه مفيش تعامل في الاتجاه ده بين الشركتين');
    const n = `سداد بين الشركتين${note ? ` — ${note}` : ''}`;
    const pay = new PaymentsService(this.prisma);
    for (const [c, company] of P) await pay.create({ contactId: c!.id, amount, method: 'CASH', company, note: n }, actor);
  }
}
