import type { FastifyInstance } from 'fastify';
import { settingKeyParam } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { SettingsService } from './service.js';

export default async function settingsRoutes(app: FastifyInstance) {
  const service = new SettingsService(app.prisma);

  app.get('/', { preHandler: app.authenticate }, async () => ({ settings: await service.getAll() }));

  // The theme carries the logo and background image inline, so it needs a bigger body than other routes.
  app.put('/:key', { preHandler: app.requireAdmin, bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    const { key } = parse(settingKeyParam, request.params);
    const value = await service.set(key, request.body, actorOf(request));
    return { key, value };
  });
}
