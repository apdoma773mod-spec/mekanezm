import type { DaybookEntry, DaybookPay, PayMethod, Prisma, PrismaClient } from '@prisma/client';
import type {
  DaybookAddInput,
  DaybookDay,
  DaybookEntryDto,
  DaybookPostResult,
  DaybookUpdateInput,
} from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { D, ZERO, money, num, qty as roundQty, sum } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';
import { createInvoiceInTx } from '../invoices/service.js';

const INCLUDE = {
  product: { select: { unit: true } },
  invoice: { select: { id: true, no: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.DaybookEntryInclude;

type EntryWithRels = Prisma.DaybookEntryGetPayload<{ include: typeof INCLUDE }>;

function toDto(e: EntryWithRels): DaybookEntryDto {
  return {
    id: e.id,
    day: dateToDay(e.day),
    kind: e.kind,
    productId: e.productId,
    name: e.name,
    unit: e.product?.unit ?? null,
    qty: num(e.qty),
    price: num(e.price),
    total: num(money(e.qty.times(e.price))),
    owed: num(e.owed),
    person: e.person,
    pay: e.pay,
    note: e.note,
    deliveredAt: e.deliveredAt?.toISOString() ?? null,
    postedAt: e.postedAt?.toISOString() ?? null,
    invoice: e.invoice,
    createdBy: e.createdBy?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

const lineTotal = (e: Pick<DaybookEntry, 'qty' | 'price'>) => money(e.qty.times(e.price));

/** How much of an item line should be out of stock right now: everything except undelivered «باقي له». */
const targetOut = (e: Pick<DaybookEntry, 'kind' | 'productId' | 'qty' | 'owed' | 'deliveredAt'>) =>
  e.kind === 'ITEM' && e.productId ? e.qty.minus(e.deliveredAt ? ZERO : e.owed) : ZERO;

/** Moves stock so the line's `stockOut` matches its current quantity, owed and delivery state. */
async function syncStock(tx: Prisma.TransactionClient, e: DaybookEntry, actor: Actor, note = '') {
  const want = targetOut(e);
  const delta = want.minus(e.stockOut);
  if (delta.isZero() || !e.productId) return;
  await moveStock(tx, {
    productId: e.productId,
    change: delta.negated(),
    reason: 'DAYBOOK',
    refType: 'Daybook',
    refId: e.id,
    note,
    userId: actor.id,
  });
  await tx.daybookEntry.update({ where: { id: e.id }, data: { stockOut: want } });
}

async function liveEntry(tx: Prisma.TransactionClient, id: string) {
  const e = await tx.daybookEntry.findUnique({ where: { id } });
  if (!e) throw notFound('السطر ده مش موجود');
  return e;
}

function checkLine(e: { kind: string; qty: Prisma.Decimal; owed: Prisma.Decimal; pay: DaybookPay; person: string }) {
  if (e.owed.greaterThan(e.qty)) throw badRequest('«باقي له» لازم يبقى أقل من أو يساوي العدد', [{ path: 'owed', message: 'أكبر من العدد' }]);
  if (e.pay === 'CREDIT' && !e.person) throw badRequest('اكتب اسم العميل — الآجل لازم يبقى ليه اسم', [{ path: 'person', message: 'مطلوب للآجل' }]);
  if (e.kind === 'PAY' && e.pay === 'CREDIT') throw badRequest('الدفعة مينفعش تبقى آجل');
}

/** Per-method paid amounts of a group of daybook lines (credit lines excluded). */
function splitFor(lines: Pick<DaybookEntry, 'pay' | 'qty' | 'price'>[]) {
  const split: Partial<Record<PayMethod, Prisma.Decimal>> = {};
  for (const l of lines) {
    if (l.pay === 'CREDIT') continue;
    const m = l.pay as PayMethod;
    split[m] = (split[m] ?? ZERO).plus(lineTotal(l));
  }
  return split;
}

export class DaybookService {
  constructor(private readonly prisma: PrismaClient) {}

  async day(day: string): Promise<DaybookDay> {
    const [entries, owed] = await Promise.all([
      this.prisma.daybookEntry.findMany({ where: { day: dayToDate(day) }, include: INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.prisma.daybookEntry.findMany({
        where: { kind: 'ITEM', owed: { gt: 0 }, deliveredAt: null },
        include: INCLUDE,
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { day, entries: entries.map(toDto), owed: owed.map(toDto) };
  }

  private async one(id: string) {
    return toDto(await this.prisma.daybookEntry.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }

  async add(input: DaybookAddInput, actor: Actor): Promise<DaybookEntryDto> {
    const id = await withTx(this.prisma, async (tx) => {
      const day = dayToDate(input.day ?? todayYmd());
      let data: Prisma.DaybookEntryUncheckedCreateInput;
      if (input.kind === 'PAY') {
        data = { day, kind: 'PAY', name: 'دفعة', qty: 1, price: money(input.price), person: input.person, pay: input.pay, note: input.note, createdById: actor.id };
      } else {
        let name = input.name;
        let productId: string | null = null;
        if (input.productId) {
          const p = await tx.product.findUnique({ where: { id: input.productId } });
          if (p && !p.deletedAt) {
            productId = p.id;
            name = p.name;
          }
        }
        if (!name) throw badRequest('اختار صنف أو اكتب اسمه', [{ path: 'name', message: 'مطلوب' }]);
        const qty = roundQty(input.qty);
        const owed = roundQty(input.owed);
        checkLine({ kind: 'ITEM', qty, owed, pay: input.pay, person: input.person });
        data = {
          day,
          kind: 'ITEM',
          productId,
          name,
          qty,
          price: money(input.price),
          owed,
          person: input.person,
          pay: input.pay,
          note: input.note,
          createdById: actor.id,
        };
      }
      const e = await tx.daybookEntry.create({ data });
      await syncStock(tx, e, actor);
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_ADD',
        entity: 'DaybookEntry',
        entityId: e.id,
        after: { name: e.name, qty: num(e.qty), price: num(e.price), person: e.person, pay: e.pay },
        ip: actor.ip,
      });
      return e.id;
    });
    return this.one(id);
  }

  async update(id: string, input: DaybookUpdateInput, actor: Actor): Promise<DaybookEntryDto> {
    await withTx(this.prisma, async (tx) => {
      const o = await liveEntry(tx, id);
      if (o.postedAt) throw badRequest('السطر ده اتصفّى خلاص — عدّله من الفاتورة');
      const isPay = o.kind === 'PAY';
      const next = {
        qty: isPay ? D(1) : input.qty !== undefined ? roundQty(input.qty) : o.qty,
        price: input.price !== undefined ? money(input.price) : o.price,
        owed: isPay ? ZERO : input.owed !== undefined ? roundQty(input.owed) : o.owed,
        person: input.person ?? o.person,
        pay: input.pay ?? o.pay,
        note: input.note ?? o.note,
      };
      if (isPay && !next.person) throw badRequest('اكتب اسم العميل');
      if (isPay && !next.price.greaterThan(0)) throw badRequest('اكتب المبلغ');
      checkLine({ kind: o.kind, ...next });
      const e = await tx.daybookEntry.update({
        where: { id },
        data: { ...next, ...(next.owed.isZero() ? { deliveredAt: null } : {}) },
      });
      await syncStock(tx, e, actor);
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_UPDATE',
        entity: 'DaybookEntry',
        entityId: id,
        before: { qty: num(o.qty), price: num(o.price), owed: num(o.owed), person: o.person, pay: o.pay },
        after: { qty: num(e.qty), price: num(e.price), owed: num(e.owed), person: e.person, pay: e.pay },
        ip: actor.ip,
      });
    });
    return this.one(id);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await withTx(this.prisma, async (tx) => {
      const o = await liveEntry(tx, id);
      if (o.postedAt) throw badRequest('السطر ده اتصفّى خلاص — عدّله من الفاتورة');
      await syncStock(tx, { ...o, qty: ZERO, owed: ZERO }, actor, 'اتمسح من اليومية');
      await tx.daybookEntry.delete({ where: { id } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_DELETE',
        entity: 'DaybookEntry',
        entityId: id,
        before: { name: o.name, qty: num(o.qty), price: num(o.price), person: o.person },
        ip: actor.ip,
      });
    });
  }

  /**
   * Changing how a line was paid, even after settling, as in the old system — except to or from
   * «آجل» once settled, since that would change what the customer owes on the invoice.
   */
  async setPay(id: string, pay: DaybookPay, actor: Actor): Promise<DaybookEntryDto> {
    await withTx(this.prisma, async (tx) => {
      const o = await liveEntry(tx, id);
      if (o.postedAt && (o.pay === 'CREDIT' || pay === 'CREDIT')) {
        throw badRequest('السطر اتصفّى — الآجل يتغير من الفاتورة نفسها');
      }
      checkLine({ ...o, pay });
      await tx.daybookEntry.update({ where: { id }, data: { pay } });
      if (o.postedAt && o.invoiceId) {
        const lines = await tx.daybookEntry.findMany({ where: { invoiceId: o.invoiceId } });
        const split = splitFor(lines);
        await tx.invoice.update({
          where: { id: o.invoiceId },
          data: { paidSplit: Object.fromEntries(Object.entries(split).map(([k, v]) => [k, num(money(v))])) },
        });
      }
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_UPDATE',
        entity: 'DaybookEntry',
        entityId: id,
        before: { pay: o.pay },
        after: { pay },
        ip: actor.ip,
      });
    });
    return this.one(id);
  }

  /** «✔ سلّمت»: the waiting pieces are handed over and leave stock now. */
  async deliver(id: string, actor: Actor): Promise<DaybookEntryDto> {
    await withTx(this.prisma, async (tx) => {
      const o = await liveEntry(tx, id);
      if (o.owed.lessThanOrEqualTo(0) || o.deliveredAt) return;
      const e = await tx.daybookEntry.update({ where: { id }, data: { deliveredAt: new Date() } });
      await syncStock(tx, e, actor, 'اتسلّم للعميل');
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_DELIVER',
        entity: 'DaybookEntry',
        entityId: id,
        after: { name: o.name, owed: num(o.owed), person: o.person },
        ip: actor.ip,
      });
    });
    return this.one(id);
  }

  /**
   * «🧮 صفّي»: one sale invoice per customer from the day's open lines (nameless sales go into one
   * «يومية» invoice). Payments by the same customer that day count toward what they paid.
   */
  async post(day: string, person: string | undefined, actor: Actor): Promise<DaybookPostResult> {
    return withTx(this.prisma, async (tx) => {
      const open = await tx.daybookEntry.findMany({
        where: { day: dayToDate(day), postedAt: null, ...(person !== undefined ? { person } : {}) },
        orderBy: { createdAt: 'asc' },
      });
      const groups = new Map<string, DaybookEntry[]>();
      for (const e of open) groups.set(e.person, [...(groups.get(e.person) ?? []), e]);

      const out: DaybookPostResult['invoices'] = [];
      for (const [who, lines] of groups) {
        const items = lines.filter((l) => l.kind === 'ITEM');
        if (!items.length) continue;
        const tot = money(sum(items.map(lineTotal)));
        const split = splitFor(lines);
        const paid = money(sum(Object.values(split)));
        if (paid.greaterThan(tot.plus(0.001))) {
          throw badRequest(`الدفعة أكبر من حساب ${who || 'البيع من غير اسم'} — قلّلها أو سجّلها من دفعات العميل`);
        }
        const credit = money(tot.minus(paid));
        const pays = money(sum(lines.filter((l) => l.kind === 'PAY').map(lineTotal)));
        const owedTxt = items
          .filter((l) => l.owed.greaterThan(0) && !l.deliveredAt)
          .map((l) => `${l.name} × ${num(l.owed)}`)
          .join('، ');
        const parts = [
          'من يومية المحل',
          split.CASH ? `نقدي ${num(money(split.CASH))}` : '',
          split.INSTAPAY ? `إنستاباي ${num(money(split.INSTAPAY))}` : '',
          split.TRANSFER ? `تحويل ${num(money(split.TRANSFER))}` : '',
          pays.greaterThan(0) ? `(منهم دفعة ${num(pays)})` : '',
          credit.greaterThan(0) ? `آجل ${num(credit)}` : '',
          owedTxt ? `باقي للعميل: ${owedTxt}` : '',
        ].filter(Boolean);
        const main = (Object.entries(split) as [PayMethod, Prisma.Decimal][]).sort((a, b) => b[1].comparedTo(a[1]))[0]?.[0] ?? 'CASH';

        const invoiceId = await createInvoiceInTx(
          tx,
          {
            kind: 'SALE',
            company: 'MK',
            date: day,
            person: who || 'يومية',
            phone: '',
            address: '',
            note: parts.join(' • '),
            shipping: 0,
            discount: 0,
            paid: num(paid),
            payMethod: main,
            items: items.map((l) => ({ productId: l.productId ?? undefined, name: l.name, qty: num(l.qty), price: num(l.price) })),
          },
          actor,
          {
            skipStock: true,
            source: 'DAYBOOK',
            noContact: who === '',
            paidSplit: Object.fromEntries(Object.entries(split).map(([k, v]) => [k, num(money(v))])),
          },
        );
        await tx.daybookEntry.updateMany({
          where: { id: { in: lines.map((l) => l.id) } },
          data: { postedAt: new Date(), invoiceId },
        });
        const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { no: true } });
        out.push({ person: who, id: invoiceId, no: inv.no });
      }
      if (!out.length) throw badRequest('مفيش أصناف تتصفّى — الدفعات لوحدها بتستنى أصناف العميل');
      await writeAudit(tx, {
        userId: actor.id,
        action: 'DAYBOOK_POST',
        entity: 'Daybook',
        entityId: day,
        after: { invoices: out.map((o) => o.no) },
        ip: actor.ip,
      });
      return { invoices: out };
    });
  }
}
