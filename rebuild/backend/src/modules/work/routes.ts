import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf, isAdmin } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';

/**
 * «🛠️ أنظمة الشغل» keeps its documents as JSON, as the old system did in mk_settings (wk_*):
 * orders with their stages, config, display goods, show-room expenses, offcuts and forged-rod work.
 */
const KEYS = ['count_sessions', 'voice_cmds', 'points', 'follow', 'reservations', 'combos', 'usd', 'plists', 'credit', 'wk_orders', 'wk_cfg', 'wk_display', 'wk_showexp', 'wk_offcuts', 'wk_forf', 'wk_leaf'] as const;
const keyParam = z.object({ key: z.enum(KEYS) });

const UPLOADS = path.resolve(process.cwd(), 'uploads');
const fileName = z.string().regex(/^[a-z0-9-]{8,64}\.(jpg|jpeg|png|webp|pdf|mp4)$/);
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', mp4: 'video/mp4' };

export default async function workRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.get('/kv/:key', { preHandler: app.authenticate }, async (request) => {
    const { key } = parse(keyParam, request.params);
    // the voice command words are read by everyone's 🎤 window; every other document is the owner's
    if (key !== 'voice_cmds' && !isAdmin(actorOf(request))) throw forbidden('الشاشة دي للمدير بس');
    const s = await db.setting.findUnique({ where: { key } });
    return { value: s?.value ?? null };
  });

  app.put('/kv/:key', { preHandler: app.requireAdmin, bodyLimit: 20 * 1024 * 1024 }, async (request) => {
    const { key } = parse(keyParam, request.params);
    const { value } = parse(z.object({ value: z.unknown() }), request.body);
    if (value === undefined) throw badRequest('مفيش بيانات');
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: value as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: key, ip: actor.ip });
    });
    return { ok: true };
  });

  /** Drawings and photos sent to craftsmen as links (the old site-images bucket). */
  app.post('/files', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const { data, ext } = parse(z.object({ data: z.string().min(10), ext: z.enum(['jpg', 'jpeg', 'png', 'webp', 'pdf']).default('jpg') }), request.body);
    const b64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > 10 * 1024 * 1024) throw badRequest('الملف كبير أو فاضي');
    await mkdir(UPLOADS, { recursive: true });
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(path.join(UPLOADS, name), buf);
    return { name, url: `/api/v1/work/files/${name}` };
  });

  // Public on purpose: the link goes to a craftsman on WhatsApp. Names are random and unguessable.
  app.get('/files/:name', async (request, reply) => {
    const { name } = parse(z.object({ name: fileName }), request.params);
    try {
      const buf = await readFile(path.join(UPLOADS, name));
      return reply.header('content-type', MIME[name.split('.').pop()!] ?? 'application/octet-stream').header('cache-control', 'public, max-age=31536000, immutable').send(buf);
    } catch {
      throw notFound('الملف مش موجود');
    }
  });
}
