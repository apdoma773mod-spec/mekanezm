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
