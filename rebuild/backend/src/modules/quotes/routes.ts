import type { FastifyInstance } from 'fastify';
import { idParam, listQuotesQuery, quoteConvertedInput, quoteInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { QuotesService } from './service.js';

export default async function quotesRoutes(app: FastifyInstance) {
  const service = new QuotesService(app.prisma);
  // Staff could make quotes in the old system (EMP_OK included «quotes»).
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const { q, page, pageSize } = parse(listQuotesQuery, request.query);
    return service.list(q, page, pageSize);
  });

  app.get('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { quote: await service.get(id) };
  });

  app.post('/', async (request, reply) => {
    const quote = await service.create(parse(quoteInput, request.body), actorOf(request));
    return reply.status(201).send({ quote });
  });

  app.put('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { quote: await service.update(id, parse(quoteInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });

  app.post('/:id/converted', async (request) => {
    const { id } = parse(idParam, request.params);
    const { invoiceId } = parse(quoteConvertedInput, request.body);
    return { quote: await service.converted(id, invoiceId, actorOf(request)) };
  });
}
