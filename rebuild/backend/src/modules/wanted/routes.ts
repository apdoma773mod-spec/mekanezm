import type { FastifyInstance } from 'fastify';
import type { WantedDto } from '@mk/shared';
import { idParam, wantedInput } from '@mk/shared';
import type { WantedItem } from '@prisma/client';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { actorName } from '../../lib/names.js';
import { parse } from '../../lib/validate.js';

const toDto = (w: WantedItem): WantedDto => ({
  id: w.id,
  descr: w.descr,
  thumb: w.thumb,
  source: w.source,
  phone: w.phone,
  byName: w.byName,
  createdAt: w.createdAt.toISOString(),
});

/** «🔎 مطلوب ومش عندنا»: anyone can add; marking as available or deleting is the owner's. */
export default async function wantedRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.get('/', { preHandler: app.authenticate }, async () => ({
    items: (await db.wantedItem.findMany({ where: { done: false }, orderBy: { createdAt: 'desc' }, take: 300 })).map(toDto),
  }));

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(wantedInput, request.body);
    const actor = actorOf(request);
    const byName = await actorName(db, actor);
    const w = await db.$transaction(async (tx) => {
      const row = await tx.wantedItem.create({ data: { ...input, source: input.source || 'المحل', byName } });
      await writeAudit(tx, { userId: actor.id, action: 'WANTED_SAVE', entity: 'WantedItem', entityId: row.id, after: { descr: row.descr }, ip: actor.ip });
      return row;
    });
    return reply.status(201).send({ item: toDto(w) });
  });

  app.post('/:id/done', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (!(await db.wantedItem.findUnique({ where: { id } }))) throw notFound();
    await db.wantedItem.update({ where: { id }, data: { done: true } });
    return { ok: true };
  });

  app.delete('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const actor = actorOf(request);
    const w = await db.wantedItem.findUnique({ where: { id } });
    if (!w) throw notFound();
    await db.$transaction(async (tx) => {
      await tx.wantedItem.delete({ where: { id } });
      await writeAudit(tx, { userId: actor.id, action: 'WANTED_SAVE', entity: 'WantedItem', entityId: id, before: { descr: w.descr }, ip: actor.ip });
    });
    return { ok: true };
  });
}
