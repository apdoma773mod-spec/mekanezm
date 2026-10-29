import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';

/**
 * 🏷️ أسعار وحدود العملاء (mk_settings.cust_terms القديمة): لكل عميل خصم ثابت % وفئة وحد أقصى للدين وملاحظة.
 * الكل يقرا (الفاتورة بتطبّق الخصم وبتحذّر من حد الدين)، والمدير بس هو اللي يعدّل.
 */
const KEY = 'cust_terms';
const term = z.object({
  tier: z.string().trim().max(30).optional(),
  pct: z.number().min(0).max(100).optional(),
  limit: z.number().min(0).max(1e9).optional(),
  note: z.string().trim().max(200).optional(),
});
const body = z.object({ terms: z.record(z.string().max(120), term) });

export default async function termsRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.get('/', { preHandler: app.authenticate }, async () => {
    const s = await db.setting.findUnique({ where: { key: KEY } });
    return { terms: (s?.value as Record<string, unknown> | null) ?? {} };
  });

  app.put('/', { preHandler: app.requireAdmin }, async (request) => {
    const { terms } = body.parse(request.body);
    // an entry with nothing in it is not a term (the old screen deleted it the same way)
    const clean = Object.fromEntries(Object.entries(terms).filter(([, t]) => t.pct || t.limit || t.note || t.tier));
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: KEY },
        create: { key: KEY, value: clean as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: clean as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: KEY, ip: actor.ip });
    });
    return { ok: true };
  });
}
