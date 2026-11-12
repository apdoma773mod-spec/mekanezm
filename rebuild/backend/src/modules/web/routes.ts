import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { putFile } from '../../lib/files.js';
import { parse } from '../../lib/validate.js';
import { catalogAiRoutes } from './catalog-ai.js';
import { kindOfRequest, pingOwner, SUB_PREFIX } from './events.js';
import { dropLiveCatalog, liveCatalog } from './catalog-live.js';


/**
 * «🌐 الموقع»: orders sent from the public shop page (web_orders) and the site's own content
 * (sections, products shown, works, reviews, delivery…, the old site_content row) kept as one versioned document.
 */
const SITE_KEY = 'site_content';
/** The owner's personal number and the two shop numbers (international form, as the bridge wants them). */

const orderBody = z.object({
  customerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).default(''),
  items: z
    .array(z.object({ code: z.string().trim().min(1).max(40), qty: z.number().gt(0).max(100000), backorder: z.boolean().optional() }))
    .min(1)
    .max(100),
  ship: z
    .object({
      method: z.enum(['pickup', 'delivery', 'ship']),
      gov: z.string().trim().max(60).default(''),
      area: z.string().trim().max(120).default(''),
      address: z.string().trim().max(300).default(''),
    })
    .optional(),
});
const patchBody = z.object({
  status: z.enum(['new', 'done', 'cancelled']).optional(),
  eta: z.string().trim().max(200).optional(),
  invoiceNo: z.string().trim().max(40).nullable().optional(),
});
const idParam = z.object({ id: z.string().min(1).max(64) });

interface SiteDoc {
  data: Record<string, unknown>;
  version: number;
}
const EMPTY: SiteDoc = { data: { theme: {}, sections: [], products: [] }, version: 0 };

