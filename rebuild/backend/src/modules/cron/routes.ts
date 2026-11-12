import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { ensureToday } from '../backup/service.js';
import { reportTick } from '../alerts/report.js';
import { autoTick } from '../alerts/auto.js';
import { CameraService } from '../camera/service.js';
import { notifyBackInStock } from '../web/notify-me.js';
import { pingWants } from '../scraps/service.js';
import { scanTick } from '../ai/scans.js';

/**
 * ⏰ The scheduled jobs (daily copy, end-of-day report, automatic messages, back-in-stock, cameras) as one endpoint.
 * On a normal server server.ts runs them with timers; on Vercel there is no always-on process, so a free GitHub Actions
 * schedule calls this every 5 minutes with the CRON_SECRET. Empty CRON_SECRET = refuse everything.
 */
export default async function cronRoutes(app: FastifyInstance) {
  const ok = (given: string) => {
    const want = process.env.CRON_SECRET ?? '';
    return want.length >= 16 && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
  };
  app.post('/tick', async (request, reply) => {
    if (!ok(String(request.headers['x-cron-secret'] ?? ''))) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'السر غلط' } });
    const jobs: Record<string, () => Promise<unknown>> = {
      backup: () => ensureToday(app.prisma),
      report: () => reportTick(app.prisma),
      auto: () => autoTick(app.prisma),
      notify: () => notifyBackInStock(app.prisma),
      camera: () => new CameraService(app.prisma).tick(),
      scraps: () => pingWants(app.prisma),
      scans: () => scanTick(app.prisma, app.log),
    };
    const result: Record<string, string> = {};
    await Promise.all(
      Object.entries(jobs).map(async ([name, run]) => {
        try {
          await run();
          result[name] = 'ok';
        } catch (err) {
          app.log.error({ err, job: name }, 'cron job failed');
          result[name] = 'failed';
        }
      }),
    );
    return result;
  });
}
