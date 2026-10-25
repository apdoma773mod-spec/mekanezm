import { Prisma, type PrismaClient, type Product } from '@prisma/client';
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
import { conflict, notFound } from '../../lib/errors.js';
import { num, qty as roundQty } from '../../lib/money.js';
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
    ...(admin ? { cost: num(p.cost) } : {}),
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
    if (query.lowStock) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product" WHERE "deletedAt" IS NULL AND qty <= "minQty"`;
      lowIds = rows.map((r) => r.id);
    }
    const q = query.q?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(lowIds ? { id: { in: lowIds } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { startsWith: q.toUpperCase() } },
              { barcode: q },
              { category: { contains: q, mode: 'insensitive' } },
            ],
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
      return after;
    });
    return toProductDto(product, true);
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
