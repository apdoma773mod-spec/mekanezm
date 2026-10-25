import type { FastifyInstance } from 'fastify';
import { altsInput, giftInput, gradeInput, idParam } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { GiftsService } from './service.js';

export default async function giftsRoutes(app: FastifyInstance) {
  const service = new GiftsService(app.prisma);

  // Anyone at the counter can hand out a gift; grades and alternatives are admin buttons, as before.
  app.get('/gifts', { preHandler: app.authenticate }, async (request) => service.summary(actorOf(request)));

  app.post('/gifts', { preHandler: app.authenticate }, async (request, reply) => {
    const gift = await service.gift(parse(giftInput, request.body), actorOf(request));
    return reply.status(201).send({ gift });
  });

  app.post('/grade', { preHandler: app.requireAdmin }, async (request) => ({
    product: await service.grade(parse(gradeInput, request.body), actorOf(request)),
  }));

  app.get('/alts', { preHandler: app.authenticate }, async () => ({ alts: await service.alts() }));

  app.put('/alts/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { ids } = parse(altsInput, request.body);
    return { ids: await service.setAlts(id, ids, actorOf(request)) };
  });
}
