import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { describeBackup, saveToday } from './service.js';

/** 💾 النسخ الاحتياطية للمدير: قايمة، نسخة دلوقتي، تنزيل، وفحص ملف قبل أي استرجاع. */
export default async function backupRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  app.get('/', async () => {
    const rows = await db.backup.findMany({ orderBy: { day: 'desc' }, take: 31, select: { day: true, madeAt: true } });
    return { items: rows.map((r) => ({ day: r.day, madeAt: r.madeAt.toISOString() })) };
  });

  app.post('/now', async () => {
    const r = await saveToday(db);
    return { ok: true, ...r };
  });

  app.get('/:day', async (request, reply) => {
    const { day } = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(request.params);
    const row = await db.backup.findUnique({ where: { day } });
    if (!row) throw notFound('مفيش نسخة لليوم ده');
    return reply.header('content-disposition', `attachment; filename="mekanizm-backup-${day}.json"`).send(row.data);
  });

  /** Reads a backup file the owner picked and says what is in it. Nothing is restored here. */
  app.post('/check', { bodyLimit: 60 * 1024 * 1024 }, async (request) => {
    const res = describeBackup(request.body);
    if (!res.ok) throw badRequest(res.reason ?? 'ملف غلط');
    return res;
  });
}