export default async function webRoutes(app: FastifyInstance) {
  const db = app.prisma;
  await catalogAiRoutes(app);
  const readSite = async (): Promise<SiteDoc> => {
    const row = await db.setting.findUnique({ where: { key: SITE_KEY } });
    const v = row?.value as unknown as SiteDoc | null;
    return v && typeof v === 'object' && v.data ? v : EMPTY;
  };

  // ---- public (the shop page): what to show, and where orders go ----
  /** صور اترفعت من السيستم بتتخزن بعنوان ناقص (/api/v1/work/files/…) والموقع على دومين تاني مايعرفهوش: بنكمّله لعنوان كامل بيعدّي على السيرفر. */
  const FILES_BASE = (process.env.PUBLIC_FILES_BASE || 'https://mekanezm-admin.vercel.app').replace(/\/$/, '');
  const absFiles = <T,>(v: T): T => JSON.parse(JSON.stringify(v).replace(/"\/api\/v1\/work\/files\//g, `"${FILES_BASE}/api/v1/work/files/`)) as T;
  app.get('/public/site', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async () => ({ site: absFiles(await readSite()) }));

  /** 📖 Published catalogs: the system saves the finished pages (book + printable), anyone with the link can open them (random id, not guessable, not indexed). `current` = the one the site's «الكتالوج» button opens. */
  const CAT = 'catalog_pub_';
  const CAT_CURRENT = 'catalog_current';
  const catHeaders = (reply: import('fastify').FastifyReply, modals: boolean) =>
    reply
      .header('content-type', 'text/html; charset=utf-8')
      .header('content-security-policy', `sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox${modals ? ' allow-modals' : ''}`)
      .header('x-robots-tag', 'noindex, nofollow')
      .header('cache-control', 'public, max-age=120');
  app.post('/catalog', { preHandler: app.requireAdmin, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const { html, print, current } = parse(z.object({ html: z.string().min(100).max(5_000_000), print: z.string().max(5_000_000).default(''), current: z.boolean().default(false) }), request.body);
    const id = randomBytes(9).toString('base64url');
    const actor = actorOf(request);
    await db.setting.create({ data: { key: CAT + id, value: { html, print } as unknown as Prisma.InputJsonValue, updatedById: actor.id } });
    if (current) await db.setting.upsert({ where: { key: CAT_CURRENT }, create: { key: CAT_CURRENT, value: { id }, updatedById: actor.id }, update: { value: { id }, updatedById: actor.id } });
    const keep = new Set<string>([CAT + id]);
    const cur = (await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null;
    if (cur?.id) keep.add(CAT + cur.id);
    const old = await db.setting.findMany({ where: { key: { startsWith: CAT } }, orderBy: { updatedAt: 'desc' }, skip: 30, select: { key: true } });
    const drop = old.map((o) => o.key).filter((k) => !keep.has(k));
    if (drop.length) await db.setting.deleteMany({ where: { key: { in: drop } } });
    return { id, current };
  });
  app.get('/catalog/current', { preHandler: app.requireAdmin }, async () => ({ current: ((await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null)?.id ?? null }));
  app.delete('/catalog/current', { preHandler: app.requireAdmin }, async () => {
    await db.setting.deleteMany({ where: { key: CAT_CURRENT } });
    return { ok: true };
  });
  const idParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/) });

  /** 🗂️ the published catalogs, newest first */
  app.get('/catalog/list', { preHandler: app.requireAdmin }, async () => {
    const cur = ((await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null)?.id ?? null;
    const rows = await db.setting.findMany({ where: { key: { startsWith: CAT } }, orderBy: { updatedAt: 'desc' }, select: { key: true, updatedAt: true } });
    return { items: rows.map((r) => ({ id: r.key.slice(CAT.length), at: r.updatedAt.toISOString(), current: r.key === CAT + cur })) };
  });
  app.delete('/catalog/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.params);
    await db.setting.deleteMany({ where: { key: CAT + id } });
    const cur = ((await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null)?.id;
    if (cur === id) await db.setting.deleteMany({ where: { key: CAT_CURRENT } });
    return { ok: true };
  });
  app.put('/catalog/current', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParams, request.body);
    const actor = actorOf(request);
    if (!(await db.setting.findUnique({ where: { key: CAT + id } }))) throw notFound('الكتالوج ده مش موجود');
    await db.setting.upsert({ where: { key: CAT_CURRENT }, create: { key: CAT_CURRENT, value: { id }, updatedById: actor.id }, update: { value: { id }, updatedById: actor.id } });
    return { ok: true };
  });

  /** 📊 what customers do inside the catalog: counted in memory, written every minute (no row per click) */
  const STATS = 'catalog_stats';
  type Stats = { days: Record<string, Record<string, number>>; views: Record<string, number>; adds: Record<string, number>; q: Record<string, number> };
  const pend: Stats = { days: {}, views: {}, adds: {}, q: {} };
  let dirty = false;
  const bump = (m: Record<string, number>, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);
  const trim = (m: Record<string, number>, keep: number) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, keep));
  const flush = async () => {
    if (!dirty) return;
    dirty = false;
    const cur = ((await db.setting.findUnique({ where: { key: STATS } }))?.value as Stats | undefined) ?? { days: {}, views: {}, adds: {}, q: {} };
    for (const [d, m] of Object.entries(pend.days)) for (const [k, n] of Object.entries(m)) bump((cur.days[d] ??= {}), k, n);
    for (const k of ['views', 'adds', 'q'] as const) for (const [c, n] of Object.entries(pend[k])) bump(cur[k], c, n);
    pend.days = {};
    pend.views = {};
    pend.adds = {};
    pend.q = {};
    const days = Object.keys(cur.days).sort().slice(-60);
    const out: Stats = { days: Object.fromEntries(days.map((d) => [d, cur.days[d]!])), views: trim(cur.views, 300), adds: trim(cur.adds, 300), q: trim(cur.q, 200) };
    await db.setting.upsert({ where: { key: STATS }, create: { key: STATS, value: out as unknown as Prisma.InputJsonValue }, update: { value: out as unknown as Prisma.InputJsonValue } });
  };
  const timer = setInterval(() => void flush().catch((e) => app.log.warn({ err: e }, 'catalog stats flush')), 60_000);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    await flush().catch(() => {});
  });
  app.post('/public/catalog/hit', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } }, bodyLimit: 4096 }, async (request, reply) => {
    // the catalog page lives in a sandboxed frame: its beacon reply must be readable cross-origin
    void reply.header('cross-origin-resource-policy', 'cross-origin');
    let b: unknown = request.body;
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch {
        return { ok: false };
      }
    }
    const h = z.object({ ev: z.enum(['open', 'view', 'add', 'cart', 'q', 'zoom']), c: z.string().max(300).optional(), q: z.string().max(40).optional(), n: z.number().optional() }).safeParse(b);
    if (!h.success) return { ok: false };
    const day = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
    bump((pend.days[day] ??= {}), h.data.ev);
    if (h.data.ev === 'view' && h.data.c) bump(pend.views, h.data.c.slice(0, 40));
    if (h.data.ev === 'add' && h.data.c) bump(pend.adds, h.data.c.slice(0, 40));
    if (h.data.ev === 'q' && h.data.q) bump(pend.q, h.data.q.trim().toLowerCase());
    dirty = true;
    return { ok: true };
  });
  app.get('/catalog/stats', { preHandler: app.requireAdmin }, async () => {
    await flush();
    return { stats: ((await db.setting.findUnique({ where: { key: STATS } }))?.value as Stats | undefined) ?? { days: {}, views: {}, adds: {}, q: {} } };
  });
  /** Pictures are cached for a year by the phone: a copy cached while the server still blocked them (cross-origin) stays blocked. A new address makes the phone ask again. */
  const fresh = (html: string) => html.replace(/(\/api\/v1\/work\/files\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp))(?![?\w])/g, '$1?v=2');
  const catRow = async (id: string) => (await db.setting.findUnique({ where: { key: CAT + id } }))?.value as { html?: string; print?: string } | undefined;
  app.get('/public/catalog/:id', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const html = (await catRow(id))?.html;
    if (!html) throw notFound('الكتالوج ده مش موجود');
    return catHeaders(reply, false).send(fresh(html).replaceAll('__PDF__', `${id}/print`).replaceAll('__HIT__', 'hit'));
  });
  /** The same catalog laid out page after page, opens the browser's print box (save as PDF). */
  app.get('/public/catalog/:id/print', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const html = (await catRow(id))?.print;
    if (!html) throw notFound('الكتالوج ده مش موجود');
    return catHeaders(reply, true).send(fresh(html));
  });
  /** The site's button: always the catalog the owner marked as current. */
  app.get('/public/catalog-latest', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    void request;
    // الكتالوج اللي على الموقع بيتبني على السيرفر من آخر إعدادات ومنتجات (دايمًا محدّث). لو حصل خطأ: آخر نسخة اتنشرت
    try {
      return catHeaders(reply, false).header('cache-control', 'public, max-age=60').send(fresh(await liveCatalog(db, 'book', { pdfUrl: 'catalog-latest/print', hitUrl: 'catalog/hit' })));
    } catch (e) {
      request.log.error(e, 'live catalog failed');
    }
    const id = ((await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null)?.id;
    if (!id) throw notFound('مفيش كتالوج منشور حاليًا');
    const row = await catRow(id);
    if (!row?.html) throw notFound('مفيش كتالوج منشور حاليًا');
    return catHeaders(reply, false).header('cache-control', 'public, max-age=60').send(fresh(row.html).replaceAll('__PDF__', 'catalog-latest/print').replaceAll('__HIT__', 'catalog/hit'));
  });
  app.get('/public/catalog-latest/print', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_request, reply) => {
    try {
      return catHeaders(reply, true).header('cache-control', 'public, max-age=60').send(fresh(await liveCatalog(db, 'print', { pdfUrl: '', hitUrl: '' })));
    } catch (e) {
      _request.log.error(e, 'live catalog print failed');
    }
    const id = ((await db.setting.findUnique({ where: { key: CAT_CURRENT } }))?.value as { id?: string } | null)?.id;
    const html = id ? (await catRow(id))?.print : '';
    if (!html) throw notFound('مفيش كتالوج منشور حاليًا');
    return catHeaders(reply, true).header('cache-control', 'public, max-age=60').send(fresh(html));
  });

  app.post('/public/orders', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(orderBody, request.body);
    const o = await db.webOrder.create({ data: { customerName: b.customerName, phone: b.phone, items: b.items as Prisma.InputJsonValue, ship: b.ship as Prisma.InputJsonValue | undefined } });
    void notifyNewOrder(o.id, b);
    return { id: o.id, no: o.id.slice(0, 8) };
  });

  /**
   * Every site order also goes to the owner's WhatsApp numbers from the shop's own WhatsApp (the bridge): the personal number and the two
   * shop numbers by default. The list lives in Setting `web_order_notify` ({ on, to }) so it can change without a new version.
   */
  async function notifyNewOrder(id: string, b: z.infer<typeof orderBody>) {
    try {
      const names = new Map((await db.product.findMany({ where: { code: { in: b.items.map((i) => i.code) } }, select: { code: true, name: true } })).map((p) => [p.code, p.name]));
      const how = { pickup: '🏪 هيستلم من المحل', delivery: '🛵 توصيل', ship: '📦 شحن' } as const;
      const lines = b.items.map((i) => `• ${names.get(i.code) ?? i.code} (كود ${i.code}) × ${i.qty}${i.backorder ? ' — بالحجز' : ''}`);
      await pingOwner(db, 'order', [
        `رقم الطلب: ${id.slice(0, 8)}`,
        `الاسم: ${b.customerName}`,
        b.phone ? `الموبايل: ${b.phone}` : '',
        ...lines,
        b.ship ? `${how[b.ship.method]}${b.ship.gov ? ' — ' + b.ship.gov : ''}${b.ship.address ? ' — ' + b.ship.address : ''}` : '',
      ]);
    } catch {
      /* the order is saved either way */
    }
  }

  // ---- admin ----
  app.get('/orders', { preHandler: app.requireAdmin }, async () => {
    const rows = await db.webOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return { items: rows };
  });

  /** «🗑️ مسح الملغي»: cancelled orders go for good; new ones and the ones made into invoices stay. */
  app.post('/orders/purge-cancelled', { preHandler: app.requireAdmin }, async () => {
    const r = await db.webOrder.deleteMany({ where: { status: 'cancelled' } });
    return { count: r.count };
  });

  app.get('/orders/count', { preHandler: app.requireAdmin }, async () => ({ count: await db.webOrder.count({ where: { status: 'new' } }) }));

  app.patch('/orders/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const b = parse(patchBody, request.body);
    const cur = await db.webOrder.findUnique({ where: { id } });
    if (!cur) throw notFound('الطلب مش موجود');
    const data: Prisma.WebOrderUpdateInput = {};
    if (b.status) {
      data.status = b.status;
      data.handledAt = new Date();
    }
    if (b.eta !== undefined) {
      data.eta = b.eta;
      data.repliedAt = new Date();
    }
    if (b.invoiceNo !== undefined) data.invoiceNo = b.invoiceNo;
    const actor = actorOf(request);
    const row = await db.$transaction(async (tx) => {
      const r = await tx.webOrder.update({ where: { id }, data });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'WebOrder', entityId: id, before: { status: cur.status }, after: { status: r.status, eta: r.eta, invoiceNo: r.invoiceNo }, ip: actor.ip });
      return r;
    });
    return { order: row };
  });

  // ---- 📷 طلبات بالصور (public) ----
  app.post('/public/media', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const { data, ext } = parse(z.object({ data: z.string().min(10), ext: z.enum(['jpg', 'jpeg', 'png', 'webp']).default('jpg') }), request.body);
    const buf = Buffer.from(data.includes(',') ? data.slice(data.indexOf(',') + 1) : data, 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) throw badRequest('الصورة كبيرة أو فاضية');
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await putFile(name, buf, 'image/' + (ext === 'jpg' ? 'jpeg' : ext));
    return { url: `/api/v1/work/files/${name}` };
  });

  const fileUrl = z.string().max(300).regex(/^(\/api\/v1\/work\/files\/[a-z0-9-]+\.(jpg|jpeg|png|webp)|https:\/\/[^\s]+)$/);
  app.post('/public/requests', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30).default(''), imgs: z.array(fileUrl).max(8).default([]), note: z.string().trim().max(1500).default('') }), request.body);
    if (!b.imgs.length && !b.note) throw badRequest('ابعت صورة أو اكتب وصف');
    const r = await db.webRequest.create({ data: { name: b.name, phone: b.phone, imgs: b.imgs as Prisma.InputJsonValue, note: b.note } });
    void pingOwner(db, kindOfRequest(b.note), [`الاسم: ${b.name}`, b.phone ? `الموبايل: ${b.phone}` : '', b.imgs.length ? `📷 ${b.imgs.length} صورة` : '', b.note ? b.note.slice(0, 300) : '']);
    return { id: r.id };
  });

  app.post('/public/custom', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(30).default(''), kind: z.enum(['steel', 'bamboo', 'delf']), summary: z.string().trim().max(2000).default(''), note: z.string().trim().max(1500).default(''), img: fileUrl.or(z.literal('')).default(''), spec: z.record(z.unknown()).default({}) }), request.body);
    const r = await db.webCustom.create({ data: { ...b, spec: b.spec as Prisma.InputJsonValue } });
    void pingOwner(db, 'custom', [`الاسم: ${b.name}`, b.phone ? `الموبايل: ${b.phone}` : '', b.summary ? b.summary.slice(0, 300) : '']);
    return { id: r.id };
  });

  // ---- admin: photo requests and custom orders ----
  app.get('/counts', { preHandler: app.requireAdmin }, async () => {
    // «اشتراك في جديد الواتساب» مش طلب منتج بالصور: بيتعدّ لوحده (subs) عشان التنبيه يكون صح
    const sub = { startsWith: SUB_PREFIX };
    const kv = async (key: string) => { const v = (await db.setting.findUnique({ where: { key } }))?.value; return Array.isArray(v) ? v.length : 0; };
    const [orders, requests, subs, custom, reviews, waits] = await Promise.all([
      db.webOrder.count({ where: { status: 'new' } }),
      db.webRequest.count({ where: { status: 'new', NOT: { note: sub } } }),
      db.webRequest.count({ where: { status: 'new', note: sub } }),
      db.webCustom.count({ where: { status: 'new' } }),
      kv('web_reviews'),
      kv('web_notify'),
    ]);
    return { orders, requests, subs, custom, reviews, waits };
  });

  app.get('/requests', { preHandler: app.requireAdmin }, async () => ({ items: await db.webRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) }));
  app.patch('/requests/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const b = parse(z.object({ status: z.enum(['new', 'replied', 'closed']).optional(), reply: z.string().trim().max(1000).optional() }), request.body);
    const cur = await db.webRequest.findUnique({ where: { id } });
    if (!cur) throw notFound('الطلب مش موجود');
    const actor = actorOf(request);
    const who = (await db.user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name ?? '';
    const row = await db.webRequest.update({ where: { id }, data: { ...(b.status ? { status: b.status } : {}), ...(b.reply !== undefined ? { reply: b.reply, repliedAt: new Date(), repliedBy: who, status: b.status ?? 'replied' } : {}) } });
    return { request: row };
  });

  app.get('/custom', { preHandler: app.requireAdmin }, async () => ({ items: await db.webCustom.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) }));
  app.patch('/custom/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { status } = parse(z.object({ status: z.enum(['new', 'opened', 'closed', 'cancelled']) }), request.body);
    if (!(await db.webCustom.findUnique({ where: { id }, select: { id: true } }))) throw notFound('الطلب مش موجود');
    return { custom: await db.webCustom.update({ where: { id }, data: { status } }) };
  });

  app.get('/site', { preHandler: app.requireAdmin }, async () => ({ site: await readSite() }));

  /** Save with the version the editor loaded: if someone else saved first the editor reloads and tries again. */
  app.put('/site', { preHandler: app.requireAdmin, bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    const { data, version } = parse(z.object({ data: z.record(z.unknown()), version: z.number().int().min(0) }), request.body);
    const actor = actorOf(request);
    const next = await db.$transaction(async (tx) => {
      const row = await tx.setting.findUnique({ where: { key: SITE_KEY } });
      const cur = (row?.value as unknown as SiteDoc | undefined)?.version ?? 0;
      if (cur !== version) throw conflict('في تعديل تاني على الموقع في نفس اللحظة — جرّب تاني');
      const doc: SiteDoc = { data, version: cur + 1 };
      await tx.setting.upsert({
        where: { key: SITE_KEY },
        create: { key: SITE_KEY, value: doc as unknown as Prisma.InputJsonValue, updatedById: actor.id },
        update: { value: doc as unknown as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: SITE_KEY, ip: actor.ip });
      return doc;
    });
    // الكتالوج اللي على الموقع يتبني من جديد بالإعدادات/الصور الجديدة في أول فتحة
    dropLiveCatalog();
    return { site: next };
  });
}
