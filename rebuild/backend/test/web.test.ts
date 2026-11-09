import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

const call = (cookie: string | null, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, ...(cookie ? { headers: { cookie } } : {}), ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('website orders', () => {
  it('anyone can send an order, only the owner can see and handle it', async () => {
    const sent = await call(null, 'POST', '/web/public/orders', { customerName: 'سمير', phone: '01001112223', items: [{ code: 'P0002', qty: 3 }, { code: 'P0003', qty: 1, backorder: true }] });
    expect(sent.statusCode).toBe(200);
    expect((await call(null, 'GET', '/web/orders')).statusCode).toBe(401);
    expect((await call(staff, 'GET', '/web/orders')).statusCode).toBe(403);
    const list = (await call(admin, 'GET', '/web/orders')).json().items;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ customerName: 'سمير', status: 'new' });
    expect((await call(admin, 'GET', '/web/orders/count')).json().count).toBe(1);

    const id = list[0].id;
    const eta = await call(admin, 'PATCH', `/web/orders/${id}`, { eta: 'بكره إن شاء الله' });
    expect(eta.json().order).toMatchObject({ eta: 'بكره إن شاء الله', status: 'new' });
    const done = await call(admin, 'PATCH', `/web/orders/${id}`, { status: 'done', invoiceNo: 'MK-0007' });
    expect(done.json().order).toMatchObject({ status: 'done', invoiceNo: 'MK-0007' });
    expect((await call(admin, 'GET', '/web/orders/count')).json().count).toBe(0);
  });

  it('keeps the shipping choice the site sends', async () => {
    const ship = { method: 'delivery', gov: 'الجيزة', area: 'الدقي', address: 'شارع التحرير ٥' };
    expect((await call(null, 'POST', '/web/public/orders', { customerName: 'منى', items: [{ code: 'P0002', qty: 1 }], ship })).statusCode).toBe(200);
    expect((await call(null, 'POST', '/web/public/orders', { customerName: 'منى', items: [{ code: 'P0002', qty: 1 }], ship: { method: 'x' } })).statusCode).toBe(400);
    const row = (await call(admin, 'GET', '/web/orders')).json().items.find((o: { customerName: string }) => o.customerName === 'منى');
    expect(row.ship).toEqual(ship);
  });

  it('rejects an empty order', async () => {
    expect((await call(null, 'POST', '/web/public/orders', { customerName: 'x', items: [] })).statusCode).toBe(400);
    expect((await call(null, 'POST', '/web/public/orders', { customerName: '', items: [{ code: 'a', qty: 1 }] })).statusCode).toBe(400);
  });
});

