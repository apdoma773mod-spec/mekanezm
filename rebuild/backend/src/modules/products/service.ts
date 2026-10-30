import { Prisma, type PrismaClient, type Product } from '@prisma/client';
import { alertStockAdjust } from '../../lib/alert-hooks.js';
import type {
  AdjustStockInput,
  ListProductsQuery,
  Paginated,
  ProductDto,
  ProductInput,
  StockMoveDto,
  UpdateProductInput,
} from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { D, money, num, qty as roundQty } from '../../lib/money.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';

export function toProductDto(p: Product, admin: boolean): ProductDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    unit: p.unit,
    price: num(p.price),
    ...(admin ? { cost: num(p.cost), costEst: p.costEst } : {}),
    qty: num(p.qty),
    minQty: num(p.minQty),
    company: p.company,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Audit snapshots always include cost; only admins can read the audit log. */
const snapshot = (p: Product) => toProductDto(p, true);

const emptyToNull = (v: string | undefined) => (v === undefined ? undefined : v === '' ? null : v);

async function liveProduct(tx: Prisma.TransactionClient, id: string): Promise<Product> {
  const p = await tx.product.findUnique({ where: { id } });
  if (!p || p.deletedAt) throw notFound('الصنف ده مش موجود');
  return p;
}

async function assertCodeFree(tx: Prisma.TransactionClient, code: string, exceptId?: string) {
  const used = await tx.product.findUnique({ where: { code }, select: { id: true, deletedAt: true } });
  if (used && used.id !== exceptId) {
    throw conflict(
      used.deletedAt ? 'الكود ده كان لصنف اتمسح، ومينفعش يتكرر' : 'الكود ده مستخدم لصنف تاني',
      [{ path: 'code', message: 'الكود مستخدم' }],
    );
  }
}

