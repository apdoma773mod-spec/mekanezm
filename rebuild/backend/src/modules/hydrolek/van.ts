import type { Prisma, PrismaClient } from '@prisma/client';
import type { CloseDto, CloseRow, VanState } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num, qty as roundQty } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';
import { icTransferInTx } from './ic.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface VanMoveInput {
  kind: 'load' | 'sale' | 'return' | 'adjust' | 'unload';
  productId: string;
  name: string;
  /** Positive amount; the sign comes from the kind (sale/unload take away, adjust keeps its sign). */
  qty: number;
  src?: string;
  funder?: string;
  cost?: number;
  ref?: string;
  note?: string;
  vehicleId?: string;
  date?: string;
  byName: string;
}

/**
 * The old mk_van_move: keeps VanStock in step. Loads add to the funder's row at a weighted cost;
 * taking away goes through the rows oldest first (no funder first), and may go below zero only
 * for a sale that already happened.
 */
export async function vanMoveInTx(tx: Prisma.TransactionClient, m: VanMoveInput) {
  const date = dayToDate(m.date ?? todayYmd());
  const base = { date, kind: m.kind, productId: m.productId, name: m.name, src: m.src ?? 'hy', ref: m.ref ?? '', note: m.note ?? '', vehicleId: m.vehicleId ?? '', byName: m.byName };
  if (m.kind === 'load' || m.kind === 'return' || (m.kind === 'adjust' && m.qty > 0)) {
    const funder = m.funder ?? '';
    const row = await tx.vanStock.findUnique({ where: { productId_funder: { productId: m.productId, funder } } });
    const cost = m.cost ?? (row ? num(row.cost) : 0);
    if (row) {
      const q0 = num(row.qty);
      const q1 = q0 + m.qty;
      const c1 = q1 > 0 && q0 > 0 ? (q0 * num(row.cost) + m.qty * cost) / q1 : cost;
      await tx.vanStock.update({ where: { id: row.id }, data: { qty: roundQty(q1), cost: money(c1), name: m.name } });
    } else {
      await tx.vanStock.create({ data: { productId: m.productId, name: m.name, qty: roundQty(m.qty), cost: money(cost), funder } });
    }
    await tx.vanMove.create({ data: { ...base, qty: roundQty(m.qty), funder, cost: money(cost) } });
    return;
  }
  let left = Math.abs(m.qty);
  const rows = await tx.vanStock.findMany({ where: { productId: m.productId }, orderBy: [{ funder: 'asc' }] });
  for (const row of rows) {
    if (left <= 1e-9) break;
    const take = Math.min(left, Math.max(0, num(row.qty)));
    if (take <= 0) continue;
    await tx.vanStock.update({ where: { id: row.id }, data: { qty: roundQty(num(row.qty) - take) } });
    await tx.vanMove.create({ data: { ...base, qty: roundQty(-take), funder: row.funder, cost: row.cost } });
    left -= take;
  }
  if (left > 1e-9) {
    const row = rows[0] ?? (await tx.vanStock.create({ data: { productId: m.productId, name: m.name, qty: 0, cost: money(m.cost ?? 0), funder: '' } }));
    await tx.vanStock.update({ where: { id: row.id }, data: { qty: { decrement: roundQty(left) } } });
    await tx.vanMove.create({ data: { ...base, qty: roundQty(-left), funder: row.funder, cost: row.cost } });
  }
}

/** How much of a product is on the van. */
export async function vanQty(db: PrismaClient | Prisma.TransactionClient, productId: string) {
  const a = await db.vanStock.aggregate({ where: { productId }, _sum: { qty: true } });
  return num(a._sum.qty);
}

export class VanService {
  constructor(private readonly prisma: PrismaClient) {}