describe('photo requests and custom orders', () => {
  it('a customer sends a photo request, the owner replies, then closes it', async () => {
    expect((await call(null, 'POST', '/web/public/requests', { name: 'سمير', phone: '01001112223' })).statusCode).toBe(400);
    expect((await call(null, 'POST', '/web/public/requests', { name: 'سمير', imgs: ['http://evil.example/x.jpg'] })).statusCode).toBe(400);
    const sent = await call(null, 'POST', '/web/public/requests', { name: 'سمير', phone: '01001112223', imgs: ['/api/v1/work/files/abcdef123456.jpg'], note: 'مجرى زي ده' });
    expect(sent.statusCode).toBe(200);
    expect((await call(staff, 'GET', '/web/requests')).statusCode).toBe(403);
    expect((await call(admin, 'GET', '/web/counts')).json()).toMatchObject({ orders: 0, requests: 1, custom: 0 });
    const id = (await call(admin, 'GET', '/web/requests')).json().items[0].id;
    const r = await call(admin, 'PATCH', `/web/requests/${id}`, { reply: 'هنوفّره لك' });
    expect(r.json().request).toMatchObject({ status: 'replied', reply: 'هنوفّره لك' });
    expect((await call(admin, 'PATCH', `/web/requests/${id}`, { status: 'closed' })).json().request.status).toBe('closed');
    expect((await call(admin, 'GET', '/web/counts')).json().requests).toBe(0);
  });

  it('a WhatsApp-news subscription is counted apart from photo requests', async () => {
    await call(null, 'POST', '/web/public/requests', { name: 'منى', phone: '01012345678', note: '📣 اشتراك في جديد الواتساب\nمهتم بـ: مفصلات' });
    await call(null, 'POST', '/web/public/requests', { name: 'كريم', phone: '01234567890', note: 'مقبض زي ده' });
    expect((await call(admin, 'GET', '/web/counts')).json()).toMatchObject({ requests: 1, subs: 1 });
  });

  it('a custom order from the site is listed and can be opened or closed', async () => {
    expect((await call(null, 'POST', '/web/public/custom', { name: 'عمرو', kind: 'wood', summary: 'x' })).statusCode).toBe(400);
    expect((await call(null, 'POST', '/web/public/custom', { name: 'عمرو', phone: '01007778889', kind: 'steel', summary: 'حماية باب ٦٠×٢٠٠', spec: { w: 60, h: 200, q: 2 } })).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/web/counts')).json().custom).toBe(1);
    const row = (await call(admin, 'GET', '/web/custom')).json().items[0];
    expect(row).toMatchObject({ kind: 'steel', status: 'new' });
    expect(row.spec).toEqual({ w: 60, h: 200, q: 2 });
    expect((await call(admin, 'PATCH', `/web/custom/${row.id}`, { status: 'opened' })).json().custom.status).toBe('opened');
    expect((await call(admin, 'GET', '/web/counts')).json().custom).toBe(0);
  });
});

describe('site content', () => {
  it('is public to read, saved by the owner with a version check', async () => {
    expect((await call(null, 'GET', '/web/public/site')).json().site.version).toBe(0);
    expect((await call(staff, 'PUT', '/web/site', { data: {}, version: 0 })).statusCode).toBe(403);
    const first = await call(admin, 'PUT', '/web/site', { data: { sections: [{ id: 's1', name: 'مفصلات' }], products: [] }, version: 0 });
    expect(first.json().site.version).toBe(1);
    // a second editor that still holds version 0 must not overwrite
    const stale = await call(admin, 'PUT', '/web/site', { data: { sections: [] }, version: 0 });
    expect(stale.statusCode).toBe(409);
    const pub = (await call(null, 'GET', '/web/public/site')).json().site;
    expect(pub.data.sections).toEqual([{ id: 's1', name: 'مفصلات' }]);
  });
});

describe('website order → WhatsApp copies', () => {
  it('queues one message per number (personal + two shop numbers) and can be switched off', async () => {
    await prisma.product.create({ data: { code: 'N1', name: 'مفصلة', qty: 5, price: 10 } });
    await call(null, 'POST', '/web/public/orders', { customerName: 'سمير', phone: '01001112223', items: [{ code: 'N1', qty: 2 }], ship: { method: 'delivery', gov: 'القاهرة', area: '', address: 'شارع التحرير' } });
    await new Promise((r) => setTimeout(r, 300));
    const q = await prisma.outboundMessage.findMany({ orderBy: { toPhone: 'asc' } });
    expect(q.map((m) => m.toPhone)).toEqual(['201042383986', '201042466087', '201119199659']);
    expect(q[0].body).toContain('مفصلة');
    expect(q[0].body).toContain('سمير');
    await prisma.setting.upsert({ where: { key: 'web_order_notify' }, create: { key: 'web_order_notify', value: { on: false } }, update: { value: { on: false } } });
    await call(null, 'POST', '/web/public/orders', { customerName: 'منى', phone: '01001112224', items: [{ code: 'N1', qty: 1 }] });
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.outboundMessage.count()).toBe(3);
  });
});

