// Vercel entry: the whole Fastify app as one serverless function (built first with `npm run build`).
import { buildApp } from '../dist/app.js';
import { loadConfig } from '../dist/config.js';

let ready;
const getApp = () =>
  (ready ??= (async () => {
    const app = await buildApp({ config: loadConfig() });
    await app.ready();
    return app;
  })());

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
