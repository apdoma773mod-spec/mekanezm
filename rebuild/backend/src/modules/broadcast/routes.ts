import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { actorName } from '../../lib/names.js';
import { parse } from '../../lib/validate.js';
import {
  BC_PREFIX,
  HISTORY_KEY,
  MAX_RECIPIENTS,
  STOP_LINE,
  etaMinutes,
  getHistory,
  getLimits,
  getOptout,
  last10,
  mobileOf,
  setOptout,
  type BroadcastMeta,
} from './lib.js';

/**
 * 📣 إعلان لكل العملاء (أو المشتركين) بضغطة واحدة من السيستم، من غير ما تفتح الواتساب وتختار حد.
 * للمدير بس. الإرسال الفعلي بيحصل من جسر واتساب جهاز المحل (لازم يكون شغال)، واحدة واحدة بفاصل زمني.
 */
type Audience = 'customers' | 'subscribers' | 'both';
const sendBody = z.object({
  id: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  text: z.string().trim().min(5, 'اكتب الإعلان الأول').max(1000, 'الإعلان طويل (أقصاه ١٠٠٠ حرف)'),
  audience: z.enum(['customers', 'subscribers', 'both']),
});
const idp = z.object({ id: z.string().min(1).max(64) });
const phoneBody = z.object({ phone: z.string().trim().min(5).max(30) });

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? '';

/** كل اللي هيوصلهم إعلان دلوقتي: أرقام صالحة، من غير تكرار، من غير اللي طلب إلغاء. */
async function recipients(app: FastifyInstance, audience: Audience) {
  const db = app.prisma;
  const opt = new Set(await getOptout(db));
  const out = new Map<string, { phone: string; name: string }>();
  let noPhone = 0;
  let optedOut = 0;
  const add = (rawPhone: string, name: string) => {
    const phone = mobileOf(rawPhone);
    if (!phone) return void (noPhone += 1);
    const k = last10(phone);
    if (opt.has(k)) return void (optedOut += 1);
    if (!out.has(k)) out.set(k, { phone, name });
  };
  const counts = { customers: 0, subscribers: 0 };
  if (audience === 'customers' || audience === 'both') {
    const rows = await db.contact.findMany({ where: { type: 'CUSTOMER', deletedAt: null }, select: { name: true, phone: true }, orderBy: { createdAt: 'asc' } });
    for (const c of rows) {
      const before = out.size;
      add(c.phone, c.name);
      counts.customers += out.size - before;
    }
  }
  if (audience === 'subscribers' || audience === 'both') {
    // مشترك واحد لكل رقم (آخر طلب ليه)، والملغي (مقفول) مش بيوصله إعلان
    const rows = await db.webRequest.findMany({ where: { note: { startsWith: '📣 اشتراك' } }, select: { name: true, phone: true, status: true }, orderBy: { createdAt: 'desc' } });
    const seen = new Set<string>();
    for (const r of rows) {
      const k = last10(r.phone);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      if (r.status === 'closed') continue;
      const before = out.size;
      add(r.phone, r.name);
      counts.subscribers += out.size - before;
    }
  }
  return { list: [...out.values()], noPhone, optedOut, counts };
}

async function summary(app: FastifyInstance, m: BroadcastMeta) {
  const rows = await app.prisma.outboundMessage.groupBy({ by: ['status'], where: { byName: `${BC_PREFIX}${m.id}` }, _count: true });
  const n = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  return { ...m, queued: n('queued'), sent: n('sent'), failed: n('failed') };
}