describe('website: back in stock + insights', () => {
  it('tells the waiting customer once when the product is back, and the insights show the numbers', async () => {
    await prisma.product.create({ data: { code: 'B1', name: 'مقبض ذهبي', qty: 0, price: 10 } });
    await prisma.setting.create({ data: { key: 'site_content', value: { version: 1, data: { products: [{ id: 'site-b1', name: 'مقبض ذهبي', code: 'B1' }] } } } });
    await call(null, 'POST', '/web/public/notify-me', { product: 'site-b1', pname: 'مقبض ذهبي', name: 'علي', phone: '01001112223' });
    const { notifyBackInStock } = await import('../src/modules/web/notify-me.js');
    expect(await notifyBackInStock(prisma)).toBe(0);
    const ins = (await call(admin, 'GET', '/web/insights')).json();
    expect(ins.waiting).toEqual([{ pname: 'مقبض ذهبي', n: 1 }]);
    await prisma.product.update({ where: { code: 'B1' }, data: { qty: 5 } });
    expect(await notifyBackInStock(prisma)).toBe(1);
    expect(await notifyBackInStock(prisma)).toBe(0);
    const m = await prisma.outboundMessage.findMany();
    expect(m).toHaveLength(1);
    expect(m[0].toPhone).toBe('201001112223');
    expect(m[0].body).toContain('مقبض ذهبي');
    expect((await call(staff, 'GET', '/web/insights')).statusCode).toBe(403);
  });
});

describe('website: stock, tracking, reviews', () => {
  it('visitors see stock yes/no, track their own order by phone, and leave reviews the owner approves', async () => {
    await prisma.product.create({ data: { code: 'W1', name: 'مفصلة', qty: 5, price: 10 } });
    await prisma.product.create({ data: { code: 'W2', name: 'مقبض', qty: 0, price: 10 } });
    const stock = (await call(null, 'GET', '/web/public/stock')).json();
    expect(stock).toMatchObject({ W1: true, W2: false });

    const sent = await call(null, 'POST', '/web/public/orders', { customerName: 'سمير', phone: '01001112223', items: [{ code: 'W1', qty: 2 }], ship: { method: 'delivery', gov: 'القاهرة', area: '', address: 'شارع' } });
    const ref = sent.json().no as string;
    const hit = (await call(null, 'POST', '/web/public/track', { ref, phone: '+201001112223' })).json().orders;
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ ref, status: 'new', method: 'delivery', gov: 'القاهرة', items: [{ name: 'مفصلة', qty: 2 }] });
    expect((await call(null, 'POST', '/web/public/track', { ref, phone: '01009998887' })).json().orders).toHaveLength(0);

    const c = await call(null, 'POST', '/web/public/custom', { name: 'منى', phone: '01234567890', kind: 'steel', summary: 'ستانلس ٢ م' });
    const cid = c.json().id as string;
    expect((await call(null, 'POST', '/web/public/track-custom', { ref: cid.slice(0, 8), phone: '01234567890' })).json().orders[0]).toMatchObject({ kind: 'steel', status: 'new' });

    expect((await call(null, 'POST', '/web/public/reviews', { name: 'أحمد', rating: 5, body: 'تمام' })).statusCode).toBe(200);
    expect((await call(null, 'GET', '/web/public/reviews')).json()).toHaveLength(0);
    expect((await call(staff, 'GET', '/web/reviews/pending')).statusCode).toBe(403);
    const pending = (await call(admin, 'GET', '/web/reviews/pending')).json().items;
    expect(pending).toHaveLength(1);
    await call(admin, 'POST', `/web/reviews/pending/${pending[0].id}`, { approve: true });
    expect((await call(null, 'GET', '/web/public/reviews')).json()).toEqual([{ name: 'أحمد', rating: 5, body: 'تمام' }]);
    expect((await call(admin, 'GET', '/web/reviews/pending')).json().items).toHaveLength(0);

    await call(null, 'POST', '/web/public/visit', { page: 'shop' });
    expect((await call(admin, 'GET', '/web/visits')).json().visits.shop).toBe(1);
  });
});
