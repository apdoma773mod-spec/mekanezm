import type { Kit, Prisma, PrismaClient } from '@prisma/client';
import type { KitDto, KitInput, KitSlot } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { COUNTER, nextNumber } from '../../lib/counters.js';
import { notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';

const toDto = (k: Kit): KitDto => ({
  id: k.id,
  code: k.code,
  barcode: k.barcode,
  name: k.name,
  param: k.param,
  def: num(k.def),
  sp: k.sp ? num(k.sp) : null,
  slots: k.slots as unknown as KitSlot[],
});

const data = (input: KitInput) => ({
  name: input.name,
  param: input.param,
  def: input.def,
  sp: input.sp === null ? null : money(input.sp),
  slots: input.slots as unknown as Prisma.InputJsonValue,
});

/** «🧩 الأطقم والتركيبات». Selling one is an ordinary sale invoice of its components. */
export class KitsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<KitDto[]> {
    return (await this.prisma.kit.findMany({ orderBy: { createdAt: 'asc' } })).map(toDto);
  }

  async byCode(code: string): Promise<KitDto | null> {
    const k = await this.prisma.kit.findFirst({ where: { OR: [{ code }, { barcode: code }] } });
    return k ? toDto(k) : null;
  }

  async save(id: string | null, input: KitInput, actor: Actor): Promise<KitDto> {
    const k = await withTx(this.prisma, async (tx) => {
      let row: Kit;
      if (id) {
        if (!(await tx.kit.findUnique({ where: { id } }))) throw notFound('الطقم ده مش موجود');
        row = await tx.kit.update({ where: { id }, data: data(input) });
      } else {
        // K0001 and barcode 290000000001, as the old kitCodes().
        const code = await nextNumber(tx, COUNTER.kit);
        row = await tx.kit.create({ data: { ...data(input), code, barcode: `29${code.slice(1).padStart(10, '0')}` } });
      }
      await writeAudit(tx, { userId: actor.id, action: 'KIT_SAVE', entity: 'Kit', entityId: row.id, after: { name: row.name, slots: input.slots.length }, ip: actor.ip });
      return row;
    });
    return toDto(k);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const k = await this.prisma.kit.findUnique({ where: { id } });
    if (!k) throw notFound('الطقم ده مش موجود');
    await withTx(this.prisma, async (tx) => {
      await tx.kit.delete({ where: { id } });
      await writeAudit(tx, { userId: actor.id, action: 'KIT_DELETE', entity: 'Kit', entityId: id, before: { name: k.name }, ip: actor.ip });
    });
  }
}
