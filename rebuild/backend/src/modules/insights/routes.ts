import type { FastifyInstance } from 'fastify';
import { chartsQuery, debtTemplateInput, idParam, reorderQuery } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { InsightsService } from './service.js';

export default async function insightsRoutes(app: FastifyInstance) {
  const service = new InsightsService(app.prisma);
  // Debts, reorder and charts were admin screens in the old system.
  app.addHook('preHandler', app.requireAdmin);

  app.get('/debts', async () => service.debts());

  app.post('/debts/:id/remind', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remind(id, actorOf(request));
    return { ok: true };
  });

  app.put('/debts/template', async (request) => {
    const { text } = parse(debtTemplateInput, request.body);
    await service.saveTemplate(text, actorOf(request));
    return { ok: true };
  });

  // only the number, for the dashboard banner (the full list is hundreds of KB on a big shop)
  app.get('/reorder/count', async (request) => {
    const { days } = parse(reorderQuery, request.query);
    return { count: (await service.reorder(days)).length };
  });

  app.get('/reorder', async (request) => {
    const { days } = parse(reorderQuery, request.query);
    return { suggestions: await service.reorder(days) };
  });

  app.get('/charts', async (request) => {
    const { top, stag } = parse(chartsQuery, request.query);
    return { charts: await service.charts(top, stag) };
  });
}
