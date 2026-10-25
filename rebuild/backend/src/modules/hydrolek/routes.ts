import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  alertsInput,
  coIdentInput,
  contractActionInput,
  contractInput,
  fieldInvoiceInput,
  fieldOrderInput,
  fieldReplyInput,
  hyRulesInput,
  icSettleInput,
  icTransferInput,
  idParam,
  isoDateSchema,
  lineStateInput,
  partnerInput,
  partnerMoveInput,
  vanCloseInput,
  vanLoadInput,
  vehicleInput,
  vehicleLogInput,
  vehicleMetaInput,
  waSendInput,
} from '@mk/shared';
import { actorOf } from '../../lib/actor.js';
import { todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { FieldService } from './field.js';
import { IcService } from './ic.js';
import { HydrolekService } from './service.js';
import { VanService } from './van.js';

/** «🏢 الشركات»: field reps and the counter use orders, the van and the close; the owner the money between the companies. */
export default async function hydrolekRoutes(app: FastifyInstance) {
  const hy = new HydrolekService(app.prisma);
  const ic = new IcService(app.prisma);
  const field = new FieldService(app.prisma);
  const van = new VanService(app.prisma);
  const user = { preHandler: app.authenticate };
  const admin = { preHandler: app.requireAdmin };

  app.get('/today', user, async () => ({ today: await hy.today() }));
  app.get('/rules', user, async () => ({ rules: await hy.rules() }));
  app.put('/rules', admin, async (request) => ({ rules: await hy.saveRules(parse(hyRulesInput.partial(), request.body), actorOf(request)) }));
  app.get('/ident', user, async () => ({ ident: await hy.ident() }));
  app.put('/ident', admin, async (request) => ({ ident: await hy.saveIdent(parse(coIdentInput, request.body), actorOf(request)) }));

  // 🔁 / ⚖️
  app.post('/ic', admin, async (request) => ({ result: await ic.transfer(parse(icTransferInput, request.body), actorOf(request)) }));
  app.get('/ic', admin, async () => ({ deals: await ic.deals() }));
  app.delete('/ic/:ref', admin, async (request) => {
    const { ref } = parse(z.object({ ref: z.string().min(1).max(64) }), request.params);
    await ic.cancel(ref, actorOf(request));
    return { ok: true };
  });
  app.get('/account', admin, async () => ({ account: await ic.account() }));
  app.post('/account/settle', admin, async (request) => {
    const { dir, amount, note } = parse(icSettleInput, request.body);
    await ic.settle(dir, amount, note, actorOf(request));
    return { ok: true };
  });

  // 🤝
  app.get('/partners', admin, async () => ({ board: await hy.board() }));
  app.post('/partners', admin, async (request) => ({ id: await hy.savePartner(null, parse(partnerInput, request.body), actorOf(request)) }));
  app.put('/partners/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    return { id: await hy.savePartner(id, parse(partnerInput, request.body), actorOf(request)) };
  });
  app.delete('/partners/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.deletePartner(id, actorOf(request));
    return { ok: true };
  });
  app.post('/partners/:id/moves', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.addPartnerMove(id, parse(partnerMoveInput, request.body), actorOf(request));
    return { ok: true };
  });
  app.delete('/partner-moves/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.deletePartnerMove(id);
    return { ok: true };
  });

  // 🚗
  app.get('/vehicles', user, async () => ({ vehicles: await hy.vehicles(), alerts: await hy.carAlerts() }));
  app.post('/vehicles', admin, async (request) => ({ id: await hy.addVehicle(parse(vehicleInput, request.body), actorOf(request)) }));
  app.put('/vehicles/:id/meta', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.saveVehicleMeta(id, parse(vehicleMetaInput, request.body));
    return { ok: true };
  });
  app.post('/vehicles/:id/log', user, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.addVehicleLog(id, parse(vehicleLogInput, request.body), actorOf(request));
    return { ok: true };
  });
  app.delete('/vehicle-log/:id', admin, async (request) => {
    const { id } = parse(idParam, request.params);
    await hy.deleteVehicleLog(id);
    return { ok: true };
  });

  // ⚡ / 📦
  app.get('/orders', user, async () => ({ orders: await field.list() }));
  app.post('/orders', user, async (request, reply) => reply.status(201).send({ order: await field.create(parse(fieldOrderInput, request.body), actorOf(request)) }));
  app.post('/orders/:id/lines/:idx', user, async (request) => {
    const { id, idx } = parse(z.object({ id: z.string().min(1).max(64), idx: z.coerce.number().int().min(0).max(200) }), request.params);
    const { st, dm, dd } = parse(lineStateInput, request.body);
    return { order: await field.setLine(id, idx, st, { dm, dd }, actorOf(request)) };
  });
  app.patch('/orders/:id', user, async (request) => {
    const { id } = parse(idParam, request.params);
    const { eta, note } = parse(fieldReplyInput, request.body);
    return { order: await field.reply(id, eta, note) };
  });
  app.post('/orders/:id/cancel', user, async (request) => {
    const { id } = parse(idParam, request.params);
    return { order: await field.cancel(id, actorOf(request)) };
  });
  app.post('/orders/:id/invoice', user, async (request) => {
    const { id } = parse(idParam, request.params);
    return { order: await field.invoiceDelivered(id, parse(fieldInvoiceInput, request.body).paid, actorOf(request)) };
  });

  // 🚚 / 🧾
  app.get('/van', user, async () => ({ van: await van.state() }));
  app.post('/van/load', user, async (request) => van.load(parse(vanLoadInput, request.body), actorOf(request)));
  app.get('/van/close', user, async (request) => {
    const q = parse(z.object({ date: isoDateSchema.optional(), vehicleId: z.string().max(64).default('') }), request.query);
    return { close: await van.closeView(q.date ?? todayYmd(), q.vehicleId) };
  });
  app.post('/van/close', user, async (request) => van.close(parse(vanCloseInput, request.body), actorOf(request)));
  app.post('/van/close/reopen', admin, async (request) => {
    const q = parse(z.object({ date: isoDateSchema, vehicleId: z.string().max(64).default('') }), request.body);
    await van.reopen(q.date, q.vehicleId, actorOf(request));
    return { ok: true };
  });

  // 📑
  app.get('/contracts', user, async () => ({ contracts: await hy.contracts() }));
  app.post('/contracts', user, async (request, reply) => reply.status(201).send({ contract: await hy.createContract(parse(contractInput, request.body), actorOf(request)) }));
  app.post('/contracts/:id', user, async (request) => {
    const { id } = parse(idParam, request.params);
    return { contract: await hy.contractAction(id, parse(contractActionInput, request.body), actorOf(request)) };
  });

  // 📲
  app.get('/alerts', user, async () => ({ alerts: await hy.alerts(), outbox: await hy.outbox() }));
  app.put('/alerts', admin, async (request) => ({ alerts: await hy.saveAlerts(parse(alertsInput, request.body), actorOf(request)) }));
  app.post('/wa', user, async (request) => {
    const { to, body, byName } = parse(waSendInput, request.body);
    return { id: await hy.queue(to, body, byName, actorOf(request)) };
  });
}
