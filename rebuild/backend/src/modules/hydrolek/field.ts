import type { FieldOrder, Prisma, PrismaClient } from '@prisma/client';
import type { FieldLine, FieldOrderDto, FieldOrderInput, LineState } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { withTx } from '../../lib/tx.js';
import { createInvoiceInTx } from '../invoices/service.js';
import { icTransferInTx } from './ic.js';
import { vanMoveInTx, vanQty } from './van.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

export const toFieldDto = (o: FieldOrder): FieldOrderDto => ({
  id: o.id,
  no: o.no,
  company: o.company,
  date: dateToDay(o.date),
  customer: o.customer,
  phone: o.phone,
  addr: o.addr,
  eta: o.eta,
  total: num(o.total),
  note: o.note,
  rep: o.rep,
  lines: (o.lines as unknown as FieldLine[]) ?? [],
  status: o.status as FieldOrderDto['status'],
  sentAt: o.sentAt?.toISOString() ?? null,
  invoiceNo: o.invoiceNo,
  createdAt: o.createdAt.toISOString(),
});

/** HO-yyMMdd-hhmm-NN, as the old fqNo(), in Cairo time. */
function orderNo(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `HO-${p.year}${p.month}${p.day}-${p.hour}${p.minute}-${Math.floor(Math.random() * 90 + 10)}`;
}

