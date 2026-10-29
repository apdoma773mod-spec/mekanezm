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
  pid = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 50, cost: 20, qty: 100, minQty: 10 })).json().product.id;
});

const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('report extras', () => {
  it('«اشترى منك بكام»: items, invoices, profit after returns', async () => {
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 100, items: [{ productId: pid, qty: 4, price: 50 }] });
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 0, items: [{ productId: pid, qty: 2, price: 60 }] });
    await call(admin, 'POST', '/returns', { kind: 'SALE', productId: pid, person: 'سمير', qty: 1, price: 50, settlement: 'CASH' });
    const r = (await call(admin, 'GET', '/reports/contact?name=سمير&type=CUSTOMER')).json().report;
    expect(r.totals).toMatchObject({ count: 2, total: 320, returns: 50, net: 270, paid: 100 });
    // profit: (200-80) + (120-40) - (50-20) = 170
    expect(r.totals.profit).toBe(170);
    expect(r.items).toEqual([{ name: 'مفصلة', qty: 6, total: 320, profit: 200 }]);
    expect(r.invoices).toHaveLength(2);
    expect((await call(staff, 'GET', '/reports/contact?name=سمير&type=CUSTOMER')).statusCode).toBe(403);
  });

  it('top customers by net purchases, with the account', async () => {
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 0, items: [{ productId: pid, qty: 4, price: 50 }] });
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'علي', paid: 300, items: [{ productId: pid, qty: 6, price: 50 }] });
    const top = (await call(admin, 'GET', '/reports/top-customers')).json().customers;
    expect(top.map((t: { name: string }) => t.name)).toEqual(['علي', 'سمير']);
    expect(top[1]).toMatchObject({ count: 1, total: 200, profit: 120, balance: 200 });
  });

  it('overview counts out, low and supplier debt', async () => {
    await call(admin, 'POST', '/products', { name: 'خلص', price: 5, qty: 0 });
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 450, items: [{ productId: pid, qty: 95, price: 50 }] });
    await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'مورد', paid: 0, items: [{ productId: pid, qty: 1, price: 20 }] });
    const o = (await call(admin, 'GET', '/cash/overview')).json().overview;
    expect(o).toMatchObject({ outCount: 1, lowCount: 1, suppliersOwed: 20 });
  });
});
