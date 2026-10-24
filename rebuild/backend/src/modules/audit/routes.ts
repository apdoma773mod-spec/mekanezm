import type { FastifyInstance } from 'fastify';
import { listAuditQuery } from '@mk/shared';
import { parse } from '../../lib/validate.js';
import { AuditService } from './service.js';

export default async function auditRoutes(app: FastifyInstance) {
  const service = new AuditService(app.prisma);
  app.get('/', { preHandler: app.requireAdmin }, async (request) => service.list(parse(listAuditQuery, request.query)));
}
