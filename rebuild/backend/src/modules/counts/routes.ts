import type { FastifyInstance } from 'fastify';
import { paginationQuery, stockCountInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { CountsService } from './service.js';

export default async function countsRoutes(app: FastifyInstance) {
  const service = new CountsService(app.prisma);
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => {
    const { page, pageSize } = parse(paginationQuery, request.query);
    return service.list(page, pageSize);
  });

  app.post('/', async (request, reply) => {
    const count = await service.create(parse(stockCountInput, request.body), actorOf(request));
    return reply.status(201).send({ count });
  });
}
