import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { ALERT_BY, ALERT_TYPES, alertConfig } from '../../lib/alerts.js';
import { writeAudit } from '../../lib/audit.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { dailyReport, readReportConfig, REPORT_KEY } from './report.js';

const phone = z.string().transform((v) => {
  let d = v.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `2${d}`;
  return d;
});
const configBody = z.object({
  on: z.boolean(),
  to: z.array(phone).min(1, 'اكتب رقم واحد على الأقل').max(10),
  disc: z.number().int().min(1).max(90),
  short: z.number().min(1).max(1e7),
  skip_admin: z.boolean(),
  types: z.record(z.string(), z.boolean()),
});

/** 🔔 تنبيهات ضد السرقة + 📊 تقرير آخر اليوم — للمدير بس. */
export default async function alertsRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);
  const save = async (key: string, value: unknown, request: Parameters<typeof actorOf>[0]) => {
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: value as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: key, ip: actor.ip });
    });
  };

  app.get('/config', async () => ({
    config: await alertConfig(db),
    types: ALERT_TYPES.map(([k, label]) => ({ key: k, label })),
    log: (await db.outboundMessage.findMany({ where: { byName: ALERT_BY }, orderBy: { createdAt: 'desc' }, take: 30 })).map((m) => ({
      body: m.body.replace(/^🔔 تنبيه من السيستم\n/, ''),
      status: m.status,
      to: m.toPhone,
      at: m.createdAt.toISOString(),
    })),
  }));

  app.put('/config', async (request) => {
    await save('alerts', parse(configBody, request.body), request);
    return { ok: true };
  });

  app.post('/test', async () => {
    const c = await alertConfig(db);
    for (const to of c.to) await db.outboundMessage.create({ data: { toPhone: to, body: '🔔 تنبيه من السيستم\n🧪 ده تنبيه تجربة — التنبيهات الفورية شغالة ✅', byName: ALERT_BY } });
    return { sent: c.to.length };
  });

  app.get('/report/config', async () => ({ config: await readReportConfig(db) }));

  app.put('/report/config', async (request) => {
    const b = parse(z.object({ on: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/) }), request.body);
    const old = await readReportConfig(db);
    await save(REPORT_KEY, { ...old, ...b }, request);
    return { ok: true };
  });

  app.get('/report/preview', async (request) => {
    const q = parse(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), request.query);
    return { text: await dailyReport(db, q.day ?? todayYmd()) };
  });

  app.post('/report/send', async () => {
    const text = await dailyReport(db, todayYmd());
    const c = await alertConfig(db);
    for (const to of c.to) await db.outboundMessage.create({ data: { toPhone: to, body: text, byName: ALERT_BY } });
    return { sent: c.to.length };
  });
}
