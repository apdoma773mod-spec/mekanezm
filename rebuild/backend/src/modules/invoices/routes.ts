import type { FastifyInstance } from 'fastify';
import { idParam, invoiceInput, listInvoicesQuery, updateInvoiceInput, voidInvoiceInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { InvoicesService } from './service.js';

export default async function invoicesRoutes(app: FastifyInstance) {
  const service = new InvoicesService(app.prisma);

  // Like the old system: staff create and view invoices; editing and voiding are for admins.
  app.get('/', { preHandler: app.authenticate }, async (request) => service.list(parse(listInvoicesQuery, request.query)));

  app.get('/:id', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.get(id, actorOf(request)) };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const invoice = await service.create(parse(invoiceInput, request.body), actorOf(request));
    return reply.status(201).send({ invoice });
  });

  app.put('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.update(id, parse(updateInvoiceInput, request.body), actorOf(request)) };
  });

  app.post('/:id/void', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.void(id, parse(voidInvoiceInput, request.body), actorOf(request)) };
  });
}
