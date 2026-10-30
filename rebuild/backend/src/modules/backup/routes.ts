import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { COPY_KEY, copyOut, describeBackup, readCopy, saveToday, takeSnapshot } from './service.js';

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

  /** The second copy outside the database: folder, last time, last error. */
  app.get('/copy', async () => ({ copy: await readCopy(db) }));

  app.put('/copy', async (request) => {
    const { dir } = z.object({ dir: z.string().trim().max(300) }).parse(request.body);
    if (dir) {
      try {
        await fs.mkdir(dir, { recursive: true });
        const t = path.join(dir, '.mk-test');
        await fs.writeFile(t, 'ok');
        await fs.rm(t, { force: true });
      } catch (e) {
        throw badRequest('مش قادر أكتب في الفولدر ده: ' + String((e as Error).message).slice(0, 120));
      }
    }
    const cur = await readCopy(db);
    const next = { ...cur, dir, lastError: '' };
    await db.setting.upsert({ where: { key: COPY_KEY }, create: { key: COPY_KEY, value: next as never }, update: { value: next as never } });
    if (dir) await copyOut(db, await takeSnapshot(db));
    return { copy: await readCopy(db) };
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

