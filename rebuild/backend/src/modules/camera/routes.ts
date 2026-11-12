import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  bridgeEmbeddingInput,
  bridgeSeenInput,
  bridgeStatusInput,
  cameraConfigInput,
  facePhotoInput,
  idParam,
  isoDateSchema,
  marketDayInput,
  nameSightingInput,
} from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { checkBridge } from '../inbox/bridge.js';
import { CameraService } from './service.js';

/** 📷 شاشة الكاميرات (للمدير بس). */
export default async function cameraRoutes(app: FastifyInstance) {
  const service = new CameraService(app.prisma);
  const admin = { preHandler: app.requireAdmin };
  const day = z.object({ day: isoDateSchema.optional() });

  app.get('/overview', admin, async (request) => {
    const q = parse(day, request.query);
    const [overview, since] = await Promise.all([service.overview(q.day ?? todayYmd()), service.since()]);
    return { ...overview, since };
  });
  app.put('/config', admin, async (request) => ({ config: await service.saveConfig(parse(cameraConfigInput, request.body), actorOf(request)) }));

  app.get('/faces/:id', admin, async (request) => ({ photos: await service.photos(parse(idParam, request.params).id) }));
  app.post('/faces', admin, async (request, reply) => {
    const b = parse(facePhotoInput, request.body);
    return reply.status(201).send({ photo: await service.addPhoto(b.staffId, b.photo, actorOf(request)) });
  });
  app.delete('/faces/:id', admin, async (request) => {
    await service.removePhoto(parse(idParam, request.params).id, actorOf(request));
    return { ok: true };
  });

  app.get('/sightings/:id', admin, async (request) => ({ sighting: await service.sighting(parse(idParam, request.params).id) }));
  app.delete('/sightings/:id', admin, async (request) => {
    await service.deleteSighting(parse(idParam, request.params).id, actorOf(request));
    return { ok: true };
  });
  app.post('/sightings/:id/name', admin, async (request) => {
    await service.nameSighting(parse(idParam, request.params).id, parse(nameSightingInput, request.body).staffId, actorOf(request));
    return { ok: true };
  });
  app.post('/sightings/:id/dismiss', admin, async (request) => {
    await service.dismiss(parse(idParam, request.params).id);
    return { ok: true };
  });

  app.post('/market', admin, async (request) => {
    const b = parse(marketDayInput, request.body);
    await service.market(b.staffId, b.day ?? todayYmd(), b.on, actorOf(request));
    return { ok: true };
  });
  app.delete('/attendance/:id', admin, async (request) => {
    await service.deleteAttendance(parse(idParam, request.params).id, actorOf(request));
    return { ok: true };
  });
  app.post('/tick', admin, async () => service.tick());
}

/** 🔌 جسر الكاميرات (برنامج على جهاز المحل) — بنفس سر الجسر x-bridge-secret. */
export async function cameraBridgeRoutes(app: FastifyInstance) {
  const service = new CameraService(app.prisma);
  app.addHook('preHandler', async (request) => {
    checkBridge(app, request);
  });
  app.get('/faces', async () => service.bridgeFaces());
  app.post('/embedding', async (request) => {
    const b = parse(bridgeEmbeddingInput, request.body);
    await service.bridgeEmbedding(b.photoId, b.embedding);
    return { ok: true };
  });
  app.post('/status', async (request) => {
    await service.bridgeStatus(parse(bridgeStatusInput, request.body).channels);
    return { ok: true };
  });
  app.post('/seen', async (request) => service.recordSeen(parse(bridgeSeenInput, request.body)));
}
