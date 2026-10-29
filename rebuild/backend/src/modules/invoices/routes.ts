import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParam, invoiceInput, listInvoicesQuery, updateInvoiceInput, voidInvoiceInput } from '@mk/shared';
import type { Prisma } from '@prisma/client';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { parse } from '../../lib/validate.js';
import { InvoicesService } from './service.js';

export default async function invoicesRoutes(app: FastifyInstance) {
  const service = new InvoicesService(app.prisma);

  // Like the old system: staff create and view invoices; editing and voiding are for admins.
  app.get('/', { preHandler: app.authenticate }, async (request) => service.list(parse(listInvoicesQuery, request.query)));

  app.get('/persons', { preHandler: app.authenticate }, async (request) => {
    const q = parse(z.object({ kind: z.enum(['SALE', 'PURCHASE']).default('PURCHASE'), company: z.enum(['MK', 'HY']).optional() }), request.query);
    return { persons: await service.persons(q.kind, q.company) };
  });

  app.post('/check-duplicate', { preHandler: app.authenticate }, async (request) => {
    const b = parse(z.object({ person: z.string().trim().min(1).max(120), total: z.number().gt(0), sno: z.string().trim().max(60).optional() }), request.body);
    return { duplicate: await service.duplicate(b) };
  });

  app.get('/:id/cost-change', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { items: await service.costChange(id) };
  });

  app.post('/:id/apply-cost', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { updated: await service.applyCost(id, actorOf(request)) };
  });

  // 📦 استلام وناقص (mk_settings.inv_notes القديمة): ملاحظة لكل فاتورة بيع بتظهر في ملف العميل وفي «البضاعة الفاضلة».
  const NOTES_KEY = 'inv_notes';
  const note = z.object({
    recv: z.string().trim().max(40).default(''),
    miss: z.string().trim().max(2000).default(''),
    gotDate: z.string().trim().max(40).default(''),
    got: z.string().trim().max(2000).default(''),
  });
  type Note = z.infer<typeof note>;
  const readNotes = async () => ((await app.prisma.setting.findUnique({ where: { key: NOTES_KEY } }))?.value ?? {}) as Record<string, Note>;

  app.get('/notes', { preHandler: app.authenticate }, async (request) => {
    const q = parse(z.object({ person: z.string().trim().max(120).optional(), missing: z.enum(['true', 'false']).optional() }), request.query);
    const notes = await readNotes();
    const nos = Object.keys(notes);
    const invs = nos.length
      ? await app.prisma.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', no: { in: nos }, ...(q.person ? { person: q.person } : {}) }, select: { id: true, no: true, person: true, date: true, total: true, contactId: true } })
      : [];
    const items = invs
      .map((i) => ({ id: i.id, no: i.no, person: i.person, contactId: i.contactId, date: i.date.toISOString().slice(0, 10), total: Number(i.total), ...notes[i.no]! }))
      .filter((i) => q.missing !== 'true' || i.miss);
    return { items };
  });

  app.put('/notes/:no', { preHandler: app.authenticate }, async (request) => {
    const { no } = parse(z.object({ no: z.string().min(1).max(40) }), request.params);
    const body = parse(note, request.body);
    const actor = actorOf(request);
    const notes = await readNotes();
    if (body.recv || body.miss || body.gotDate || body.got) notes[no] = body;
    else delete notes[no];
    await app.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: NOTES_KEY },
        create: { key: NOTES_KEY, value: notes as unknown as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: notes as unknown as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: NOTES_KEY, ip: actor.ip });
    });
    return { ok: true };
  });

  app.get('/:id', { preHandler: app.authenticate }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.get(id, actorOf(request)) };
  });

  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const invoice = await service.create(parse(invoiceInput, request.body), actorOf(request));
    return reply.status(201).send({ invoice });
  });

  app.put('/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.update(id, parse(updateInvoiceInput, request.body), actorOf(request)) };
  });

  app.post('/:id/void', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return { invoice: await service.void(id, parse(voidInvoiceInput, request.body), actorOf(request)) };
  });
}
