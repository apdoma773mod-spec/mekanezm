import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { actorOf } from '../../lib/actor.js';

/**
 * The rest of what the public shop page asks the system (the old Supabase RPCs site_stock, track_order, track_custom,
 * list_reviews, add_review, add_notify_me, bump_visit). Everything here is open to visitors, so it only ever returns
 * what the visitor already knows (his own phone number is the key) and never a name, price or cost of ours.
 */
const SITE_KEY = 'site_content';
const REVIEWS_KEY = 'web_reviews'; // visitor reviews waiting for the owner: [{ id, name, rating, body, product, at }]
const NOTIFY_KEY = 'web_notify'; // «ابلغني لما يتوفر»: [{ id, product, pname, name, phone, at }]
const VISITS_KEY = 'web_visits'; // { shop: n, custom: n, story: n, days: { 'YYYY-MM-DD': { shop, custom, story } } }

const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });
const digits = (s: string) => String(s || '').replace(/\D/g, '');
/** Egyptian numbers are written 010…, +2010… or 2010…: compare the last 10 digits. */
const tail = (s: string) => digits(s).slice(-10);

export default async function webPublicRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const getKv = async <T>(key: string, def: T): Promise<T> => ((await db.setting.findUnique({ where: { key } }))?.value as T | undefined) ?? def;
  const putKv = (key: string, value: unknown) =>
    db.setting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });

  /** code → in stock? (what the old site_stock gave: only a yes/no, never the quantity). */
  app.get('/public/stock', limit(60), async (_request, reply) => {
    const rows = await db.product.findMany({ where: { deletedAt: null }, select: { code: true, qty: true } });
    const out: Record<string, boolean> = {};
    for (const r of rows) out[r.code] = r.qty.gt(0);
    void reply.header('cache-control', 'public, max-age=30');
    return out;
  });

  /** «تتبّع طلبي»: the order number (first 8 letters of its id, or the invoice number) with the phone it was sent from. */
  app.post('/public/track', limit(20), async (request) => {
    const { ref, phone } = parse(z.object({ ref: z.string().trim().max(60).default(''), phone: z.string().trim().max(30).default('') }), request.body);
    const t = tail(phone);
    if (t.length < 8) return { orders: [] };
    const r = ref.replace(/^#/, '').toLowerCase();
    const rows = await db.webOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
    const mine = rows.filter((o) => tail(o.phone) === t && (!r || o.id.toLowerCase().startsWith(r) || (o.invoiceNo ?? '').toLowerCase() === r)).slice(0, 10);
    const codes = [...new Set(mine.flatMap((o) => ((o.items as { code: string }[]) ?? []).map((i) => i.code)))];
    const names = new Map((await db.product.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } })).map((p) => [p.code, p.name]));
    const orders = [];
    for (const o of mine) {
      const ship = (o.ship ?? null) as { method?: string; gov?: string } | null;
      const s = o.invoiceNo ? await db.shipment.findFirst({ where: { invoiceNo: o.invoiceNo }, orderBy: { createdAt: 'desc' } }) : null;
      orders.push({
        ref: o.id.slice(0, 8),
        method: ship?.method,
        status: o.status,
        created_at: o.createdAt.toISOString(),
        eta: o.eta || undefined,
        invoiced: !!o.invoiceNo,
        gov: ship?.gov || undefined,
        items: ((o.items as { code: string; qty: number }[]) ?? []).map((i) => ({ name: names.get(i.code) ?? i.code, qty: i.qty })),
        shipment: s
          ? {
              status: s.status,
              kind: s.kind,
              carrier: s.carrier || undefined,
              tracking: s.tracking || undefined,
              log: ((s.log as { s: string; at: string }[]) ?? []).map((l) => ({ s: l.s, at: l.at })),
            }
          : null,
      });
    }
    return { orders };
  });

  app.post('/public/track-custom', limit(20), async (request) => {
    const { ref, phone } = parse(z.object({ ref: z.string().trim().max(60).default(''), phone: z.string().trim().max(30).default('') }), request.body);
    const t = tail(phone);
    if (t.length < 8) return { orders: [] };
    const r = ref.replace(/^#/, '').toLowerCase();
    const rows = await db.webCustom.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
    const orders = rows
      .filter((o) => tail(o.phone) === t && (!r || o.id.toLowerCase().startsWith(r)))
      .slice(0, 10)
      .map((o) => ({ ref: o.id.slice(0, 8), kind: o.kind, status: o.status, summary: o.summary, img: o.img || undefined }));
    return { orders };
  });

  /** The reviews the owner approved (the «آراء العملاء» list of the site document), newest first. */
  app.get('/public/reviews', limit(60), async (request) => {
    const { product } = parse(z.object({ product: z.string().max(64).optional() }), request.query);
    const doc = await getKv<{ data?: { reviews?: { name?: string; stars?: number; text?: string; product?: string }[] } }>(SITE_KEY, {});
    const list = (doc.data?.reviews ?? []).filter((r) => (product ? r.product === product : !r.product));
    return list.map((r) => ({ name: String(r.name ?? ''), rating: Number(r.stars) || 5, body: String(r.text ?? '') }));
  });

  app.post('/public/reviews', limit(5), async (request) => {
    const b = parse(
      z.object({ name: z.string().trim().min(1).max(80), rating: z.number().int().min(1).max(5), body: z.string().trim().max(800).default(''), product: z.string().max(64).nullish() }),
      request.body,
    );
    const cur = await getKv<unknown[]>(REVIEWS_KEY, []);
    await putKv(REVIEWS_KEY, [{ id: randomBytes(5).toString('hex'), name: b.name, rating: b.rating, body: b.body, product: b.product ?? '', at: new Date().toISOString() }, ...cur].slice(0, 200));
    return { ok: true };
  });

  app.post('/public/notify-me', limit(10), async (request) => {
    const b = parse(z.object({ product: z.string().max(64), pname: z.string().trim().max(200).default(''), name: z.string().trim().max(80).default(''), phone: z.string().trim().min(8).max(30) }), request.body);
    const cur = await getKv<{ product: string; phone: string }[]>(NOTIFY_KEY, []);
    if (cur.some((x) => x.product === b.product && tail(x.phone) === tail(b.phone))) return { ok: true };
    await putKv(NOTIFY_KEY, [{ id: randomBytes(5).toString('hex'), ...b, at: new Date().toISOString() }, ...cur].slice(0, 500));
    return { ok: true };
  });

  app.post('/public/visit', limit(60), async (request) => {
    const { page } = parse(z.object({ page: z.enum(['shop', 'custom', 'story']) }), request.body);
    const v = await getKv<{ shop?: number; custom?: number; story?: number; days?: Record<string, Record<string, number>> }>(VISITS_KEY, {});
    const day = new Date().toISOString().slice(0, 10);
    v[page] = (v[page] ?? 0) + 1;
    const days = { ...(v.days ?? {}) };
    days[day] = { ...(days[day] ?? {}), [page]: (days[day]?.[page] ?? 0) + 1 };
    for (const k of Object.keys(days).sort().slice(0, -60)) delete days[k];
    // two first visits at the same moment both try to create the row: losing one count is fine, a 500 is not
    await putKv(VISITS_KEY, { ...v, days }).catch(() => undefined);
    return { ok: true };
  });

  // ---- admin: what visitors left for the owner ----
  app.get('/reviews/pending', { preHandler: app.requireAdmin }, async () => ({ items: await getKv<unknown[]>(REVIEWS_KEY, []) }));

  /** Approve = it joins the site's «آراء العملاء» list; reject = it is deleted. */
  app.post('/reviews/pending/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.string().max(40) }), request.params);
    const { approve } = parse(z.object({ approve: z.boolean() }), request.body);
    const cur = await getKv<{ id: string; name: string; rating: number; body: string; product: string }[]>(REVIEWS_KEY, []);
    const r = cur.find((x) => x.id === id);
    if (!r) throw notFound('الرأي ده مش موجود');
    if (approve) {
      const doc = await getKv<{ data: Record<string, unknown>; version: number }>(SITE_KEY, { data: { theme: {}, sections: [], products: [] }, version: 0 });
      const reviews = ((doc.data.reviews as unknown[]) ?? []).slice();
      reviews.unshift({ id: r.id, name: r.name, area: '', stars: r.rating, text: r.body, ...(r.product ? { product: r.product } : {}) });
      await db.setting.upsert({
        where: { key: SITE_KEY },
        create: { key: SITE_KEY, value: { data: { ...doc.data, reviews }, version: doc.version + 1 } as unknown as Prisma.InputJsonValue, updatedById: actorOf(request).id },
        update: { value: { data: { ...doc.data, reviews }, version: doc.version + 1 } as unknown as Prisma.InputJsonValue, updatedById: actorOf(request).id },
      });
    }
    await putKv(REVIEWS_KEY, cur.filter((x) => x.id !== id));
    return { ok: true };
  });

  app.get('/notify', { preHandler: app.requireAdmin }, async () => ({ items: await getKv<unknown[]>(NOTIFY_KEY, []) }));
  /** «📊 أداء الموقع»: visits, orders per day, the most ordered items and what people are waiting for. */
  app.get('/insights', { preHandler: app.requireAdmin }, async () => {
    const since = new Date(Date.now() - 30 * 86400_000);
    const [orders, custom, requests, visits, notify, pending] = await Promise.all([
      db.webOrder.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, items: true, status: true } }),
      db.webCustom.count({ where: { createdAt: { gte: since } } }),
      db.webRequest.count({ where: { createdAt: { gte: since } } }),
      getKv<{ shop?: number; custom?: number; story?: number; days?: Record<string, Record<string, number>> }>(VISITS_KEY, {}),
      getKv<{ product: string; pname?: string }[]>(NOTIFY_KEY, []),
      getKv<unknown[]>(REVIEWS_KEY, []),
    ]);
    const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d);
    const byDay: Record<string, number> = {};
    const items = new Map<string, { qty: number; orders: number }>();
    for (const o of orders) {
      byDay[day(o.createdAt)] = (byDay[day(o.createdAt)] ?? 0) + 1;
      for (const i of (o.items as { code: string; qty: number }[]) ?? []) {
        const cur = items.get(i.code) ?? { qty: 0, orders: 0 };
        items.set(i.code, { qty: cur.qty + Number(i.qty || 0), orders: cur.orders + 1 });
      }
    }
    const names = new Map((await db.product.findMany({ where: { code: { in: [...items.keys()] } }, select: { code: true, name: true } })).map((p) => [p.code, p.name]));
    const top = [...items.entries()].sort((a, b) => b[1].orders - a[1].orders || b[1].qty - a[1].qty).slice(0, 8).map(([code, v]) => ({ code, name: names.get(code) ?? code, ...v }));
    const wait = new Map<string, { pname: string; n: number }>();
    for (const w of notify) wait.set(w.product, { pname: w.pname || w.product, n: (wait.get(w.product)?.n ?? 0) + 1 });
    const days = Object.entries(visits.days ?? {}).sort().slice(-30).map(([d, v]) => ({ day: d, shop: v.shop ?? 0, custom: v.custom ?? 0 }));
    return {
      visits: { shop: visits.shop ?? 0, custom: visits.custom ?? 0, story: visits.story ?? 0, days },
      orders: { count: orders.length, done: orders.filter((o) => o.status === 'done').length, custom, requests, byDay },
      top,
      waiting: [...wait.values()].sort((a, b) => b.n - a.n).slice(0, 8),
      pendingReviews: pending.length,
    };
  });

  app.get('/visits', { preHandler: app.requireAdmin }, async () => ({ visits: await getKv<Record<string, unknown>>(VISITS_KEY, {}) }));
}
