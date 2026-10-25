import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParam, kitInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { KitsService } from './service.js';

export default async function kitsRoutes(app: FastifyInstance) {
  const service = new KitsService(app.prisma);
  const admin = { preHandler: app.requireAdmin };

  // Scanning a kit barcode in a sale works for everyone; the kits screen is the owner's.
  app.get('/lookup', { preHandler: app.authenticate }, async (request) => {
    const { code } = parse(z.object({ code: z.string().trim().min(1).max(40) }), request.query);
    return { kit: await service.byCode(code) };
  });

  app.get('/', { preHandler: app.authenticate }, async () => ({ kits: await service.list() }));

  app.post('/', admin, async (request, reply) => {
    const kit = await service.save(null, parse(kitInput, request.body), actorOf(request));
    return reply.status(201).send({ kit });
  });

  app.put('/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    return { kit: await service.save(id, parse(kitInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });
}
