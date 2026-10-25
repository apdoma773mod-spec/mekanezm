import type { FastifyInstance } from 'fastify';
import { idParam, listShipmentsQuery, shipmentInput, shipPaidInput, updateShipmentInput } from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { parse } from '../../lib/validate.js';
import { ShippingService } from './service.js';

export default async function shippingRoutes(app: FastifyInstance) {
  const service = new ShippingService(app.prisma);
  // The counter staff prepare and follow parcels too; deleting is for admins.
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => service.list(parse(listShipmentsQuery, request.query)));

  app.post('/', async (request, reply) => {
    const shipment = await service.create(parse(shipmentInput, request.body), actorOf(request));
    return reply.status(201).send({ shipment });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return { shipment: await service.update(id, parse(updateShipmentInput, request.body), actorOf(request)) };
  });

  app.post('/:id/paid', async (request) => {
    const { id } = parse(idParam, request.params);
    return { shipment: await service.paid(id, parse(shipPaidInput, request.body), actorOf(request)) };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await service.remove(id, actorOf(request));
    return { ok: true };
  });
}
