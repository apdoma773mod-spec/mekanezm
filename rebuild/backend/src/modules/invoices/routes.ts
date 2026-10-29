import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParam, invoiceInput, listInvoicesQuery, updateInvoiceInput, voidInvoiceInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { InvoicesService } from './service.js';

export default async function invoicesRoutes(app: FastifyInstance) {
  const service = new InvoicesService(app.prisma);

  // Like the old system: staff create and view invoices; editing and voiding are for admins.
  app.get('/', { preHandler: app.authenticate }, async (request) => service.list(parse(listInvoicesQuery, request.query)));

  app.get('/persons', { preHandler: app.authenticate }, async (request) => {
    const q = parse(z.object({ kind: z.enum(['SALE', 'PURCHASE']).default('PURCHASE'), company: z.enum(['MK', 'HY']).optional() }), request.query);
    return { persons: await service.persons(q.kind, q.company) };
  });

  app.post('/check-duplicate', { preHandler: app.authenticate }, async (request) => {
    const b = parse(z.object({ person: z.string().trim().min(1).max(120), total: z.number().gt(0), sno: z.string().trim().max(60).optional() }), request.body);
    return { duplicate: await service.duplicate(b) };
  });

  app.get('/:id/cost-change', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { items: await service.costChange(id) };
  });

  app.post('/:id/apply-cost', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { updated: await service.applyCost(id, actorOf(request)) };
  });

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