export default async function broadcastRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  /** كام واحد هيوصله الإعلان لكل اختيار، وقد إيه هياخد. */
  app.get('/audience', async () => {
    const { gapSec, daily } = await getLimits(db);
    const [c, s, both] = await Promise.all([recipients(app, 'customers'), recipients(app, 'subscribers'), recipients(app, 'both')]);
    return {
      customers: c.list.length,
      subscribers: s.list.length,
      both: both.list.length,
      noPhone: c.noPhone,
      optedOut: (await getOptout(db)).length,
      gapSec,
      daily,
      minutes: { customers: etaMinutes(c.list.length, gapSec, daily), subscribers: etaMinutes(s.list.length, gapSec, daily), both: etaMinutes(both.list.length, gapSec, daily) },
    };
  });

  /** بيحط الإعلان في الطابور لكل واحد برسالته (فيها اسمه). نفس الـ id مرتين مايبعتش مرتين. */
  app.post('/send', async (request) => {
    const b = parse(sendBody, request.body);
    const history = await getHistory(db);
    const old = history.find((h) => h.id === b.id);
    if (old) return { ...(await summary(app, old)), duplicate: true };
    const r = await recipients(app, b.audience);
    if (!r.list.length) throw badRequest('مفيش حد يتبعتله بالاختيار ده (كل الأرقام ناقصة أو طالبة إلغاء)');
    if (r.list.length > MAX_RECIPIENTS) throw badRequest(`العدد كبير (${r.list.length}) — أقصى دفعة ${MAX_RECIPIENTS}`);
    const actor = actorOf(request);
    const by = await actorName(db, actor);
    const meta: BroadcastMeta = { id: b.id, at: new Date().toISOString(), by, text: b.text, audience: b.audience, total: r.list.length };
    const tag = `${BC_PREFIX}${b.id}`;
    await db.$transaction(async (tx) => {
      // نسجّل الدفعة الأول: لو الطلب اتكرر بالتوازي التاني يطلع duplicate
      const fresh = ((await tx.setting.findUnique({ where: { key: HISTORY_KEY } }))?.value ?? []) as unknown as BroadcastMeta[];
      if (Array.isArray(fresh) && fresh.some((h) => h.id === b.id)) throw badRequest('الإعلان ده اتبعت قبل كده');
      const value = [meta, ...(Array.isArray(fresh) ? fresh : [])].slice(0, 40) as unknown as object;
      await tx.setting.upsert({ where: { key: HISTORY_KEY }, create: { key: HISTORY_KEY, value }, update: { value } });
      await tx.outboundMessage.createMany({
        data: r.list.map((x) => ({
          toPhone: x.phone,
          body: `${b.text.replaceAll('{الاسم}', firstName(x.name) || 'يا فندم')}\n\n${STOP_LINE}`,
          byName: tag,
        })),
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Broadcast', entityId: b.id, after: { total: r.list.length, audience: b.audience }, ip: actor.ip });
    });
    const { gapSec, daily } = await getLimits(db);
    return { ...(await summary(app, meta)), minutes: etaMinutes(meta.total, gapSec, daily) };
  });

  /** آخر الإعلانات بحالتها. */
  app.get('/', async () => {
    const history = await getHistory(db);
    return { items: await Promise.all(history.slice(0, 15).map((m) => summary(app, m))) };
  });

  /** إعلان واحد بالتفصيل (اللي فشل وليه). */
  app.get('/item/:id', async (request) => {
    const { id } = parse(idp, request.params);
    const m = (await getHistory(db)).find((h) => h.id === id);
    if (!m) throw notFound('الإعلان ده مش موجود');
    const failed = await db.outboundMessage.findMany({ where: { byName: `${BC_PREFIX}${id}`, status: 'failed' }, orderBy: { doneAt: 'desc' }, take: 50, select: { toPhone: true, err: true } });
    return { ...(await summary(app, m)), failures: failed.map((f) => ({ phone: f.toPhone, err: f.err })) };
  });

  /** وقف الإعلان: اللي لسه ماخرجش بيتلغي، واللي اتبعت بالفعل مايتلمسش. */
  app.post('/item/:id/cancel', async (request) => {
    const { id } = parse(idp, request.params);
    const m = (await getHistory(db)).find((h) => h.id === id);
    if (!m) throw notFound('الإعلان ده مش موجود');
    const r = await db.outboundMessage.updateMany({
      where: { byName: `${BC_PREFIX}${id}`, status: 'queued', claimedAt: null },
      data: { status: 'failed', err: 'اتلغى قبل ما يتبعت', doneAt: new Date() },
    });
    return { cancelled: r.count };
  });

  // ── اللي مش عايزين إعلانات
  app.get('/optout', async () => {
    const list = await getOptout(db);
    const contacts = list.length ? await db.contact.findMany({ where: { phone: { not: '' } }, select: { name: true, phone: true } }) : [];
    return { items: list.map((k) => ({ phone: `0${k}`, name: contacts.find((c) => last10(c.phone) === k)?.name ?? '' })) };
  });
  app.post('/optout', async (request) => {
    const { phone } = parse(phoneBody, request.body);
    const m = mobileOf(phone);
    if (!m) throw badRequest('الرقم مش موبايل مصري صالح');
    await setOptout(db, [...(await getOptout(db)), last10(m)]);
    await db.outboundMessage.updateMany({ where: { byName: { startsWith: BC_PREFIX }, status: 'queued', claimedAt: null, toPhone: { endsWith: last10(m) } }, data: { status: 'failed', err: 'العميل طلب إلغاء الإعلانات', doneAt: new Date() } });
    return { ok: true };
  });
  app.delete('/optout/:phone', async (request) => {
    const k = last10(parse(z.object({ phone: z.string().min(5).max(30) }), request.params).phone);
    await setOptout(db, (await getOptout(db)).filter((x) => x !== k));
    return { ok: true };
  });
}
