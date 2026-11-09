import { Prisma, type PrismaClient } from '@prisma/client';
import type { Paginated, StockCountDto, StockCountInput, StockCountLine } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { D, ZERO, money, num, qty as roundQty } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';

type CountWithUser = Prisma.StockCountGetPayload<{ include: { createdBy: { select: { name: true } } } }>;

function toDto(c: CountWithUser): StockCountDto {
  return {
    id: c.id,
    no: c.no,
    note: c.note,
    items: c.items as unknown as StockCountLine[],
    itemCount: c.itemCount,
    shortValue: num(c.shortValue),
    excessValue: num(c.excessValue),
    createdBy: c.createdBy?.name ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * 🧮 الجرد والبيع شغال: العدد بيتحسب على رصيد السيستم «وقت العد» مش وقت الحفظ.
 * رصيد وقت العد = الرصيد الحالي − (كل حركات المخزون اللي حصلت بعد وقت العد: بيع، شراء، مرتجع، جرد تاني).
 * الفرق = العدد − رصيد وقت العد، وبيتضاف على الرصيد الحالي، فالبيع اللي حصل بعد العد يفضل محسوب:
 * عدّيت ١٠٠ والرجالة باعوا ٣٠ بعدها → الرصيد ٧٠ (مش ١٠٠). الحساب كله جوه transaction واحدة على السيرفر.
 */
const MAX_BACK_MS = 400 * 24 * 3600e3;
export interface CountIn {
  productId: string;
  counted: number;
  countedAt?: string | undefined;
  baseline?: number | undefined;
}
export interface Reconciled {
  productId: string;
  code: string;
  name: string;
  cost: Prisma.Decimal;
  current: Prisma.Decimal;
  before: Prisma.Decimal;
  counted: Prisma.Decimal;
  diff: Prisma.Decimal;
  after: Prisma.Decimal;
}

/** رصيد كل صنف في وقت عدّه (استعلام واحد لكل الأصناف بدل استعلام لكل صنف). */
export async function qtyAtTimes(tx: Prisma.TransactionClient, items: { productId: string; at: Date }[]): Promise<Map<string, Prisma.Decimal>> {
  const out = new Map<string, Prisma.Decimal>();
  if (!items.length) return out;
  const rows = await tx.$queryRaw<{ id: string; moved: Prisma.Decimal | null }[]>(Prisma.sql`
    SELECT v.id, (SELECT COALESCE(SUM(m."qtyChange"), 0) FROM "StockMove" m WHERE m."productId" = v.id AND m."createdAt" > v.at) AS moved
    FROM (VALUES ${Prisma.join(items.map((i) => Prisma.sql`(${i.productId}::text, ${i.at}::timestamptz)`))}) AS v(id, at)`);
  for (const r of rows) out.set(r.id, D(r.moved ?? 0));
  return out;
}

export async function reconcile(tx: Prisma.TransactionClient, items: CountIn[], now = new Date()): Promise<Reconciled[]> {
  const seen = new Set<string>();
  const uniq = items.filter((i) => (seen.has(i.productId) ? false : (seen.add(i.productId), true)));
  const prods = await tx.product.findMany({ where: { id: { in: uniq.map((i) => i.productId) }, deletedAt: null } });
  const by = new Map(prods.map((p) => [p.id, p]));
  const timed = uniq
    .filter((i) => by.has(i.productId) && i.countedAt)
    .map((i) => ({ productId: i.productId, at: new Date(Math.min(Math.max(Date.parse(i.countedAt!), now.getTime() - MAX_BACK_MS), now.getTime())) }));
  const moved = await qtyAtTimes(tx, timed);
  const out: Reconciled[] = [];
  for (const it of uniq) {
    const p = by.get(it.productId);
    if (!p) continue;
    const counted = roundQty(it.counted);
    const before = it.countedAt ? roundQty(p.qty.minus(moved.get(p.id) ?? ZERO)) : it.baseline != null ? roundQty(it.baseline) : p.qty;
    const diff = counted.minus(before);
    out.push({ productId: p.id, code: p.code, name: p.name, cost: p.cost, current: p.qty, before, counted, diff, after: p.qty.plus(diff) });
  }
  return out;
}

export class CountsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * «✔ حفظ الجرد»: every counted product is set to what was on the shelf, and the shortage and
   * excess are valued at cost (the old mk_stock_count).
   */
  async create(input: StockCountInput, actor: Actor): Promise<StockCountDto> {
    const id = await withTx(this.prisma, (tx) => this.createIn(tx, input, actor));
    return toDto(await this.prisma.stockCount.findUniqueOrThrow({ where: { id }, include: { createdBy: { select: { name: true } } } }));
  }

  /** نفس «حفظ الجرد» جوه transaction جاهزة (عشان اعتماد الجلسة يقفلها في نفس الخطوة). */
  async createIn(tx: Prisma.TransactionClient, input: StockCountInput, actor: Actor): Promise<string> {
    {
      const n = (await tx.stockCount.count()) + 1;
      const no = `JR-${String(n).padStart(4, '0')}`;
      const lines: StockCountLine[] = [];
      let short = ZERO;
      let excess = ZERO;
      for (const r of await reconcile(tx, input.items)) {
        if (r.diff.isNegative()) short = short.plus(r.diff.negated().times(r.cost));
        else excess = excess.plus(r.diff.times(r.cost));
        lines.push({ productId: r.productId, code: r.code, name: r.name, before: num(r.before), counted: num(r.counted), diff: num(r.diff), cost: num(r.cost), after: num(r.after) });
        if (!r.diff.isZero()) {
          await moveStock(tx, { productId: r.productId, change: r.diff, reason: 'COUNT', refType: 'StockCount', refId: no, note: input.note || no, userId: actor.id });
        }
      }
      if (!lines.length) throw badRequest('اعدّ صنف واحد على الأقل');
      const c = await tx.stockCount.create({
        data: {
          no,
          note: input.note,
          items: lines as unknown as Prisma.InputJsonValue,
          itemCount: lines.length,
          shortValue: money(short),
          excessValue: money(excess),
          createdById: actor.id,
        },
      });
      await tx.stockMove.updateMany({ where: { refType: 'StockCount', refId: no }, data: { refId: c.id } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'STOCK_COUNT',
        entity: 'StockCount',
        entityId: c.id,
        after: { no, items: lines.length, short: num(money(short)), excess: num(money(excess)) },
        ip: actor.ip,
      });
      return c.id;
    }
  }

  /** معاينة قبل الاعتماد: نفس الحساب بالظبط من غير ما يتغير حاجة (الرصيد الجديد وأي صنف هيطلع بالسالب). */
  async preview(input: StockCountInput) {
    const rows = await withTx(this.prisma, (tx) => reconcile(tx, input.items));
    return {
      lines: rows.map((r) => ({ productId: r.productId, code: r.code, name: r.name, current: num(r.current), before: num(r.before), counted: num(r.counted), diff: num(r.diff), after: num(r.after) })),
      negative: rows.filter((r) => r.after.isNegative()).map((r) => ({ productId: r.productId, name: r.name, after: num(r.after) })),
    };
  }

  async list(page: number, pageSize: number): Promise<Paginated<StockCountDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockCount.findMany({
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockCount.count(),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }
}
