import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let pid: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  pid = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 100, cost: 60, qty: 50, minQty: 1, unit: 'قطعة' })).json().product.id;
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const sale = (cookie: string, person: string, qty: number, online?: boolean, paid?: number) =>
  call(cookie, 'POST', '/invoices', { kind: 'SALE', person, items: [{ productId: pid, name: 'مفصلة', qty, price: 100 }], ...(online !== undefined ? { online } : {}), ...(paid !== undefined ? { paid } : {}) });

describe('online customers', () => {
  it('a sale can be marked online, and the report counts online customers apart from the shop', async () => {
    const a = (await sale(staff, 'منى أونلاين', 2, true)).json().invoice;
    expect(a.online).toBe(true);
    await sale(staff, 'منى أونلاين', 1, true, 0);
    await sale(staff, 'كريم فيسبوك', 2, true);
    await sale(staff, 'زبون المحل', 5);
    expect((await call(staff, 'GET', '/reports/online')).statusCode).toBe(403);
    const r = (await call(admin, 'GET', '/reports/online')).json().report;
    expect(r.online).toMatchObject({ invoices: 3, customers: 2, total: 500, remaining: 100, profit: 200 });
    expect(r.shop).toMatchObject({ invoices: 1, customers: 1, total: 500 });
    expect(r.customers[0]).toMatchObject({ name: 'منى أونلاين', invoices: 2, total: 300, remaining: 100 });
    expect(r.items[0]).toMatchObject({ name: 'مفصلة', qty: 5 });
  });

  it('editing can switch a sale to online; a period with nothing is empty', async () => {
    const inv = (await sale(staff, 'زبون', 1)).json().invoice;
    const r = await call(admin, 'PUT', `/invoices/${inv.id}`, { person: 'زبون', items: [{ productId: pid, name: 'مفصلة', qty: 1, price: 100 }], online: true });
    expect(r.json().invoice.online).toBe(true);
    expect((await call(admin, 'GET', '/reports/online')).json().report.online.invoices).toBe(1);
    expect((await call(admin, 'GET', '/reports/online?from=2000-01-01&to=2000-01-31')).json().report.online.invoices).toBe(0);
  });
});
