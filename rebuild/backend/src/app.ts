import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Config } from './config.js';
import prismaPlugin from './plugins/prisma.js';
import errorsPlugin from './plugins/errors.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth/routes.js';
import usersRoutes from './modules/users/routes.js';
import settingsRoutes from './modules/settings/routes.js';
import auditRoutes from './modules/audit/routes.js';

export interface BuildOptions {
  config: Config;
  prisma?: PrismaClient;
}

export async function buildApp({ config, prisma }: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  });

  app.decorate('config', config);
  await app.register(errorsPlugin);
  await app.register(helmet);
  await app.register(rateLimit, { global: false });
  await app.register(prismaPlugin, { prisma });
  await app.register(authPlugin);

  await app.register(
    async (api) => {
      api.get('/health', async () => {
        await api.prisma.$queryRaw`SELECT 1`;
        return { ok: true, time: new Date().toISOString() };
      });
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(usersRoutes, { prefix: '/users' });
      await api.register(settingsRoutes, { prefix: '/settings' });
      await api.register(auditRoutes, { prefix: '/audit' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
