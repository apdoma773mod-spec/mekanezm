import type { FastifyInstance } from 'fastify';
import { idParam, listPaymentsQuery, paymentInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { PaymentsService } from './service.js';

export default async function paymentsRoutes(app: FastifyInstance) {
  const service = new PaymentsService(app.prisma);
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => service.list(parse(listPaymentsQuery, request.query)));

  app.post('/', async (request, reply) => {
    const payment = await service.create(parse(paymentInput, request.body), actorOf(request));
    return reply.status(201).send({ payment });
  });

  app.post('/:id/cancel', async (request) => {
    const { id } = parse(idParam, request.params);
    return { payment: await service.cancel(id, actorOf(request)) };
  });
}