export class FieldService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Each requested line also carries `ms`: what Mekanizm's store (plus Hydrolek's goods off the van) has of it now. */
  async list(): Promise<FieldOrderDto[]> {
    const rows = (await this.prisma.fieldOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })).map(toFieldDto);
    const pids = [...new Set(rows.flatMap((o) => o.lines.filter((l) => l.pid && l.r > 0).map((l) => l.pid)))];
    if (!pids.length) return rows;
    const own = await this.prisma.product.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, company: true, qty: true } });
    const names = [...new Set(own.map((p) => p.name.trim()))];
    const twins = await this.prisma.product.findMany({ where: { name: { in: names }, deletedAt: null }, select: { id: true, name: true, company: true, qty: true } });
    const van = await this.prisma.vanStock.groupBy({ by: ['productId'], _sum: { qty: true } });
    const onVan = new Map(van.map((v) => [v.productId, num(v._sum.qty)]));
    const ms = new Map<string, number>();
    for (const p of own) {
      const same = twins.filter((t) => t.name.trim() === p.name.trim());
      const mk = same.find((t) => t.company === 'MK');
      const hy = same.find((t) => t.company === 'HY');
      ms.set(p.id, r2((mk ? num(mk.qty) : 0) + (hy ? Math.max(0, num(hy.qty) - (onVan.get(hy.id) ?? 0)) : 0)));
    }
    for (const o of rows) for (const l of o.lines) if (l.pid && ms.has(l.pid)) l.ms = ms.get(l.pid);
    return rows;
  }

  private async get(tx: Prisma.TransactionClient, id: string) {
    const o = await tx.fieldOrder.findUnique({ where: { id } });
    if (!o) throw notFound('الأوردر ده مش موجود');
    return o;
  }

  /**
   * «📤 ابعت للمخزن»: the part on the van is sold now (Hydrolek invoice + van sale), the rest is
   * requested from Mekanizm, and new items go to «مطلوب ومش عندنا».
   */
  async create(input: FieldOrderInput, actor: Actor): Promise<FieldOrderDto> {
    const rep = await actorName(this.prisma, actor);
    const o = await withTx(this.prisma, async (tx) => {
      const vanOn = (await tx.vanStock.count()) > 0;
      const reserved = new Map<string, number>();
      const lines: FieldLine[] = [];
      for (const l of input.lines) {
        const p = l.productId && !l.nw ? await tx.product.findUnique({ where: { id: l.productId } }) : null;
        const wh: FieldLine['wh'] = p ? p.company : '';
        let s = 0;
        if (p && p.company === 'HY') {
          const have = vanOn ? await vanQty(tx, p.id) : num(p.qty);
          s = Math.max(0, Math.min(l.qty, have - (reserved.get(p.id) ?? 0)));
          reserved.set(p.id, (reserved.get(p.id) ?? 0) + s);
        }
        lines.push({
          pid: p?.id ?? '',
          n: p?.name ?? l.name,
          q: l.qty,
          pr: l.price,
          wh,
          ...(l.nw || !p ? { nw: true, d: l.d, img: l.img } : {}),
          pri: l.pri,
          st: l.nw || !p ? 'short' : 'new',
          s,
          r: r2(l.qty - s),
        });
      }
      const hasR = lines.some((l) => l.r > 0);
      const now = new Date();
      const total = r2(lines.reduce((a, l) => a + l.q * l.pr, 0));
      const no = orderNo();
      let invoiceNo = '';
      const sold = lines.filter((l) => l.s > 0 && l.wh === 'HY' && !l.nw);
      if (sold.length) {
        const tot = r2(sold.reduce((a, l) => a + l.s * l.pr, 0));
        const paid = input.pay === 'cash' ? tot : input.pay === 'part' ? Math.min(input.paid, tot) : 0;
        const invId = await createInvoiceInTx(
          tx,
          {
            kind: 'SALE',
            company: 'HY',
            date: todayYmd(),
            person: input.customer,
            phone: input.phone,
            address: '',
            note: `أوردر ميداني ${no} — المندوب: ${rep}`,
            shipping: 0,
            discount: 0,
            paid,
            payMethod: 'CASH',
            items: sold.map((l) => ({ productId: l.pid, name: l.n, qty: l.s, price: l.pr })),
          },
          actor,
        );
        invoiceNo = (await tx.invoice.findUniqueOrThrow({ where: { id: invId }, select: { no: true } })).no;
        if (vanOn) for (const l of sold) await vanMoveInTx(tx, { kind: 'sale', productId: l.pid, name: l.n, qty: l.s, ref: invoiceNo, note: `أوردر ميداني ${no}`, vehicleId: input.vehicleId, byName: rep });
        for (const l of sold) l.sd = true;
      }
      for (const l of lines.filter((x) => x.nw)) {
        await tx.wantedItem.create({
          data: {
            descr: `${l.n}${l.d ? ` — ${l.d}` : ''} × ${l.q} (العميل: ${input.customer} — أوردر ${no})`,
            source: 'الميدان',
            byName: rep,
            ...(l.img ? { thumb: l.img } : {}),
            phone: input.phone,
          },
        });
      }
      const row = await tx.fieldOrder.create({
        data: {
          no,
          company: 'HY',
          date: dayToDate(todayYmd()),
          customer: input.customer,
          phone: input.phone,
          addr: input.addr,
          eta: input.eta,
          items: lines.map((l) => `${l.n} × ${l.q}${l.nw ? ' (صنف جديد)' : ''}`).join('\n'),
          total: money(total),
          note: input.note,
          rep,
          lines: lines as unknown as Prisma.InputJsonValue,
          status: hasR ? 'new' : 'done',
          sentAt: hasR ? now : null,
          ...(hasR ? {} : { doneBy: rep, wh: 'HY', doneAt: now }),
          invoiceNo,
          vehicleId: input.vehicleId,
        },
      });
      await writeAudit(tx, { userId: actor.id, action: 'FIELD_ORDER', entity: 'FieldOrder', entityId: row.id, after: { no, customer: input.customer, invoice: invoiceNo }, ip: actor.ip });
      return row;
    });
    return toFieldDto(o);
  }

  /** One requested line moves on (the old lineSet); the order's status follows its lines. */
  async setLine(id: string, idx: number, st: LineState, extra: { dm?: string; dd?: string }, actor: Actor): Promise<FieldOrderDto> {
    const by = await actorName(this.prisma, actor);
    const o = await withTx(this.prisma, async (tx) => {
      const o = await this.get(tx, id);
      const L = ((o.lines as unknown as FieldLine[]) ?? []).map((l) => ({ ...l }));
      const l = L[idx];
      if (!l) throw badRequest('البند ده مش موجود');
      l.h = [...(l.h ?? []), { st, by, at: new Date().toISOString() }].slice(-12);
      l.st = st;
      if (extra.dm) l.dm = extra.dm;
      if (extra.dd) l.dd = extra.dd;
      const rl = L.filter((x) => x.r > 0 && x.st !== 'cancel');
      const all = rl.length > 0 && rl.every((x) => x.st === 'done');
      const any = rl.some((x) => x.st !== 'new');
      const data: Prisma.FieldOrderUpdateInput = { lines: L as unknown as Prisma.InputJsonValue, status: !rl.length ? 'cancel' : all ? 'done' : any ? 'doing' : 'new' };
      if (all) Object.assign(data, { doneBy: by, doneAt: new Date(), wh: 'MK' });
      const row = await tx.fieldOrder.update({ where: { id }, data });
      await writeAudit(tx, { userId: actor.id, action: 'FIELD_ORDER', entity: 'FieldOrder', entityId: id, after: { line: idx, st }, ip: actor.ip });
      return row;
    });
    return toFieldDto(o);
  }

  async reply(id: string, eta: string, note: string): Promise<FieldOrderDto> {
    return toFieldDto(await this.prisma.fieldOrder.update({ where: { id }, data: { eta, note } }));
  }

  /** «✖ إلغاء» the whole order (only while nothing was invoiced). */
  async cancel(id: string, actor: Actor): Promise<FieldOrderDto> {
    const by = await actorName(this.prisma, actor);
    const o = await withTx(this.prisma, async (tx) => {
      const o = await this.get(tx, id);
      if (o.invoiceNo) throw badRequest('الأوردر ده اتفوتر — الغي الفاتورة الأول');
      const L = ((o.lines as unknown as FieldLine[]) ?? []).map((l) =>
        l.r > 0 && l.st !== 'done' ? { ...l, st: 'cancel' as const, h: [...(l.h ?? []), { st: 'cancel' as const, by, at: new Date().toISOString() }] } : l,
      );
      return tx.fieldOrder.update({ where: { id }, data: { status: 'cancel', lines: L as unknown as Prisma.InputJsonValue } });
    });
    return toFieldDto(o);
  }

  /**
   * «🧾 فاتورة المسلَّم»: a Hydrolek invoice for the delivered lines; what comes from Mekanizm's
   * store is transferred between the companies at cost first.
   */
  async invoiceDelivered(id: string, paidIn: number, actor: Actor): Promise<FieldOrderDto> {
    const o = await withTx(this.prisma, async (tx) => {
      const o = await this.get(tx, id);
      const L = ((o.lines as unknown as FieldLine[]) ?? []).map((l) => ({ ...l }));
      const pick = L.map((l, i) => ({ l, i })).filter((x) => x.l.r > 0 && x.l.st === 'done' && !x.l.inv);
      if (!pick.length) throw badRequest('مفيش بنود مسلَّمة محتاجة فاتورة');
      const items: { productId: string; name: string; qty: number; price: number }[] = [];
      const tr: { mkId: string; name: string; q: number; cost: number; price: number }[] = [];
      for (const { l } of pick) {
        if (l.nw) throw badRequest(`«${l.n}» صنف جديد — سجّله في المنتجات الأول وبعدين افتح الأوردر`);
        const p = await tx.product.findUnique({ where: { id: l.pid } });
        if (!p) throw badRequest(`«${l.n}» مش لاقيه في الأصناف`);
        if (p.company === 'HY' && num(p.qty) - (await vanQty(tx, p.id)) >= l.r) {
          items.push({ productId: p.id, name: p.name, qty: l.r, price: l.pr });
          continue;
        }
        const m = p.company === 'MK' ? p : await tx.product.findFirst({ where: { company: 'MK', name: p.name.trim(), deletedAt: null } });
        if (!m) throw badRequest(`«${l.n}» مش متسجل في مخزن ميكانيزم`);
        tr.push({ mkId: m.id, name: m.name, q: l.r, cost: num(m.cost), price: l.pr });
      }
      if (tr.length) {
        const R = await icTransferInTx(tx, { seller: 'MK', lines: tr.map((x) => ({ productId: x.mkId, qty: x.q, price: x.cost })), paid: 0, note: `أوردر ميداني ${o.no}`, force: true }, actor);
        tr.forEach((x, k) => items.push({ productId: R.buyerProducts[k]!, name: x.name, qty: x.q, price: x.price }));
      }
      const tot = r2(items.reduce((a, x) => a + x.qty * x.price, 0));
      const invId = await createInvoiceInTx(
        tx,
        {
          kind: 'SALE',
          company: 'HY',
          date: todayYmd(),
          person: o.customer,
          phone: o.phone,
          address: o.addr,
          note: `أوردر ميداني ${o.no} — تسليم`,
          shipping: 0,
          discount: 0,
          paid: Math.min(Math.max(0, paidIn), tot),
          payMethod: 'CASH',
          items,
        },
        actor,
      );
      const no = (await tx.invoice.findUniqueOrThrow({ where: { id: invId }, select: { no: true } })).no;
      for (const x of pick) L[x.i]!.inv = no;
      return tx.fieldOrder.update({ where: { id }, data: { lines: L as unknown as Prisma.InputJsonValue, invoiceNo: [o.invoiceNo, no].filter(Boolean).join(' / ') } });
    });
    return toFieldDto(o);
  }
}
