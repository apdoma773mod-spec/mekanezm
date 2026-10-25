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
import productsRoutes from './modules/products/routes.js';
import contactsRoutes from './modules/contacts/routes.js';
import invoicesRoutes from './modules/invoices/routes.js';
import paymentsRoutes from './modules/payments/routes.js';
import returnsRoutes from './modules/returns/routes.js';
import expensesRoutes from './modules/expenses/routes.js';
import cashRoutes from './modules/cash/routes.js';
import daybookRoutes from './modules/daybook/routes.js';
import closingRoutes from './modules/closing/routes.js';
import countsRoutes from './modules/counts/routes.js';
import reportsRoutes from './modules/reports/routes.js';
import insightsRoutes from './modules/insights/routes.js';
import quotesRoutes from './modules/quotes/routes.js';
import shippingRoutes from './modules/shipping/routes.js';
import giftsRoutes from './modules/gifts/routes.js';
import staffRoutes from './modules/staff/routes.js';
import kitsRoutes from './modules/kits/routes.js';
import samplesRoutes from './modules/samples/routes.js';
import wantedRoutes from './modules/wanted/routes.js';
import hydrolekRoutes from './modules/hydrolek/routes.js';
import workRoutes from './modules/work/routes.js';

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
      await api.register(productsRoutes, { prefix: '/products' });
      await api.register(contactsRoutes, { prefix: '/contacts' });
      await api.register(invoicesRoutes, { prefix: '/invoices' });
      await api.register(paymentsRoutes, { prefix: '/payments' });
      await api.register(returnsRoutes, { prefix: '/returns' });
      await api.register(expensesRoutes, { prefix: '/expenses' });
      await api.register(cashRoutes, { prefix: '/cash' });
      await api.register(daybookRoutes, { prefix: '/daybook' });
      await api.register(closingRoutes, { prefix: '/closings' });
      await api.register(countsRoutes, { prefix: '/counts' });
      await api.register(reportsRoutes, { prefix: '/reports' });
      await api.register(insightsRoutes, { prefix: '/insights' });
      await api.register(quotesRoutes, { prefix: '/quotes' });
      await api.register(shippingRoutes, { prefix: '/shipments' });
      await api.register(giftsRoutes, { prefix: '/stock-extras' });
      await api.register(staffRoutes, { prefix: '/staff' });
      await api.register(kitsRoutes, { prefix: '/kits' });
      await api.register(samplesRoutes, { prefix: '/samples' });
      await api.register(wantedRoutes, { prefix: '/wanted' });
      await api.register(hydrolekRoutes, { prefix: '/hy' });
      await api.register(workRoutes, { prefix: '/work' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