  async state(): Promise<VanState> {
    const t = todayYmd();
    const [stock, mk, hy, today, lastDay] = await Promise.all([
      this.prisma.vanStock.findMany({ where: { qty: { not: 0 } }, orderBy: { name: 'asc' } }),
      this.prisma.product.findMany({ where: { company: 'MK', deletedAt: null }, select: { qty: true, cost: true } }),
      this.prisma.product.findMany({ where: { company: 'HY', deletedAt: null }, select: { qty: true, cost: true } }),
      this.prisma.vanMove.findMany({ where: { kind: 'load', date: dayToDate(t) }, orderBy: { createdAt: 'asc' } }),
      this.prisma.vanMove.findFirst({ where: { kind: 'load', date: { lt: dayToDate(t) } }, orderBy: { date: 'desc' }, select: { date: true } }),
    ]);
    const last = lastDay ? await this.prisma.vanMove.findMany({ where: { kind: 'load', date: lastDay.date } }) : [];
    const val = (a: { qty: Prisma.Decimal; cost: Prisma.Decimal }[]) => r2(a.reduce((s, p) => s + num(p.qty) * num(p.cost), 0));
    const qsum = (a: { qty: Prisma.Decimal }[]) => r3(a.reduce((s, p) => s + num(p.qty), 0));
    return {
      stock: stock.map((s) => ({ productId: s.productId, name: s.name, qty: num(s.qty), cost: num(s.cost), funder: s.funder })),
      loadsToday: today.map((m) => ({ name: m.name, qty: num(m.qty), src: m.src, funder: m.funder, ref: m.ref })),
      lastLoad: lastDay
        ? { date: dateToDay(lastDay.date), lines: last.map((m) => ({ productId: m.productId, name: m.name, qty: num(m.qty), src: m.src, funder: m.funder, cost: num(m.cost) })) }
        : null,
      totals: { mkQty: qsum(mk), mkValue: val(mk), hyQty: qsum(hy), hyValue: val(hy), vanQty: qsum(stock), vanValue: val(stock) },
    };
  }

