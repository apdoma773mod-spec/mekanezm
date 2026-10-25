import type { Prisma, PrismaClient, Shipment } from '@prisma/client';
import {
  SHIP_CLOSED,
  type ShipmentDto,
  type ShipmentInput,
  type ShipPaidInput,
  type ShipStatus,
  type UpdateShipmentInput,
} from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { withTx } from '../../lib/tx.js';
import { ExpensesService } from '../expenses/service.js';
import { PaymentsService } from '../payments/service.js';

type Log = ShipmentDto['log'];

function toDto(s: Shipment): ShipmentDto {
  return {
    id: s.id,
    no: s.no,
    kind: s.kind,
    status: s.status as ShipStatus,
    invoiceId: s.invoiceId,
    invoiceNo: s.invoiceNo,
    name: s.name,
    phone: s.phone,
    phone2: s.phone2,
    gov: s.gov,
    area: s.area,
    address: s.address,
    carrier: s.carrier,
    tracking: s.tracking,
    driver: s.driver,
    driverPhone: s.driverPhone,
    cod: num(s.cod),
    fee: num(s.fee),
    pieces: s.pieces,
    content: s.content,
    note: s.note,
    log: (s.log as unknown as Log) ?? [],
    closedAt: s.closedAt?.toISOString() ?? null,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
  };
}

const closed = (st: string) => (SHIP_CLOSED as string[]).includes(st);

