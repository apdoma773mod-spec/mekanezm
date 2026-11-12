import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { paginationQuery, stockCountInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { withTx } from '../../lib/tx.js';
import { parse } from '../../lib/validate.js';
import { CountsService, qtyAtTimes, reconcile } from './service.js';
import { ZERO } from '../../lib/money.js';

/** جلسات الجرد (على أكتر من يوم) بتتحفظ في Setting count_sessions، وكل تعديل بيتطبّق على السيرفر عشان جهازين مايمسحوش شغل بعض. */
const KEY = 'count_sessions';
const item = z.object({ start: z.number(), cnt: z.string().max(20).nullable(), qAt: z.number().nullable(), at: z.string().optional() });
const session = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().max(120),
  cat: z.string().max(120),
  created: z.string().max(40),
  status: z.literal('open'),
  items: z.record(z.string().max(64), item).refine((o) => Object.keys(o).length <= 20000, 'جلسة كبيرة أوي'),
});
const op = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), session }),
  z.object({ op: z.literal('set'), sid: z.string().max(40), pid: z.string().max(64), cnt: z.string().max(20).nullable(), at: z.string().datetime({ offset: true }).optional() }),
  z.object({ op: z.literal('close'), sid: z.string().max(40), approved: z.string().max(40) }),
  z.object({ op: z.literal('delete'), sid: z.string().max(40) }),
]);
type SessItem = z.infer<typeof item>;
type Sess = z.infer<typeof session> | (Omit<z.infer<typeof session>, 'status'> & { status: 'open' | 'closed'; approved?: string });

