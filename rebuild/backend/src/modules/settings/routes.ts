import type { FastifyInstance } from 'fastify';
import { settingKeyParam } from '@mk/shared';
import { currentUser } from '../../plugins/auth.js';
import { parse } from '../../lib/validate.js';
import { SettingsService } from './service.js';

export default async function settingsRoutes(app: FastifyInstance) {
  const service = new SettingsService(app.prisma);

  app.get('/', { preHandler: app.authenticate }, async () => ({ settings: await service.getAll() }));

  app.put('/:key', { preHandler: app.requireAdmin }, async (request) => {
    const { key } = parse(settingKeyParam, request.params);
    const value = await service.set(key, request.body, { id: currentUser(request).id, ip: request.ip ?? null });
    return { key, value };
  });
}
