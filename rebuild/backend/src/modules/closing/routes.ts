import type { FastifyInstance } from 'fastify';
import { closingInput, daybookDayQuery, listClosingsQuery } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { ClosingService } from './service.js';

export default async function closingRoutes(app: FastifyInstance) {
  const service = new ClosingService(app.prisma);

  // Anyone at the counter can close the day (as before); the history is for admins.
  app.get('/summary', { preHandler: app.authenticate }, async (request) => {
    const { day } = parse(daybookDayQuery, request.query);
    return { summary: await service.summary(day ?? todayYmd(), actorOf(request)) };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const closing = await service.save(parse(closingInput, request.body), actorOf(request));
    return reply.status(201).send({ closing });
  });

  app.get('/', { preHandler: app.requireAdmin }, async (request) => {
    const { page, pageSize } = parse(listClosingsQuery, request.query);
    return service.list(page, pageSize);
  });
}