export default async function countsRoutes(app: FastifyInstance) {
  const service = new CountsService(app.prisma);
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => {
    const { page, pageSize } = parse(paginationQuery, request.query);
    return service.list(page, pageSize);
  });

  app.post('/', async (request, reply) => {
    const count = await service.create(parse(stockCountInput, request.body), actorOf(request));
    return reply.status(201).send({ count });
  });

  /** معاينة الاعتماد: الرصيد الجديد لكل صنف (العدد + حركة بعد العد) من غير ما يتغير حاجة. */
  app.post('/preview', { bodyLimit: 4 * 1024 * 1024 }, async (request) => service.preview(parse(stockCountInput, request.body)));

  /** الأصناف اللي اتعدّت في الجلسة بشكل مفهوم للحساب: بوقت العد، أو (جلسات قديمة) برصيد وقت العد. */
  const sessionItems = (s: Sess) =>
    Object.entries(s.items as Record<string, SessItem>)
      .filter(([, it]) => it.cnt != null && it.cnt !== '' && Number.isFinite(Number(it.cnt)) && Number(it.cnt) >= 0)
      .map(([productId, it]) => ({ productId, counted: Number(it.cnt), ...(it.at ? { countedAt: new Date(it.at).toISOString() } : it.qAt != null ? { baseline: it.qAt } : {}) }));
  const findSession = async (tx: Prisma.TransactionClient, sid: string) => {
    const row = await tx.setting.findUnique({ where: { key: KEY } });
    const list = (Array.isArray(row?.value) ? row!.value : []) as unknown as Sess[];
    const s = list.find((x) => x.id === sid);
    if (!s) throw badRequest('الجلسة دي مش موجودة — حدّث الشاشة');
    return { list, s };
  };

  /** معاينة اعتماد جلسة: كل صنف اتعدّ، رصيده وقت العد والرصيد الجديد (من غير تغيير). */
  app.post('/session-preview', async (request) => {
    const { sid } = parse(z.object({ sid: z.string().max(40) }), request.body);
    const items = await withTx(db, async (tx) => {
      const { s } = await findSession(tx, sid);
      const its = sessionItems(s);
      const rows = await reconcile(tx, its);
      return { total: Object.keys(s.items).length, rows };
    });
    return {
      total: items.total,
      lines: items.rows.map((r) => ({ productId: r.productId, name: r.name, current: Number(r.current), before: Number(r.before), counted: Number(r.counted), diff: Number(r.diff), after: Number(r.after) })),
      negative: items.rows.filter((r) => r.after.lt(ZERO)).map((r) => ({ name: r.name, after: Number(r.after) })),
    };
  });

  /** اعتماد جلسة: الحساب والقفل في transaction واحدة — لو الطلب اتبعت مرتين التاني بيترفض ومفيش تعديل مرتين. */
  app.post('/session-approve', async (request) => {
    const { sid } = parse(z.object({ sid: z.string().max(40) }), request.body);
    const actor = actorOf(request);
    const out = await withTx(db, async (tx) => {
      const { list, s } = await findSession(tx, sid);
      if (s.status !== 'open') throw badRequest('الجلسة دي اتعتمدت قبل كده');
      const its = sessionItems(s);
      if (!its.length) throw badRequest('مفيش أصناف اتعدّت في الجلسة دي');
      const id = await service.createIn(tx, { items: its as never, note: `جلسة جرد: ${s.name}` }, actor);
      const next = list.map((x) => (x.id === sid ? { ...x, status: 'closed' as const, approved: new Date().toISOString() } : x));
      const value = next as unknown as Prisma.InputJsonValue;
      await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
      return { id, value: next };
    });
    const count = await db.stockCount.findUniqueOrThrow({ where: { id: out.id }, include: { createdBy: { select: { name: true } } } });
    return { count: { id: count.id, no: count.no, itemCount: count.itemCount, shortValue: Number(count.shortValue), excessValue: Number(count.excessValue) }, value: out.value };
  });

  /** تعديل واحد على جلسة جرد (إنشاء، عدّ صنف، قفل، مسح) — بيتطبّق على نسخة السيرفر الحالية ويرجّع الكل. */
  app.post('/session-op', { bodyLimit: 20 * 1024 * 1024 }, async (request) => {
    const o = parse(op, request.body);
    const actor = actorOf(request);
    const sessions = await withTx(db, async (tx) => {
      const row = await tx.setting.findUnique({ where: { key: KEY } });
      let list = (Array.isArray(row?.value) ? row!.value : []) as unknown as Sess[];
      if (o.op === 'create') {
        if (list.some((s) => s.id === o.session.id)) throw badRequest('الجلسة دي موجودة');
        list = [...list, o.session];
      } else {
        const s = list.find((x) => x.id === o.sid);
        if (!s) throw badRequest('الجلسة دي اتمسحت من جهاز تاني — حدّث الشاشة');
        if (o.op === 'delete') list = list.filter((x) => x.id !== o.sid);
        else if (o.op === 'close') {
          if (s.status !== 'open') throw badRequest('الجلسة دي اتقفلت قبل كده');
          list = list.map((x) => (x.id === o.sid ? { ...x, status: 'closed' as const, approved: o.approved } : x));
        } else {
          if (s.status !== 'open') throw badRequest('الجلسة دي اتقفلت — مينفعش تتعدّل');
          const cur = s.items[o.pid];
          if (!cur) throw badRequest('الصنف مش في الجلسة دي');
          let next: SessItem;
          if (o.cnt === null || o.cnt === '') next = { ...cur, cnt: null, qAt: null, at: undefined };
          else {
            // رصيد السيستم وقت العد بيتسجّل من السيرفر (للعرض على كل الأجهزة، وللشاشات القديمة)
            const at = o.at ?? new Date().toISOString();
            const p = await tx.product.findUnique({ where: { id: o.pid }, select: { qty: true } });
            const before = p ? (await qtyAtTimes(tx, [{ productId: o.pid, at: new Date(at) }])).get(o.pid) : undefined;
            next = { ...cur, cnt: o.cnt, at, qAt: p ? Number(p.qty.minus(before ?? ZERO)) : cur.qAt };
          }
          list = list.map((x) => (x.id === o.sid ? { ...x, items: { ...x.items, [o.pid]: next } } : x));
        }
      }
      const value = list as unknown as Prisma.InputJsonValue;
      await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
      if (o.op !== 'set') await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: `${KEY}:${o.op}`, ip: actor.ip });
      return list;
    });
    return { value: sessions };
  });
}
