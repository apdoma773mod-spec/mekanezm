import type { PrismaClient, Sample } from '@prisma/client';
import type { SampleDto, SampleInput, SamplesDto } from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { num, qty as roundQty } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';
import { createInvoiceInTx } from '../invoices/service.js';

const FLAG = 'samples_on';

const toDto = (s: Sample): SampleDto => ({
  id: s.id,
  productId: s.productId,
  productName: s.productName,
  qty: num(s.qty),
  customer: s.customer,
  date: dateToDay(s.date),
  givenBy: s.givenBy,
  status: s.status as SampleDto['status'],
  invoiceId: s.invoiceId,
  createdAt: s.createdAt.toISOString(),
});

/** «🧪 العينات»: optional, switched on and off by the owner from the samples screen. */
export class SamplesService {
  constructor(private readonly prisma: PrismaClient) {}

  async flag(): Promise<boolean> {
    const s = await this.prisma.setting.findUnique({ where: { key: FLAG } });
    return s?.value === true;
  }

  private async guard(actor: Actor) {
    if (!isAdmin(actor) && !(await this.flag())) throw forbidden('العينات مقفولة دلوقتي.');
  }

  async list(actor: Actor): Promise<SamplesDto> {
    const on = await this.flag();
    if (!on && !isAdmin(actor)) return { on, samples: [] };
    const rows = await this.prisma.sample.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return { on, samples: rows.map(toDto) };
  }

  async setFlag(on: boolean, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key: FLAG }, create: { key: FLAG, value: on, updatedById: actor.id }, update: { value: on, updatedById: actor.id } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: FLAG, after: { on }, ip: actor.ip });
    });
    return on;
  }

  async create(input: SampleInput, actor: Actor): Promise<SampleDto> {
    await this.guard(actor);
    const s = await withTx(this.prisma, async (tx) => {
      let productId: string | null = null;
      let productName = input.productName;
      const p = input.productId
        ? await tx.product.findUnique({ where: { id: input.productId } })
        : await tx.product.findFirst({ where: { name: input.productName, deletedAt: null } });
      if (p && !p.deletedAt) {
        productId = p.id;
        productName = p.name;
      }
      const row = await tx.sample.create({
        data: { productId, productName, qty: roundQty(input.qty), customer: input.customer, date: dayToDate(input.date ?? todayYmd()), givenBy: input.givenBy, createdById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SAMPLE_SAVE', entity: 'Sample', entityId: row.id, after: { product: productName, qty: input.qty, customer: input.customer }, ip: actor.ip });
      return row;
    });
    return toDto(s);
  }

  /** returned: nothing moves. sold: a sale invoice at price 0 takes it out of stock. lost: stock goes down as a loss. */
  async setStatus(id: string, status: 'returned' | 'sold' | 'lost', actor: Actor): Promise<SampleDto> {
    await this.guard(actor);
    const s = await withTx(this.prisma, async (tx) => {
      const o = await tx.sample.findUnique({ where: { id } });
      if (!o) throw notFound('العينة دي مش موجودة');
      if (o.status !== 'out') throw badRequest('العينة دي اتقفلت خلاص');
      let invoiceId: string | null = null;
      if (status === 'sold') {
        invoiceId = await createInvoiceInTx(
          tx,
          {
            kind: 'SALE',
            company: 'MK',
            date: todayYmd(),
            person: o.customer || 'عميل عينة',
            phone: '',
            address: '',
            note: 'تحويل عينة لبيع',
            shipping: 0,
            discount: 0,
            paid: 0,
            payMethod: 'CASH',
            items: [{ productId: o.productId ?? undefined, name: o.productName, qty: num(o.qty), price: 0 }],
          },
          actor,
          { noContact: !o.customer },
        );
      } else if (status === 'lost' && o.productId) {
        await moveStock(tx, { productId: o.productId, change: o.qty.negated(), reason: 'SAMPLE', refType: 'Sample', refId: o.id, note: `عينة خسارة${o.customer ? ` — ${o.customer}` : ''}`, userId: actor.id });
      }
      const row = await tx.sample.update({ where: { id }, data: { status, invoiceId, resolvedAt: new Date() } });
      await writeAudit(tx, { userId: actor.id, action: 'SAMPLE_SAVE', entity: 'Sample', entityId: id, after: { status }, ip: actor.ip });
      return row;
    });
    return toDto(s);
  }

  /** «🧪 عنده N عينة خارجة دلوقتي» in the customer's file. */
  async outFor(name: string): Promise<number> {
    if (!(await this.flag())) return 0;
    return this.prisma.sample.count({ where: { status: 'out', customer: name.trim() } });
  }
}
