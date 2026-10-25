import type { FastifyInstance } from 'fastify';
import {
  attendanceManualInput,
  idParam,
  monthQuery,
  pointsConfigInput,
  pointsGiveInput,
  punchInput,
  staffConfigInput,
  staffInput,
  staffMoveInput,
} from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { StaffService } from './service.js';

export default async function staffRoutes(app: FastifyInstance) {
  const service = new StaffService(app.prisma);
  const admin = { preHandler: app.requireAdmin };
  const user = { preHandler: app.authenticate };

  // Staff see only their own file («حضوري»); everything else is the owner's.
  app.get('/', user, async (request) => {
    const { month } = parse(monthQuery, request.query);
    return service.month(month ?? todayYmd().slice(0, 7), actorOf(request));
  });

  app.post('/', admin, async (request, reply) => {
    const staff = await service.save(null, parse(staffInput, request.body), actorOf(request));
    return reply.status(201).send({ staff });
  });

  app.put('/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    return { staff: await service.save(id, parse(staffInput, request.body), actorOf(request)) };
  });

  app.post('/attendance', admin, async (request) => ({
    attendance: await service.manual(parse(attendanceManualInput, request.body), actorOf(request)),
  }));

  app.post('/:id/moves', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    return { move: await service.move(id, parse(staffMoveInput, request.body), actorOf(request)) };
  });

  app.put('/config', admin, async (request) => ({ config: await service.saveConfig(parse(staffConfigInput, request.body), actorOf(request)) }));

  app.post('/punch-code', admin, async () => service.punchCode());
  app.get('/today', admin, async () => ({ today: await service.today() }));
  app.post('/punch', user, async (request) => ({ result: await service.punch(parse(punchInput, request.body).code, actorOf(request)) }));

  app.get('/points', admin, async (request) => {
    const { month } = parse(monthQuery, request.query);
    return service.board(month ?? todayYmd().slice(0, 7));
  });
  app.put('/points/config', admin, async (request) => ({
    config: await service.savePointsConfig(parse(pointsConfigInput, request.body), actorOf(request)),
  }));
  app.post('/:id/points', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    return { point: await service.givePoints(id, parse(pointsGiveInput, request.body), actorOf(request)) };
  });
}
