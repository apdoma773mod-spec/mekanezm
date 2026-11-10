import type { FastifyInstance } from 'fastify';
import { isoDateSchema, listReturnsQuery, returnInput } from '@mk/shared';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ReturnsService } from './service.js';

export default async function returnsRoutes(app: FastifyInstance) {
  const service = new ReturnsService(app.prisma);
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => service.list(parse(listReturnsQuery, request.query)));

  app.post('/', async (request, reply) => {
    // «date»: the day the goods came back, when it is entered later (the daily Excel import) — today when left out
    const { date } = parse(z.object({ date: isoDateSchema.optional() }), request.body ?? {});
    const ret = await service.create(parse(returnInput, request.body), actorOf(request), date);
    return reply.status(201).send({ return: ret });
  });
}
