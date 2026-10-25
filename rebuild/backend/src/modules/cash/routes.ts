import type { FastifyInstance } from 'fastify';
import { cashQuery } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { CashService } from './service.js';

export default async function cashRoutes(app: FastifyInstance) {
  const service = new CashService(app.prisma);

  app.get('/summary', { preHandler: app.requireAdmin }, async (request) => ({
    summary: await service.summary(parse(cashQuery, request.query)),
  }));

  app.get('/today', { preHandler: app.authenticate }, async (request) => ({ today: await service.today(actorOf(request)) }));
}
