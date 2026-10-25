import type { FastifyInstance } from 'fastify';
import { listReturnsQuery, returnInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ReturnsService } from './service.js';

export default async function returnsRoutes(app: FastifyInstance) {
  const service = new ReturnsService(app.prisma);
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => service.list(parse(listReturnsQuery, request.query)));

  app.post('/', async (request, reply) => {
    const ret = await service.create(parse(returnInput, request.body), actorOf(request));
    return reply.status(201).send({ return: ret });
  });
}
