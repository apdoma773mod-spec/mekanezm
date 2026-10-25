import type { FastifyInstance } from 'fastify';
import {
  adjustStockInput,
  idParam,
  listProductsQuery,
  lookupProductQuery,
  paginationQuery,
  productInput,
  updateProductInput,
} from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ProductsService } from './service.js';

export default async function productsRoutes(app: FastifyInstance) {
  const service = new ProductsService(app.prisma);

  // Everyone signed in can read products (needed to sell); only admins change them.
  app.get('/', { preHandler: app.authenticate }, async (request) =>
    service.list(parse(listProductsQuery, request.query), actorOf(request)),
  );

  app.get('/categories', { preHandler: app.authenticate }, async () => ({ categories: await service.categories() }));

  app.get('/lookup', { preHandler: app.authenticate }, async (request) => {
    const { code } = parse(lookupProductQuery, request.query);
    return { product: await service.lookup(code, actorOf(request)) };
  });

  app.get('/:id', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { product: await service.get(id, actorOf(request)) };
  });

  app.get('/:id/moves', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { page, pageSize } = parse(paginationQuery, request.query);
    return service.moves(id, page, pageSize);
  });

  app.post('/', { preHandler: app.requireAdmin }, async (request, reply) => {
    const product = await service.create(parse(productInput, request.body), actorOf(request));
    return reply.status(201).send({ product });
  });

  app.patch('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { product: await service.update(id, parse(updateProductInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });

  app.post('/:id/adjust', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { product: await service.adjust(id, parse(adjustStockInput, request.body), actorOf(request)) };
  });
}
