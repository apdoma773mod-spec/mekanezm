import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createUserInput, idParam, listUsersQuery, resetPasswordInput, updateUserInput } from '@mk/shared';
import { currentUser } from '../../plugins/auth.js';
import { parse } from '../../lib/validate.js';
import { UsersService, type Actor } from './service.js';

export default async function usersRoutes(app: FastifyInstance) {
  const service = new UsersService(app.prisma);
  const actor = (request: FastifyRequest): Actor => ({ id: currentUser(request).id, ip: request.ip ?? null });

  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async (request) => service.list(parse(listUsersQuery, request.query)));

  app.get('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { user: await service.get(id) };
  });

  app.post('/', async (request, reply) => {
    const user = await service.create(parse(createUserInput, request.body), actor(request));
    return reply.status(201).send({ user });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { user: await service.update(id, parse(updateUserInput, request.body), actor(request)) };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { user: await service.deactivate(id, actor(request)) };
  });

  app.post('/:id/reset-password', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.resetPassword(id, parse(resetPasswordInput, request.body), actor(request));
    return { ok: true };
  });
}
