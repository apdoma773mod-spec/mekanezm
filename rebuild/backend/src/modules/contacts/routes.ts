import type { FastifyInstance } from 'fastify';
import { contactInput, idParam, listContactsQuery, statementQuery, updateContactInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ContactsService } from './service.js';

export default async function contactsRoutes(app: FastifyInstance) {
  const service = new ContactsService(app.prisma);

  // Staff can look contacts up to pick a customer on a sale; everything else is for admins.
  app.get('/', { preHandler: app.authenticate }, async (request) => service.list(parse(listContactsQuery, request.query)));

  app.get('/:id', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { contact: await service.get(id) };
  });

  app.get('/:id/statement', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { from, to } = parse(statementQuery, request.query);
    return { statement: await service.statement(id, from, to) };
  });

  app.post('/', { preHandler: app.requireAdmin }, async (request, reply) => {
    const contact = await service.create(parse(contactInput, request.body), actorOf(request));
    return reply.status(201).send({ contact });
  });

  app.patch('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { contact: await service.update(id, parse(updateContactInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });
}
