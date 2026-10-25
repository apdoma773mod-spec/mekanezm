import type { Gift, PrismaClient } from '@prisma/client';
import type { GiftDto, GiftInput, GiftsSummary, GradeInput } from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num, qty as roundQty } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { moveStock } from '../../lib/stock.js';
import { withTx } from '../../lib/tx.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const ALTS_KEY = 'alts';

/** «🎁 هدايا الصنايعية» + «⚠️ الدرجة التانية» + «🔁 بدائل». */
export class GiftsService {
  constructor(private readonly prisma: PrismaClient) {}

  private dto(g: Gift, admin: boolean): GiftDto {
    return {
      id: g.id,
      productId: g.productId,
      productName: g.productName,
      qty: num(g.qty),
      price: num(g.price),
      ...(admin ? { cost: num(g.cost) } : {}),
      toName: g.toName,
      toPhone: g.toPhone,
      toKind: g.toKind,
      note: g.note,
      createdBy: g.createdBy,
      createdAt: g.createdAt.toISOString(),
    };
  }

  async gift(input: GiftInput, actor: Actor): Promise<GiftDto> {
    const by = await actorName(this.prisma, actor);
    const g = await withTx(this.prisma, async (tx) => {
      const p = await tx.product.findUnique({ where: { id: input.productId } });
      if (!p || p.deletedAt) throw notFound('الصنف ده مش موجود');
      const q = roundQty(input.qty);
      if (q.greaterThan(p.qty)) throw badRequest(`الرصيد ${num(p.qty)} بس`);
      const row = await tx.gift.create({
        data: {
          productId: p.id,
          productName: p.name,
          qty: q,
          price: p.price,
          cost: p.cost,
          toName: input.toName,
          toPhone: input.toPhone,
          toKind: input.toKind,
          note: input.note,
          createdById: actor.id,
          createdBy: by,
        },
      });
      await moveStock(tx, { productId: p.id, change: q.negated(), reason: 'GIFT', refType: 'Gift', refId: row.id, note: `هدية لـ ${input.toName}`, userId: actor.id });
      await writeAudit(tx, { userId: actor.id, action: 'GIFT_CREATE', entity: 'Gift', entityId: row.id, after: { product: p.name, qty: num(q), to: input.toName }, ip: actor.ip });
      return row;
    });
    return this.dto(g, isAdmin(actor));
  }

  /** «🎁 الهدايا»: who got gifts worth how much, and how much they bought from the shop. */
  async summary(actor: Actor): Promise<GiftsSummary> {
    const admin = isAdmin(actor);
    const rows = await this.prisma.gift.findMany({ orderBy: { createdAt: 'desc' } });
    const names = [...new Set(rows.map((g) => g.toName.trim()))];
    const bought = names.length
      ? await this.prisma.invoice.groupBy({ by: ['person'], where: { kind: 'SALE', status: 'ACTIVE', person: { in: names } }, _sum: { subtotal: true } })
      : [];
    const soldBy = new Map(bought.map((b) => [b.person.trim(), num(b._sum.subtotal)]));
    const by = new Map<string, GiftsSummary['people'][number]>();
    for (const g of rows) {
      const k = g.toName.trim();
      const o = by.get(k) ?? { name: k, kind: g.toKind, phone: g.toPhone, count: 0, value: 0, ...(admin ? { cost: 0 } : {}), bought: soldBy.get(k) ?? 0 };
      o.count++;
      o.value = r2(o.value + num(g.qty) * num(g.price));
      if (admin) o.cost = r2((o.cost ?? 0) + num(g.qty) * num(g.cost));
      by.set(k, o);
    }
    const people = [...by.values()].sort((a, b) => b.value - a.value);
    const m30 = Date.now() - 30 * 86_400_000;
    return {
      gifts: rows.slice(0, 60).map((g) => this.dto(g, admin)),
      people,
      total: r2(people.reduce((a, x) => a + x.value, 0)),
      ...(admin ? { totalCost: r2(people.reduce((a, x) => a + (x.cost ?? 0), 0)) } : {}),
      last30: r2(rows.filter((g) => g.createdAt.getTime() >= m30).reduce((a, g) => a + num(g.qty) * num(g.price), 0)),
    };
  }

  /** Scratched pieces move to «<name> (درجة تانية)» at the same cost and a lower price. */
  async grade(input: GradeInput, actor: Actor): Promise<{ productId: string; code: string; name: string }> {
    return withTx(this.prisma, async (tx) => {
      const p = await tx.product.findUnique({ where: { id: input.productId } });
      if (!p || p.deletedAt) throw notFound('الصنف ده مش موجود');
      const q = roundQty(input.qty);
      if (q.greaterThan(p.qty)) throw badRequest(`الرصيد ${num(p.qty)} بس`);
      const name = `${p.name} (درجة تانية)`;
      let t = await tx.product.findFirst({ where: { name, deletedAt: null } });
      if (!t) {
        const code = await nextNumber(tx, COUNTER.product);
        t = await tx.product.create({
          data: { code, name, category: p.category, unit: p.unit, price: money(input.price), cost: p.cost, qty: 0, minQty: 0, company: p.company, note: input.note },
        });
      } else if (!t.price.equals(money(input.price))) {
        t = await tx.product.update({ where: { id: t.id }, data: { price: money(input.price) } });
      }
      const note = `درجة تانية${input.note ? ` — ${input.note}` : ''}`;
      await moveStock(tx, { productId: p.id, change: q.negated(), reason: 'GRADE', refType: 'Product', refId: t.id, note, userId: actor.id });
      await moveStock(tx, { productId: t.id, change: q, reason: 'GRADE', refType: 'Product', refId: p.id, note, userId: actor.id });
      await writeAudit(tx, { userId: actor.id, action: 'GRADE_MOVE', entity: 'Product', entityId: p.id, after: { qty: num(q), to: t.code }, ip: actor.ip });
      return { productId: t.id, code: t.code, name: t.name };
    });
  }

  async alts(): Promise<Record<string, string[]>> {
    const s = await this.prisma.setting.findUnique({ where: { key: ALTS_KEY } });
    return (s?.value as Record<string, string[]> | undefined) ?? {};
  }

  /** Alternatives are shown both ways, as the old system saved them. */
  async setAlts(id: string, ids: string[], actor: Actor): Promise<string[]> {
    const map = await this.alts();
    const list = [...new Set(ids.filter((x) => x !== id))];
    map[id] = list;
    for (const o of list) map[o] = [...new Set([...(map[o] ?? []), id])];
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key: ALTS_KEY }, create: { key: ALTS_KEY, value: map, updatedById: actor.id }, update: { value: map, updatedById: actor.id } });
      await writeAudit(tx, { userId: actor.id, action: 'PRODUCT_ALTS', entity: 'Product', entityId: id, after: { alts: list.length }, ip: actor.ip });
    });
    return list;
  }
}
