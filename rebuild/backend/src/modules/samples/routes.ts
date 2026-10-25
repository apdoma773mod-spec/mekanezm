import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParam, sampleInput, sampleStatusInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { SamplesService } from './service.js';

export default async function samplesRoutes(app: FastifyInstance) {
  const service = new SamplesService(app.prisma);
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => service.list(actorOf(request)));

  app.get('/count', async (request) => {
    const { name } = parse(z.object({ name: z.string().trim().max(120) }), request.query);
    return { count: await service.outFor(name) };
  });

  app.put('/flag', { preHandler: app.requireAdmin }, async (request) => {
    const { on } = parse(z.object({ on: z.boolean() }), request.body);
    return { on: await service.setFlag(on, actorOf(request)) };
  });

  app.post('/', async (request, reply) => {
    const sample = await service.create(parse(sampleInput, request.body), actorOf(request));
    return reply.status(201).send({ sample });
  });

  app.post('/:id/status', async (request) => {
    const { id } = parse(idParam, request.params);
    const { status } = parse(sampleStatusInput, request.body);
    return { sample: await service.setStatus(id, status, actorOf(request)) };
  });
}