/** Generated codes skip any number someone already typed by hand. */
async function generateCode(tx: Prisma.TransactionClient): Promise<string> {
  for (;;) {
    const code = await nextNumber(tx, COUNTER.product);
    const taken = await tx.product.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
}

export class ProductsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListProductsQuery, actor: Actor): Promise<Paginated<ProductDto>> {
    let lowIds: string[] | undefined;
    if (query.stock === 'low') {
      // Prisma can't compare two columns, so the "at or under its own alert level" ids come from SQL.
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product" WHERE "deletedAt" IS NULL AND qty > 0 AND qty <= "minQty"`;
      lowIds = rows.map((r) => r.id);
    }
    // Like the old search: every typed word must appear in the name, code, barcode or category.
    const words = (query.q ?? '').trim().split(/\s+/).filter(Boolean);
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(lowIds ? { id: { in: lowIds } } : {}),
      ...(query.stock === 'out' ? { qty: { lte: 0 } } : {}),
      ...(words.length
        ? {
            AND: words.map((w) => ({
              OR: [
                { name: { contains: w, mode: 'insensitive' as const } },
                { code: { startsWith: w.toUpperCase() } },
                { barcode: w },
                { category: { contains: w, mode: 'insensitive' as const } },
              ],
            })),
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'code'
        ? { code: 'asc' }
        : query.sort === 'qty'
          ? { qty: 'asc' }
          : query.sort === 'updated'
            ? { updatedAt: 'desc' }
            : { name: 'asc' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    const admin = isAdmin(actor);
    return { items: rows.map((p) => toProductDto(p, admin)), total, page: query.page, pageSize: query.pageSize };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { deletedAt: null, category: { not: '' } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  /** Exact match on code or barcode, for scanners and typed codes. */
  async lookup(code: string, actor: Actor): Promise<ProductDto> {
    const p = await this.prisma.product.findFirst({
      where: { deletedAt: null, OR: [{ code: code.toUpperCase() }, { barcode: code }] },
    });
    if (!p) throw notFound('مفيش صنف بالكود ده');
    return toProductDto(p, isAdmin(actor));
  }

  async get(id: string, actor: Actor): Promise<ProductDto> {
    return toProductDto(await liveProduct(this.prisma, id), isAdmin(actor));
  }

  async create(input: ProductInput, actor: Actor): Promise<ProductDto> {
    const product = await withTx(this.prisma, async (tx) => {
      const code = input.code ? input.code : await generateCode(tx);
      if (input.code) await assertCodeFree(tx, code);
      const created = await tx.product.create({
        data: {
          code,
          name: input.name,
          barcode: emptyToNull(input.barcode) ?? null,
          category: input.category,
          unit: input.unit,
          price: input.price,
          cost: input.cost,
          minQty: input.minQty,
          company: input.company,
          note: input.note,
        },
      });
      if (input.qty !== 0) {
        await moveStock(tx, {
          productId: created.id,
          change: input.qty,
          reason: 'ADJUST',
          refType: 'Product',
          refId: created.id,
          note: 'رصيد أول المدة',
          userId: actor.id,
        });
      }
      const fresh = await tx.product.findUniqueOrThrow({ where: { id: created.id } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PRODUCT_CREATE',
        entity: 'Product',
        entityId: fresh.id,
        after: snapshot(fresh),
        ip: actor.ip,
      });
      return fresh;
    });
    return toProductDto(product, true);
  }

  async update(id: string, input: UpdateProductInput, actor: Actor): Promise<ProductDto> {
    const product = await withTx(this.prisma, async (tx) => {
      const before = await liveProduct(tx, id);
      if (input.code !== undefined && input.code !== before.code) {
        if (input.code === '') throw conflict('الكود مينفعش يبقى فاضي', [{ path: 'code', message: 'اكتب الكود' }]);
        await assertCodeFree(tx, input.code, id);
      }
      const { barcode, code, ...rest } = input;
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(rest.cost !== undefined && !D(rest.cost).equals(before.cost) ? { costEst: false } : {}),
          ...(code ? { code } : {}),
          ...(barcode !== undefined ? { barcode: emptyToNull(barcode) } : {}),
        },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PRODUCT_UPDATE',
        entity: 'Product',
        entityId: id,
        before: snapshot(before),
        after: snapshot(updated),
        ip: actor.ip,
      });
      return updated;
    });
    return toProductDto(product, true);
  }

  /**
   * 💲 تحديث أسعار جماعي (mk_bulk_price القديمة): زيادة أو نقص بنسبة % على سعر البيع أو الشراء أو الاتنين،
   * وتقريب لأقرب 1/5/10 جنيه. كله في transaction واحدة وكل صنف بيتسجل في سجل المراجعة.
   */
  async bulkPrice(input: { ids: string[]; field: 'price' | 'cost' | 'both'; pct: number; round: number }, actor: Actor): Promise<number> {
    const factor = 1 + input.pct / 100;
    if (factor <= 0) throw badRequest('النسبة دي هتخلي الأسعار صفر أو بالسالب');
    const calc = (v: Prisma.Decimal) => {
      const x = v.mul(factor);
      return input.round > 0 ? D(Math.round(x.toNumber() / input.round) * input.round) : money(x);
    };
    return withTx(this.prisma, async (tx) => {
      const rows = await tx.product.findMany({ where: { id: { in: input.ids }, deletedAt: null } });
      for (const p of rows) {
        const data: Prisma.ProductUpdateInput = {};
        if (input.field !== 'cost') data.price = calc(p.price);
        if (input.field !== 'price') data.cost = calc(p.cost);
        const updated = await tx.product.update({ where: { id: p.id }, data });
        await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_UPDATE', entity: 'Product', entityId: p.id, before: snapshot(p), after: snapshot(updated), ip: actor.ip });
      }
      return rows.length;
    });
  }

  /** «إعادة تصنيف الأصناف»: the settings screen sends the new category of each product it decided to move. */
  async recat(items: { id: string; category: string }[], actor: Actor): Promise<number> {
    return withTx(this.prisma, async (tx) => {
      const rows = await tx.product.findMany({ where: { id: { in: items.map((x) => x.id) }, deletedAt: null } });
      const to = new Map(items.map((x) => [x.id, x.category]));
      let n = 0;
      for (const p of rows) {
        const category = to.get(p.id)!;
        if (p.category === category) continue;
        const updated = await tx.product.update({ where: { id: p.id }, data: { category } });
        await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_UPDATE', entity: 'Product', entityId: p.id, before: snapshot(p), after: snapshot(updated), ip: actor.ip });
        n++;
      }
      return n;
    });
  }

  /** Every live product in one go (print lists, labels, bulk price, pickers) with the same filters as the screen. */
  async all(query: { q?: string; category?: string; company?: 'MK' | 'HY'; stock?: 'all' | 'low' | 'out' }, actor: Actor): Promise<ProductDto[]> {
    const admin = isAdmin(actor);
    const words = (query.q ?? '').trim().split(/\s+/).filter(Boolean);
    const rows = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(query.company ? { company: query.company } : {}),
        ...(query.stock === 'out' ? { qty: { lte: 0 } } : {}),
        AND: words.map((w) => ({
          OR: [
            { name: { contains: w, mode: 'insensitive' as const } },
            { code: { contains: w, mode: 'insensitive' as const } },
            { barcode: { contains: w, mode: 'insensitive' as const } },
            { category: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: { name: 'asc' },
    });
    const keep = query.stock === 'low' ? rows.filter((p) => p.qty.gt(0) && p.qty.lte(p.minQty)) : rows;
    return keep.map((p) => toProductDto(p, admin));
  }

  /** 💰 بضاعة قديمة: أصناف ليها سعر بيع ومن غير سعر شراء. */
  async zeroCost(): Promise<{ count: number; items: { code: string; name: string; price: number }[] }> {
    const rows = await this.prisma.product.findMany({ where: { deletedAt: null, cost: { lte: 0 }, price: { gt: 0 } }, orderBy: { name: 'asc' } });
    return { count: rows.length, items: rows.slice(0, 300).map((p) => ({ code: p.code, name: p.name, price: num(p.price) })) };
  }

  /** سعر الشراء = نسبة من سعر البيع، ويتعلّم «تقديري» لحد ما يتشترى بسعر حقيقي. */
  async estimateCosts(pct: number, actor: Actor): Promise<number> {
    const k = Math.min(99, Math.max(10, pct)) / 100;
    return withTx(this.prisma, async (tx) => {
      const rows = await tx.product.findMany({ where: { deletedAt: null, cost: { lte: 0 }, price: { gt: 0 } } });
      for (const p of rows) {
        const updated = await tx.product.update({ where: { id: p.id }, data: { cost: money(p.price.mul(k)), costEst: true } });
        await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_UPDATE', entity: 'Product', entityId: p.id, before: snapshot(p), after: snapshot(updated), ip: actor.ip });
      }
      return rows.length;
    });
  }

  /** ضيف بضاعة قديمة بسرعة: الاسم | الكمية | سعر البيع | سعر الشراء (اختياري). */
  async addOldGoods(
    input: { pct: number; category: string; unit: string; lines: { name: string; qty: number; price: number; cost?: number }[] },
    actor: Actor,
  ): Promise<{ added: number; estimated: number; skipped: string[] }> {
    const k = Math.min(99, Math.max(10, input.pct)) / 100;
    return withTx(this.prisma, async (tx) => {
      const names = new Set((await tx.product.findMany({ where: { deletedAt: null }, select: { name: true } })).map((p) => p.name));
      let added = 0;
      let estimated = 0;
      const skipped: string[] = [];
      for (const l of input.lines) {
        if (names.has(l.name)) {
          skipped.push(`${l.name} (موجود)`);
          continue;
        }
        const est = !(l.cost && l.cost > 0);
        const created = await tx.product.create({
          data: {
            code: await generateCode(tx),
            name: l.name,
            category: input.category,
            unit: input.unit,
            price: money(l.price),
            cost: money(est ? D(l.price).mul(k) : l.cost!),
            costEst: est,
          },
        });
        if (l.qty > 0) {
          await moveStock(tx, { productId: created.id, change: D(l.qty), reason: 'ADJUST', refType: 'Product', refId: created.id, note: 'رصيد أول المدة', userId: actor.id });
        }
        await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_CREATE', entity: 'Product', entityId: created.id, after: snapshot(await tx.product.findUniqueOrThrow({ where: { id: created.id } })), ip: actor.ip });
        names.add(l.name);
        added++;
        if (est) estimated++;
      }
      return { added, estimated, skipped };
    });
  }

  /** استيراد أصناف من ملف: بكمية صفر وحد أدنى 5، والمكرر بالاسم بيتخطى. */
  async importNames(input: { category: string; rows: { name: string; price: number; cost: number }[] }, actor: Actor): Promise<{ added: number; skipped: number }> {
    return withTx(this.prisma, async (tx) => {
      const names = new Set((await tx.product.findMany({ where: { deletedAt: null }, select: { name: true } })).map((p) => p.name));
      let added = 0;
      let skipped = 0;
      for (const r of input.rows) {
        if (names.has(r.name)) {
          skipped++;
          continue;
        }
        const created = await tx.product.create({
          data: { code: await generateCode(tx), name: r.name, category: input.category, price: money(r.price), cost: money(r.cost), minQty: 5 },
        });
        await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_CREATE', entity: 'Product', entityId: created.id, after: snapshot(created), ip: actor.ip });
        names.add(r.name);
        added++;
      }
      return { added, skipped };
    });
  }

  /** Soft delete: history keeps pointing at the product, and its code stays reserved. */
  async remove(id: string, actor: Actor): Promise<void> {
    await withTx(this.prisma, async (tx) => {
      const before = await liveProduct(tx, id);
      await tx.product.update({ where: { id }, data: { deletedAt: new Date(), barcode: null } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'PRODUCT_DELETE',
        entity: 'Product',
        entityId: id,
        before: snapshot(before),
        ip: actor.ip,
      });
    });
  }

  async adjust(id: string, input: AdjustStockInput, actor: Actor): Promise<ProductDto> {
    const product = await withTx(this.prisma, async (tx) => {
      const before = await liveProduct(tx, id);
      const change = roundQty(input.newQty).minus(before.qty);
      await moveStock(tx, {
        productId: id,
        change,
        reason: 'ADJUST',
        refType: 'Product',
        refId: id,
        note: input.note,
        userId: actor.id,
      });
      const after = await tx.product.findUniqueOrThrow({ where: { id } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'STOCK_ADJUST',
        entity: 'Product',
        entityId: id,
        before: { qty: num(before.qty) },
        after: { qty: num(after.qty), change: num(change), note: input.note },
        ip: actor.ip,
      });
      return { after, before };
    });
    await alertStockAdjust(this.prisma, product.after, num(product.before.qty), num(product.after.qty), input.note, actor);
    return toProductDto(product.after, true);
  }

  /**
   * 🔪 فك لفة / تقسيم صنف: بتخصم وحدات كبيرة من الصنف الكبير وتزوّد الصغير بالعدد المقابل،
   * وتكلفة الوحدة الصغيرة بتتوزع (متوسط مرجّح مع اللي كان موجود). كله في transaction واحدة.
   */
  async split(input: { sourceId: string; targetId: string; ratio: number; qty: number }, actor: Actor): Promise<{ source: ProductDto; target: ProductDto }> {
    if (input.sourceId === input.targetId) throw badRequest('اختار صنفين مختلفين');
    return withTx(this.prisma, async (tx) => {
      const s = await liveProduct(tx, input.sourceId);
      const t = await liveProduct(tx, input.targetId);
      const add = roundQty(D(input.ratio).mul(input.qty));
      const unitCost = s.cost.div(input.ratio);
      const newCost = money(t.qty.plus(add).isZero() ? t.cost : t.qty.mul(t.cost).plus(add.mul(unitCost)).div(t.qty.plus(add)));
      const note = `فك ${input.qty} ${s.unit} ← ${num(add)} ${t.name}`;
      await moveStock(tx, { productId: s.id, change: D(input.qty).neg(), reason: 'ADJUST', refType: 'Product', refId: s.id, note, userId: actor.id });
      await moveStock(tx, { productId: t.id, change: add, reason: 'ADJUST', refType: 'Product', refId: t.id, note: `من فك ${input.qty} ${s.name}`, userId: actor.id });
      await tx.product.update({ where: { id: t.id }, data: { cost: newCost } });
      await writeAudit(tx, { userId: actor.id, action: 'STOCK_ADJUST', entity: 'Product', entityId: s.id, after: { split: { to: t.id, ratio: input.ratio, qty: input.qty, added: num(add), cost: num(newCost) } }, ip: actor.ip });
      return {
        source: toProductDto(await tx.product.findUniqueOrThrow({ where: { id: s.id } }), true),
        target: toProductDto(await tx.product.findUniqueOrThrow({ where: { id: t.id } }), true),
      };
    });
  }

  async moves(id: string, page: number, pageSize: number): Promise<Paginated<StockMoveDto>> {
    const where = { productId: id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMove.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMove.count({ where }),
    ]);
    const invoiceIds = rows.filter((r) => r.refType === 'Invoice' && r.refId).map((r) => r.refId!);
    const returnIds = rows.filter((r) => r.refType === 'Return' && r.refId).map((r) => r.refId!);
    const [invoices, returns] = await Promise.all([
      invoiceIds.length
        ? this.prisma.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, no: true } })
        : [],
      returnIds.length
        ? this.prisma.return.findMany({ where: { id: { in: returnIds } }, select: { id: true, person: true } })
        : [],
    ]);
    const labels = new Map<string, string>([
      ...invoices.map((i) => [i.id, i.no] as [string, string]),
      ...returns.map((r) => [r.id, r.person ? `مرتجع ${r.person}` : 'مرتجع'] as [string, string]),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        qtyChange: num(m.qtyChange),
        qtyAfter: num(m.qtyAfter),
        reason: m.reason,
        refType: m.refType,
        refId: m.refId,
        refLabel: m.refId ? (labels.get(m.refId) ?? null) : null,
        note: m.note,
        user: m.user,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
