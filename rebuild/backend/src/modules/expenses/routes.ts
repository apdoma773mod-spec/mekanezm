import type { FastifyInstance } from 'fastify';
import { expenseInput, idParam, listExpensesQuery, updateExpenseInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ExpensesService } from './service.js';

export default async function expensesRoutes(app: FastifyInstance) {
  const service = new ExpensesService(app.prisma);
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => service.list(parse(listExpensesQuery, request.query)));
  app.get('/categories', async () => ({ categories: await service.categories() }));

  app.post('/', async (request, reply) => {
    const expense = await service.create(parse(expenseInput, request.body), actorOf(request));
    return reply.status(201).send({ expense });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { expense: await service.update(id, parse(updateExpenseInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });
}
