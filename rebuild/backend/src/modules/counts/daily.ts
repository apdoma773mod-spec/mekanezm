import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { actorOf, isAdmin } from '../../lib/actor.js';
import { badRequest } from '../../lib/errors.js';
import { raiseAlert } from '../../lib/alerts.js';
import { currentUser } from '../../plugins/auth.js';
import { parse } from '../../lib/validate.js';
import { num } from '../../lib/money.js';
import { CountsService } from './service.js';

/**
 * 🧮 الجرد اليومي: كل يوم 10 أصناف (اللي ماتعدّتش من أطول وقت الأول). أي حد يعدّها من غير ما يشوف الرصيد
 * اللي في السيستم؛ لو فيه فرق بيوصل المدير تنبيه، والمدير هو اللي يعتمد تعديل المخزون.
 */
const KEY = 'daily_count';
const SIZE = 10;

interface Answer {
  productId: string;
  counted: number;
}
interface State {
  day: string;
  ids: string[];
  status: 'open' | 'submitted' | 'approved';
  answers: Answer[];
  by?: string;
  at?: string;
  approvedBy?: string;
  /** last day each product was counted */
  last: Record<string, string>;
}

const today = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10); // Cairo day (UTC+2 is close enough for a day key)
const seed = (day: string, id: string) => createHash('md5').update(day + id).digest('hex');

async function read(db: PrismaClient): Promise<State> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return { day: '', ids: [], status: 'open', answers: [], last: {}, ...((row?.value as Partial<State> | null) ?? {}) };
}
const write = (db: PrismaClient, s: State) => db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: s as never }, update: { value: s as never } });

/** Today's list: products with stock, never/longest-ago counted first, a fixed shuffle per day so the list does not change on reload. */
async function ensureToday(db: PrismaClient): Promise<State> {
  const d = today();
  const s = await read(db);
  // a list made while the shop had few products is topped up (only while nobody has counted yet)
  if (s.day === d && s.ids.length && (s.ids.length >= SIZE || s.status !== 'open')) return s;
  const prods = await db.product.findMany({ where: { deletedAt: null, qty: { gt: 0 } }, select: { id: true } });
  const ids = prods
    .map((p) => p.id)
    .sort((a, b) => (s.last[a] ?? '').localeCompare(s.last[b] ?? '') || seed(d, a).localeCompare(seed(d, b)))
    .slice(0, SIZE);
  const next: State = { ...s, day: d, ids, status: 'open', answers: [], by: undefined, at: undefined, approvedBy: undefined };
  await write(db, next);
  return next;
}

async function view(db: PrismaClient, s: State, admin: boolean) {
  const prods = await db.product.findMany({ where: { id: { in: s.ids } }, select: { id: true, code: true, name: true, unit: true, qty: true, cost: true } });
  const by = new Map(prods.map((p) => [p.id, p]));
  const ans = new Map(s.answers.map((a) => [a.productId, a.counted]));
  const items = s.ids
    .map((id) => by.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      counted: ans.get(p.id) ?? null,
      // the system quantity is hidden from whoever counts; the owner sees it with the difference
      ...(admin ? { system: num(p.qty), diff: ans.has(p.id) ? Math.round((ans.get(p.id)! - num(p.qty)) * 1000) / 1000 : null, cost: num(p.cost) } : {}),
    }));
  return { day: s.day, status: s.status, by: s.by ?? null, at: s.at ?? null, approvedBy: s.approvedBy ?? null, items };
}

export default async function dailyCountRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => view(db, await ensureToday(db), isAdmin(actorOf(request))));

  app.post('/', async (request) => {
    const { answers } = parse(z.object({ answers: z.array(z.object({ productId: z.string().max(64), counted: z.number().min(0).max(1e7) })).min(1).max(SIZE) }), request.body);
    const s = await ensureToday(db);
    if (s.status === 'approved') throw badRequest('جرد النهاردة اتقفل خلاص');
    const ok = answers.filter((a) => s.ids.includes(a.productId));
    if (ok.length < s.ids.length) throw badRequest('اعدّ كل الأصناف العشرة الأول');
    const me = currentUser(request);
    const next: State = { ...s, status: 'submitted', answers: ok, by: me.name, at: new Date().toISOString() };
    await write(db, next);
    const v = await view(db, next, true);
    const diffs = v.items.filter((i) => i.diff);
    if (diffs.length) {
      await raiseAlert(
        db,
        'count',
        `🧮 الجرد اليومي (${me.name}): ${diffs.length} صنف من ${v.items.length} فيهم فرق\n${diffs.slice(0, 6).map((i) => `• ${i.name}: السيستم ${i.system} والعدّ ${i.counted} (${i.diff! > 0 ? '+' : ''}${i.diff})`).join('\n')}`,
        actorOf(request),
      );
    }
    return view(db, next, isAdmin(actorOf(request)));
  });

  /** The owner approves: counted quantities become the stock (a normal JR- count), and these products go to the back of the queue. */
  app.post('/approve', { preHandler: app.requireAdmin }, async (request) => {
    const s = await read(db);
    if (s.status !== 'submitted') throw badRequest('مفيش جرد مستني اعتماد');
    const items = s.answers;
    await new CountsService(db).create({ items: items.map((a) => ({ productId: a.productId, counted: a.counted })), note: 'جرد يومي' }, actorOf(request));
    const last = { ...s.last };
    for (const a of items) last[a.productId] = s.day;
    const next: State = { ...s, status: 'approved', last, approvedBy: currentUser(request).name };
    await write(db, next);
    return view(db, next, true);
  });

  /** No difference (or the owner decides to leave the stock as it is): close the day without changing the stock. */
  app.post('/close', { preHandler: app.requireAdmin }, async (request) => {
    const s = await read(db);
    if (s.status !== 'submitted') throw badRequest('مفيش جرد مستني اعتماد');
    const last = { ...s.last };
    for (const a of s.answers) last[a.productId] = s.day;
    const next: State = { ...s, status: 'approved', last, approvedBy: currentUser(request).name };
    await write(db, next);
    return view(db, next, true);
  });
}
