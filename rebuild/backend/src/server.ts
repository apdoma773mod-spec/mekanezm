import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ensureToday } from './modules/backup/service.js';

const config = loadConfig();
const app = await buildApp({ config });

/** A copy of the shop every day: checked now and every 30 minutes, so a day without a copy never stays empty. */
const backupTimer = setInterval(() => {
  ensureToday(app.prisma).catch((err) => app.log.error({ err }, 'daily backup failed'));
}, 30 * 60_000);

const shutdown = async (signal: string) => {
  clearInterval(backupTimer);
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
