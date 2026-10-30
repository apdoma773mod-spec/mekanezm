import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ensureToday } from './modules/backup/service.js';
import { reportTick } from './modules/alerts/report.js';
import { autoTick } from './modules/alerts/auto.js';

const config = loadConfig();
const app = await buildApp({ config });

/** A copy of the shop every day: checked now and every 30 minutes, so a day without a copy never stays empty. */
const backupTimer = setInterval(() => {
  ensureToday(app.prisma).catch((err) => app.log.error({ err }, 'daily backup failed'));
}, 30 * 60_000);

/** 📊 تقرير آخر اليوم: كل 5 دقايق يشوف لو جه الميعاد (mk_report_tick القديمة). */
const reportTimer = setInterval(() => {
  reportTick(app.prisma).catch((err) => app.log.error({ err }, 'daily report failed'));
}, 5 * 60_000);

/** 🤖 رسائل تلقائية (ملخص العمال الشهري، التحصيل الأسبوعي): كل 5 دقايق يشوف لو جه الميعاد. */
const autoTimer = setInterval(() => {
  autoTick(app.prisma).catch((err) => app.log.error({ err }, 'auto messages failed'));
}, 5 * 60_000);

const shutdown = async (signal: string) => {
  clearInterval(backupTimer);
  clearInterval(reportTimer);
  clearInterval(autoTimer);
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  ensureToday(app.prisma).catch((err) => app.log.error({ err }, 'daily backup failed'));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
