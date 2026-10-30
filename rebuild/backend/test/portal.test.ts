import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let cust: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  cust = (await call(admin, 'POST', '/contacts', { type: 'CUSTOMER', name: 'سمير النجار', phone: '01001112223' })).json().contact.id;
});

const call = (cookie: string | null, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, ...(cookie ? { headers: { cookie } } : {}), ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('customer link', () => {
  it('only the owner makes the link; the same customer keeps the same link', async () => {
    expect((await call(staff, 'POST', `/portal/link/${cust}`)).statusCode).toBe(403);
    const a = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    const b = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    expect(a).toMatch(/^[a-z0-9]{20,40}$/);
    expect(b).toBe(a);
  });

  it('the page shows his account live, without a login; a wrong token shows nothing', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 100, cost: 60, qty: 20 })).json().product.id;
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير النجار', contactId: cust, paid: 100, items: [{ productId: p, qty: 3, price: 100 }] });
    const t = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    const page = (await call(null, 'GET', `/portal/public/${t}`)).json();
    expect(page.customer).toBe('سمير النجار');
    expect(page.bal).toBe(200);
    expect(page.inv).toHaveLength(1);
    expect(page.inv[0]).toMatchObject({ tot: 300, paid: 100, rem: 200 });
    expect(page.inv[0].items[0]).toMatchObject({ n: 'مفصلة', q: 3 });
    expect((await call(null, 'GET', '/portal/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaa')).statusCode).toBe(404);
    // new sale shows at once (nothing is copied)
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير النجار', contactId: cust, paid: 0, items: [{ productId: p, qty: 1, price: 100 }] });
    expect((await call(null, 'GET', `/portal/public/${t}`)).json().inv).toHaveLength(2);
  });

  it('a request from the customer reaches the owner as new, and reading it clears the count', async () => {
    const t = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    expect((await call(null, 'POST', `/portal/public/${t}/msg`, { body: '' })).statusCode).toBe(400);
    expect((await call(null, 'POST', `/portal/public/${t}/msg`, { body: 'محتاج ٢٠ مفصلة', media: [{ u: '/api/v1/work/files/abcdef123456.jpg', t: 'i' }] })).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/portal/msgs/count')).json().count).toBe(1);
    const list = (await call(admin, 'GET', '/portal/msgs?unseen=1')).json().items;
    expect(list[0]).toMatchObject({ name: 'سمير النجار', body: 'محتاج ٢٠ مفصلة', seen: false });
    expect(list[0].media).toHaveLength(1);
    await call(admin, 'POST', `/portal/msgs/${list[0].id}/seen`);
    expect((await call(admin, 'GET', '/portal/msgs/count')).json().count).toBe(0);
    expect((await call(staff, 'GET', '/portal/msgs/count')).statusCode).toBe(403);
  });

  it('stopping the link kills the page', async () => {
    const t = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    await call(admin, 'DELETE', `/portal/link/${cust}`);
    expect((await call(null, 'GET', `/portal/public/${t}`)).statusCode).toBe(404);
  });

  it('rejects media that is not a file of ours', async () => {
    const t = (await call(admin, 'POST', `/portal/link/${cust}`)).json().token;
    expect((await call(null, 'POST', `/portal/public/${t}/msg`, { body: 'x', media: [{ u: 'https://evil.example/x.jpg', t: 'i' }] })).statusCode).toBe(400);
  });
});
