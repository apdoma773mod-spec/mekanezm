import type { FastifyInstance } from 'fastify';
import type { PayMethod, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { actorOf, type Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dayToDate } from '../../lib/dates.js';
import { badRequest } from '../../lib/errors.js';
import { D } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';
import { parse } from '../../lib/validate.js';
import { createInvoiceInTx } from '../invoices/service.js';

/**
 * 📥 استيراد يومية Excel (mk_import_invoices القديمة): كل الفواتير في transaction واحدة — تتسجل كلها أو ولا واحدة.
 * الفاتورة هي اللي بتخصم من المخزون، وبتتكتب كمان صفوف مصفّاة في اليومية بتاريخ اليومية (علامة «يومية استيراد Excel»)
 * من غير ما تلمس المخزون تاني. الملف اللي اتستورد قبل كده بتتسجل بصمته عشان مايتكررش.
 */
const LOG_KEY = 'imp_daily_log';
const NOTE = 'يومية استيراد Excel';

const importInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sig: z.string().max(80).default(''),
  force: z.boolean().default(false),
  invoices: z
    .array(
      z.object({
        person: z.string().trim().max(120).default(''),
        noContact: z.boolean().default(false),
        paid: z.number().min(0).default(0),
        note: z.string().trim().max(1000).default(''),
        items: z
          .array(
            z.object({
              productId: z.string().max(64).optional(),
              name: z.string().trim().min(1).max(200),
              qty: z.number().gt(0),
              price: z.number().min(0),
              pay: z.enum(['cash', 'credit']).default('cash'),
              /** paid, but not into the drawer («انستا» / «تحويل» in the sheet's طريقة الدفع column) */
              via: z.enum(['INSTAPAY', 'TRANSFER']).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(300),
});
export type DaybookImportInput = z.infer<typeof importInput>;

/**
 * How the invoice's paid amount divides between the drawer, InstaPay and transfers — from its own lines.
 * Only when the lines account for the whole paid amount; otherwise it is all cash, as before.
 */
function splitOfImport(inv: DaybookImportInput['invoices'][number]): { main: PayMethod; split?: Partial<Record<PayMethod, number>> } {
  const by: Partial<Record<PayMethod, number>> = {};
  for (const l of inv.items) {
    if (l.pay === 'credit') continue;
    const m: PayMethod = l.via ?? 'CASH';
    by[m] = (by[m] ?? 0) + l.qty * l.price;
  }
  const parts = (Object.entries(by) as [PayMethod, number][]).map(([m, v]) => [m, Math.round(v * 100) / 100] as [PayMethod, number]).filter(([, v]) => v > 0);
  if (!parts.some(([m]) => m !== 'CASH')) return { main: 'CASH' };
  parts.sort((a, b) => b[1] - a[1]);
  const diff = Math.round((inv.paid - parts.reduce((s, [, v]) => s + v, 0)) * 100) / 100;
  if (Math.abs(diff) > 0.05) return { main: 'CASH' };
  parts[0]![1] = Math.round((parts[0]![1] + diff) * 100) / 100;
  return { main: parts[0]![0], ...(parts.length > 1 ? { split: Object.fromEntries(parts) } : {}) };
}

interface LogRow {
  sig: string;
  at: string;
  iso: string;
  n: number;
  tot: number;
}

export async function importDay(db: PrismaClient, input: DaybookImportInput, actor: Actor) {
  const logRow = await db.setting.findUnique({ where: { key: LOG_KEY } });
  const log: LogRow[] = Array.isArray(logRow?.value) ? (logRow!.value as unknown as LogRow[]) : [];
  const seen = input.sig ? log.find((x) => x.sig === input.sig) : undefined;
  if (seen && !input.force) {
    throw badRequest(`الملف ده اتستورد قبل كده (${seen.at.slice(0, 16).replace('T', ' ')} — ${seen.n} فاتورة).`);
  }

  const out = await withTx(db, async (tx) => {
    const made: { id: string; no: string }[] = [];
    for (const [i, inv] of input.invoices.entries()) {
      try {
        const { main, split } = splitOfImport(inv);
        const id = await createInvoiceInTx(
          tx,
          {
            kind: 'SALE',
            company: 'MK',
            date: input.date,
            person: inv.noContact ? '' : inv.person || 'يومية',
            phone: '',
            address: '',
            note: inv.note,
            shipping: 0,
            discount: 0,
            paid: inv.paid,
            payMethod: main,
            items: inv.items.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price })),
          },
          actor,
          { source: 'IMPORT', noContact: inv.noContact, ...(split ? { paidSplit: split } : {}) },
        );
        const row = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { no: true } });
        const who = inv.noContact ? '' : inv.person.trim();
        for (const l of inv.items) {
          const productId = l.productId ?? (await tx.product.findFirst({ where: { name: l.name }, select: { id: true } }))?.id ?? null;
          await tx.daybookEntry.create({
            data: {
              day: dayToDate(input.date),
              kind: 'ITEM',
              productId,
              name: l.name,
              qty: D(l.qty),
              price: D(l.price),
              owed: D(0),
              person: who,
              pay: l.pay === 'credit' ? 'CREDIT' : (l.via ?? 'CASH'),
              note: NOTE,
              stockOut: D(l.qty),
              createdById: actor.id,
              postedAt: new Date(),
              invoiceId: id,
            },
          });
        }
        made.push({ id, no: row.no });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw badRequest(`فاتورة ${i + 1} (${inv.person || 'يومية'}): ${msg}`);
      }
    }
    await writeAudit(tx, { userId: actor.id, action: 'DAYBOOK_POST', entity: 'DaybookImport', entityId: input.date, after: { invoices: made.map((m) => m.no) }, ip: actor.ip });
    return made;
  });

  if (input.sig) {
    const tot = input.invoices.reduce((a, v) => a + v.items.reduce((b, l) => b + l.qty * l.price, 0), 0);
    const next = [{ sig: input.sig, at: new Date().toISOString(), iso: input.date, n: out.length, tot }, ...log].slice(0, 200);
    await db.setting.upsert({ where: { key: LOG_KEY }, create: { key: LOG_KEY, value: next as object }, update: { value: next as object } });
  }
  return out;
}

export async function daybookImportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAdmin);

  /** Has this file's fingerprint been imported before? (the screen warns before sending) */
  app.get('/seen', async (request) => {
    const { sig } = z.object({ sig: z.string().max(80) }).parse(request.query);
    const row = await app.prisma.setting.findUnique({ where: { key: LOG_KEY } });
    const log: LogRow[] = Array.isArray(row?.value) ? (row!.value as unknown as LogRow[]) : [];
    return { seen: log.find((x) => x.sig === sig) ?? null };
  });

  app.post('/', async (request) => {
    const input = parse(importInput, request.body);
    return { invoices: await importDay(app.prisma, input, actorOf(request)) };
  });
}