  /** «✔ تأكيد التحميل»: from Mekanizm's stock is an inter-company transfer first; Hydrolek's own goods just move onto the van. */
  async load(input: { vehicleId: string; lines: { productId: string; qty: number; src: string; price: number }[] }, actor: Actor) {
    const by = await actorName(this.prisma, actor);
    return withTx(this.prisma, async (tx) => {
      const partners = await tx.partner.findMany();
      const tr: typeof input.lines = [];
      const own: { productId: string; qty: number; funder: string; src: string }[] = [];
      const need = new Map<string, number>();
      for (const l of input.lines) {
        const p = await tx.product.findUnique({ where: { id: l.productId } });
        if (!p || p.deletedAt) throw badRequest('الصنف اتمسح');
        if (l.src === 'mk') {
          const mkId = p.company === 'MK' ? p.id : (await tx.product.findFirst({ where: { company: 'MK', name: p.name.trim(), deletedAt: null } }))?.id;
          if (!mkId) throw badRequest(`«${p.name}» مش موجود في مخزن ميكانيزم`);
          tr.push({ ...l, productId: mkId, price: l.price || num(p.cost) });
          continue;
        }
        const h = p.company === 'HY' ? p : await tx.product.findFirst({ where: { company: 'HY', name: p.name.trim(), deletedAt: null } });
        if (!h) throw badRequest(`«${p.name}» مش موجود في بضاعة هيدرولك — اختار «من بضاعة ميكانيزم»`);
        need.set(h.id, (need.get(h.id) ?? 0) + l.qty);
        const free = num(h.qty) - (await vanQty(tx, h.id));
        if ((need.get(h.id) ?? 0) > free + 1e-9) throw badRequest(`بضاعة هيدرولك اللي في المخزن من «${h.name}» ${r3(Math.max(0, free))} بس`);
        const pt = l.src.startsWith('p:') ? partners.find((x) => x.id === l.src.slice(2)) : undefined;
        own.push({ productId: h.id, qty: l.qty, funder: pt?.name ?? '', src: pt ? 'partner' : 'hy' });
      }
      if (tr.length) {
        const R = await icTransferInTx(tx, { seller: 'MK', lines: tr.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })), paid: 0, note: 'تحميل العربية', force: true }, actor);
        for (let i = 0; i < tr.length; i++) {
          const b = await tx.product.findUniqueOrThrow({ where: { id: R.buyerProducts[i]! } });
          await vanMoveInTx(tx, { kind: 'load', productId: b.id, name: b.name, qty: tr[i]!.qty, src: 'mk', cost: tr[i]!.price, ref: R.sale.no, vehicleId: input.vehicleId, byName: by });
        }
      }
      for (const x of own) {
        const h = await tx.product.findUniqueOrThrow({ where: { id: x.productId } });
        await vanMoveInTx(tx, { kind: 'load', productId: h.id, name: h.name, qty: x.qty, src: x.src, funder: x.funder, cost: num(h.cost), vehicleId: input.vehicleId, byName: by });
      }
      await writeAudit(tx, { userId: actor.id, action: 'VAN_MOVE', entity: 'Van', entityId: input.vehicleId || 'van', after: { load: input.lines.length }, ip: actor.ip });
      return { ok: true };
    });
  }

  /** The old clsCalc(): what should be left of each product at the end of the day, and the money. */
  async closeView(date: string, vehicleId: string): Promise<CloseDto> {
    const [stock, day, after, rec, hist] = await Promise.all([
      this.prisma.vanStock.findMany(),
      this.prisma.vanMove.findMany({ where: { date: dayToDate(date) } }),
      this.prisma.vanMove.findMany({ where: { date: { gt: dayToDate(date) } } }),
      this.prisma.vanClose.findUnique({ where: { date_vehicleId: { date: dayToDate(date), vehicleId } } }),
      this.prisma.vanClose.findMany({ where: { closed: true }, orderBy: { date: 'desc' }, take: 15 }),
    ]);
    const ids = new Set([...stock.map((s) => s.productId), ...day.map((m) => m.productId)]);
    const products = await this.prisma.product.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, cost: true } });
    const rows: CloseRow[] = [];
    for (const pid of ids) {
      const p = products.find((x) => x.id === pid);
      const now = stock.filter((s) => s.productId === pid).reduce((a, s) => a + num(s.qty), 0);
      const ex = r3(now - after.filter((m) => m.productId === pid).reduce((a, m) => a + num(m.qty), 0));
      const dm = day.filter((m) => m.productId === pid);
      const k = (t: string) => dm.filter((m) => m.kind === t).reduce((a, m) => a + num(m.qty), 0);
      const ld = r3(k('load'));
      const sd = r3(-k('sale'));
      const rt = r3(k('return'));
      const ot = r3(k('adjust') + k('unload'));
      if (Math.abs(ex) < 1e-9 && !ld && !sd && !ot) continue;
      const cost = num(stock.find((s) => s.productId === pid)?.cost) || num(p?.cost);
      rows.push({ pid, n: p?.name ?? dm[0]?.name ?? '؟', op: r3(ex - (ld - sd + rt + ot)), ld, sd, rt, ot, ex, cost });
    }
    rows.sort((a, b) => a.n.localeCompare(b.n, 'ar'));
    const refs = [...new Set(day.filter((m) => m.kind === 'sale' && m.ref).map((m) => m.ref))];
    const sales = await this.prisma.invoice.findMany({
      where: { kind: 'SALE', status: 'ACTIVE', company: 'HY', OR: [{ no: { in: refs } }, { date: dayToDate(date), note: { contains: 'المندوب:' } }] },
      select: { no: true, total: true, shipping: true, paid: true, remaining: true },
    });
    const col = await this.prisma.payment.aggregate({ where: { date: dayToDate(date), cancelledAt: null, note: { startsWith: 'تحصيل المندوب' } }, _sum: { amount: true } });
    const exp = await this.prisma.vehicleLog.aggregate({ where: { date: dayToDate(date), ...(vehicleId ? { vehicleId } : {}) }, _sum: { amount: true } });
    const cash = r2(sales.reduce((a, s) => a + num(s.paid), 0));
    const collections = num(col._sum.amount);
    const expenses = num(exp._sum.amount);
    return {
      date,
      vehicleId,
      record: rec
        ? {
            id: rec.id,
            closed: rec.closed,
            cash: num(rec.cash),
            credit: num(rec.credit),
            expenses: num(rec.expenses),
            expectedCash: num(rec.expectedCash),
            handed: num(rec.handed),
            diffValue: num(rec.diffValue),
            note: rec.note,
            data: rec.data as NonNullable<CloseDto['record']>['data'],
            byName: rec.byName,
            closedAt: rec.closedAt?.toISOString() ?? null,
            reopenedBy: rec.reopenedBy,
          }
        : null,
      rows,
      sales: r2(sales.reduce((a, s) => a + num(s.total) - num(s.shipping), 0)),
      cash,
      credit: r2(sales.reduce((a, s) => a + num(s.remaining), 0)),
      collections,
      expenses,
      expected: r2(cash + collections - expenses),
      invoices: new Set(sales.map((s) => s.no)).size,
      history: hist.map((h) => ({ date: dateToDay(h.date), cash: num(h.cash), ok: Math.abs(num(h.handed) - num(h.expectedCash)) <= 0.5 })),
    };
  }

  /** «🔒 قفل التصفية»: differences adjust the van and the product's stock; ticked items go back to the store. */
  async close(input: { date: string; vehicleId: string; handed: number | null; note: string; items: { pid: string; cnt: number; why: string; back: boolean }[] }, actor: Actor) {
    const v = await this.closeView(input.date, input.vehicleId);
    if (v.record?.closed) throw badRequest('التصفية دي اتقفلت خلاص');
    const by = await actorName(this.prisma, actor);
    const items = v.rows.map((r) => {
      const x = input.items.find((i) => i.pid === r.pid);
      return { pid: r.pid, n: r.n, ex: r.ex, cnt: x ? x.cnt : r.ex, why: (x?.why ?? '').trim(), back: !!x?.back, cost: r.cost, ld: r.ld, sd: r.sd };
    });
    const bad = items.find((x) => Math.abs(x.cnt - x.ex) > 1e-9 && !x.why);
    if (bad) throw badRequest(`اكتب سبب الفرق في «${bad.n}»`);
    const handed = input.handed ?? v.expected;
    const dv = r2(items.reduce((a, x) => a + (x.cnt - x.ex) * x.cost, 0));
    return withTx(this.prisma, async (tx) => {
      for (const x of items) {
        const d = r3(x.cnt - x.ex);
        if (d) {
          await vanMoveInTx(tx, { kind: 'adjust', productId: x.pid, name: x.n, qty: d, note: x.why, vehicleId: input.vehicleId, date: input.date, byName: by });
          await moveStock(tx, { productId: x.pid, change: d, reason: 'VAN_CLOSE', refType: 'VanClose', refId: input.date, note: `تصفية العربية ${input.date} — ${d < 0 ? 'عجز' : 'زيادة'}: ${x.why}`, userId: actor.id });
        }
        if (x.back && x.cnt > 0) await vanMoveInTx(tx, { kind: 'unload', productId: x.pid, name: x.n, qty: x.cnt, note: 'رجع المخزن', vehicleId: input.vehicleId, date: input.date, byName: by });
      }
      const data = {
        closed: true,
        cash: money(v.cash + v.collections),
        credit: money(v.credit),
        expenses: money(v.expenses),
        expectedCash: money(v.expected),
        handed: money(handed),
        diffValue: money(dv),
        note: input.note,
        data: { items, sales: v.sales, cash: v.cash, col: v.collections, credit: v.credit, exp: v.expenses } as unknown as Prisma.InputJsonValue,
        byName: by,
        closedAt: new Date(),
      };
      const row = await tx.vanClose.upsert({
        where: { date_vehicleId: { date: dayToDate(input.date), vehicleId: input.vehicleId } },
        create: { date: dayToDate(input.date), vehicleId: input.vehicleId, ...data },
        update: data,
      });
      await writeAudit(tx, { userId: actor.id, action: 'VAN_CLOSE', entity: 'VanClose', entityId: row.id, after: { date: input.date, handed, expected: v.expected, dv }, ip: actor.ip });
      return { id: row.id };
    });
  }

  async reopen(date: string, vehicleId: string, actor: Actor) {
    const rec = await this.prisma.vanClose.findUnique({ where: { date_vehicleId: { date: dayToDate(date), vehicleId } } });
    if (!rec) throw notFound();
    const by = await actorName(this.prisma, actor);
    await this.prisma.vanClose.update({ where: { id: rec.id }, data: { closed: false, reopenedBy: by, reopenedAt: new Date() } });
  }

}