/** «🚚 الشحن والتوصيل». */
export class ShippingService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: { tab: string; kind?: 'SHIP' | 'DELIVERY'; q?: string; invoiceId?: string }) {
    const where: Prisma.ShipmentWhereInput = {
      ...(q.invoiceId ? { invoiceId: q.invoiceId, status: { not: 'cancelled' } } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.invoiceId
        ? {}
        : q.tab === 'open'
          ? { status: { notIn: [...SHIP_CLOSED, 'delivered'] } }
          : q.tab === 'collect'
            ? { status: 'delivered' }
            : q.tab === 'done'
              ? { status: 'paid' }
              : q.tab === 'other'
                ? { status: { in: ['returned', 'cancelled'] } }
                : {}),
    };
    const words = (q.q ?? '').split(/\s+/).filter(Boolean);
    if (words.length) {
      where.AND = words.map((w) => ({
        OR: (['no', 'name', 'phone', 'invoiceNo', 'gov', 'area', 'tracking', 'carrier'] as const).map((f) => ({ [f]: { contains: w, mode: 'insensitive' } })),
      }));
    }
    const [rows, open] = await Promise.all([
      this.prisma.shipment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.prisma.shipment.findMany({ where: { status: { notIn: SHIP_CLOSED } }, select: { status: true, cod: true } }),
    ]);
    const moving = open.filter((s) => s.status === 'handed' || s.status === 'out');
    const wait = open.filter((s) => s.status === 'delivered');
    const codOf = (a: typeof open) => num(money(a.reduce((t, s) => t + num(s.cod), 0)));
    return {
      items: rows.map(toDto),
      summary: { open: open.length, moving: moving.length, movingCod: codOf(moving), waiting: wait.length, waitingCod: codOf(wait) },
    };
  }

  async get(id: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id } });
    if (!s) throw notFound('الشحنة دي مش موجودة');
    return s;
  }

  /** Links the parcel to a sale invoice by its number, when there is one. */
  private async invoiceOf(tx: Prisma.TransactionClient, no: string) {
    if (!no) return null;
    const inv = await tx.invoice.findFirst({ where: { kind: 'SALE', no: no.toUpperCase() }, select: { id: true, no: true } });
    if (!inv) throw badRequest(`مفيش فاتورة بيع رقمها ${no}`, [{ path: 'invoiceNo', message: 'مش موجودة' }]);
    return inv;
  }

  private check(i: Pick<ShipmentInput, 'kind' | 'gov' | 'address'>) {
    if (i.kind === 'SHIP' && !i.gov) throw badRequest('اختار المحافظة', [{ path: 'gov', message: 'مطلوب' }]);
    if (i.kind === 'SHIP' && !i.address) throw badRequest('اكتب العنوان', [{ path: 'address', message: 'مطلوب' }]);
  }

  async create(input: ShipmentInput, actor: Actor): Promise<ShipmentDto> {
    this.check(input);
    const by = await actorName(this.prisma, actor);
    const s = await withTx(this.prisma, async (tx) => {
      const inv = await this.invoiceOf(tx, input.invoiceNo);
      const no = await nextNumber(tx, COUNTER.shipment);
      const { status: _ignored, invoiceNo: _no, ...rest } = input;
      const row = await tx.shipment.create({
        data: {
          ...rest,
          no,
          status: 'new',
          invoiceId: inv?.id ?? null,
          invoiceNo: inv?.no ?? '',
          tracking: input.kind === 'SHIP' ? input.tracking : '',
          driver: input.kind === 'DELIVERY' ? input.driver : '',
          driverPhone: input.kind === 'DELIVERY' ? input.driverPhone : '',
          cod: money(input.cod),
          fee: money(input.fee),
          log: [{ s: 'new', at: new Date().toISOString(), by }],
          createdById: actor.id,
          createdBy: by,
        },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SHIP_SAVE', entity: 'Shipment', entityId: row.id, after: { no, name: row.name, cod: num(row.cod) }, ip: actor.ip });
      return row;
    });
    return toDto(s);
  }

  async update(id: string, input: UpdateShipmentInput, actor: Actor): Promise<ShipmentDto> {
    const before = await this.get(id);
    const by = await actorName(this.prisma, actor);
    const s = await withTx(this.prisma, async (tx) => {
      const kind = input.kind ?? before.kind;
      this.check({ kind, gov: input.gov ?? before.gov, address: input.address ?? before.address });
      const { invoiceNo, status, cod, fee, ...rest } = input;
      const data: Prisma.ShipmentUpdateInput = { ...rest };
      if (invoiceNo !== undefined) {
        const inv = await this.invoiceOf(tx, invoiceNo);
        data.invoiceId = inv?.id ?? null;
        data.invoiceNo = inv?.no ?? '';
      }
      if (cod !== undefined) data.cod = money(cod);
      if (fee !== undefined) data.fee = money(fee);
      if (status && status !== before.status) {
        data.status = status;
        data.log = [...((before.log as unknown as Log) ?? []), { s: status, at: new Date().toISOString(), by }];
        data.closedAt = closed(status) ? new Date() : null;
      }
      const row = await tx.shipment.update({ where: { id }, data });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'SHIP_SAVE',
        entity: 'Shipment',
        entityId: id,
        before: { status: before.status },
        after: { status: row.status, carrier: row.carrier, tracking: row.tracking },
        ip: actor.ip,
      });
      return row;
    });
    return toDto(s);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    if (!isAdmin(actor)) throw forbidden();
    const s = await this.get(id);
    await withTx(this.prisma, async (tx) => {
      await tx.shipment.delete({ where: { id } });
      await writeAudit(tx, { userId: actor.id, action: 'SHIP_DELETE', entity: 'Shipment', entityId: id, before: { no: s.no, name: s.name }, ip: actor.ip });
    });
  }

  /** «✔ اتحاسبنا»: closes the follow-up; payment on the customer's account and the fee as an expense are optional. */
  async paid(id: string, input: ShipPaidInput, actor: Actor): Promise<ShipmentDto> {
    const s = await this.get(id);
    if (closed(s.status)) throw badRequest('الشحنة دي اتقفلت خلاص');
    const admin = isAdmin(actor);
    const fee = admin ? input.fee : num(s.fee);
    if (input.recordPayment && input.amount > 0) {
      let contactId: string | null = null;
      if (s.invoiceId) contactId = (await this.prisma.invoice.findUnique({ where: { id: s.invoiceId }, select: { contactId: true } }))?.contactId ?? null;
      if (!contactId) contactId = (await this.prisma.contact.findFirst({ where: { type: 'CUSTOMER', name: s.name, deletedAt: null }, select: { id: true } }))?.id ?? null;
      if (!contactId) throw badRequest('العميل مش متسجل في العملاء — الدفعة مش هتتسجل على حساب.');
      await new PaymentsService(this.prisma).create(
        { contactId, amount: input.amount, method: 'CASH', company: 'MK', note: `تحصيل شحنة ${s.no}${s.invoiceNo ? ` — فاتورة ${s.invoiceNo}` : ''}` },
        actor,
      );
    }
    if (admin && input.recordExpense && fee > 0) {
      await new ExpensesService(this.prisma).create({ category: 'شحن', amount: fee, method: 'CASH', company: 'MK', note: `مصاريف شحن ${s.no} — ${s.name}` }, actor);
    }
    return this.update(id, { status: 'paid', fee }, actor);
  }
}
