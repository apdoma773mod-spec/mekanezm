import type { FastifyInstance } from 'fastify';
import { reportParams, reportQuery } from '@mk/shared';
import { parse } from '../../lib/validate.js';
import { ReportsService } from './service.js';

export default async function reportsRoutes(app: FastifyInstance) {
  const service = new ReportsService(app.prisma);
  // Reports show cost and profit, so they are for admins only, as in the old system.
  app.addHook('preHandler', app.requireAdmin);

  app.get('/headline', async (request) => {
    const { from, to } = parse(reportQuery, request.query);
    return { headline: await service.headline({ from, to }) };
  });

  app.get('/periods', async () => ({ periods: await service.periods() }));

  app.get('/:id', async (request) => {
    const { id } = parse(reportParams, request.params);
    const { from, to } = parse(reportQuery, request.query);
    return { report: await service.run(id, { from, to }) };
  });
}
