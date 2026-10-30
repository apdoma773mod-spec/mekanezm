import type { FastifyInstance } from 'fastify';
import { reportParams, reportQuery } from '@mk/shared';
import { parse } from '../../lib/validate.js';
import { z } from 'zod';
import { contactReport, topCustomers } from './contact-report.js';
import { ReportsService } from './service.js';
import { onlineReport } from './online.js';
import { returnsAnalysis } from './returns-analysis.js';
import { accountantExport } from './accountant.js';

export default async function reportsRoutes(app: FastifyInstance) {
  const service = new ReportsService(app.prisma);
  // Reports show cost and profit, so they are for admins only, as in the old system.
  app.addHook('preHandler', app.requireAdmin);

  app.get('/headline', async (request) => {
    const { from, to } = parse(reportQuery, request.query);
    return { headline: await service.headline({ from, to }) };
  });

  app.get('/contact', async (request) => {
    const q = parse(z.object({ name: z.string().trim().min(1).max(120), type: z.enum(['CUSTOMER', 'SUPPLIER']), from: z.string().max(10).optional(), to: z.string().max(10).optional() }), request.query);
    return { report: await contactReport(app.prisma, q) };
  });

  app.get('/top-customers', async () => ({ customers: await topCustomers(app.prisma) }));

  app.get('/online', async (request) => {
    const q = parse(z.object({ from: z.string().max(10).optional(), to: z.string().max(10).optional() }), request.query);
    return { report: await onlineReport(app.prisma, q) };
  });

  app.get('/returns-analysis', async (request) => {
    const q = parse(z.object({ from: z.string().max(10).optional(), to: z.string().max(10).optional() }), request.query);
    return { report: await returnsAnalysis(app.prisma, q) };
  });

  app.get('/accountant', async (request) => {
    const { month } = parse(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }), request.query);
    return { month, sheets: await accountantExport(app.prisma, month) };
  });

  app.get('/periods', async () => ({ periods: await service.periods() }));

  app.get('/:id', async (request) => {
    const { id } = parse(reportParams, request.params);
    const { from, to } = parse(reportQuery, request.query);
    return { report: await service.run(id, { from, to }) };
  });
}
