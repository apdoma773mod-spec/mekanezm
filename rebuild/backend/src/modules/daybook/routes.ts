import type { FastifyInstance } from 'fastify';
import {
  daybookAddInput,
  daybookDayQuery,
  daybookPostInput,
  daybookSetPayInput,
  daybookUpdateInput,
  idParam,
} from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { DaybookService } from './service.js';

export default async function daybookRoutes(app: FastifyInstance) {
  const service = new DaybookService(app.prisma);
  // The daybook is the counter staff's main screen, so every signed-in user can use it.
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const { day } = parse(daybookDayQuery, request.query);
    return service.day(day ?? todayYmd());
  });

  app.post('/', async (request, reply) => {
    const entry = await service.add(parse(daybookAddInput, request.body), actorOf(request));
    return reply.status(201).send({ entry });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { entry: await service.update(id, parse(daybookUpdateInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });

  app.post('/:id/pay', async (request) => {
    const { id } = parse(idParam, request.params);
    const { pay } = parse(daybookSetPayInput, request.body);
    return { entry: await service.setPay(id, pay, actorOf(request)) };
  });

  app.post('/:id/deliver', async (request) => {
    const { id } = parse(idParam, request.params);
    return { entry: await service.deliver(id, actorOf(request)) };
  });

  app.post('/post', async (request) => {
    const { day, person } = parse(daybookPostInput, request.body);
    return service.post(day, person, actorOf(request));
  });
}
