import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let a: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  a = (await call(admin, 'POST', '/products', { name: 'ماشي', price: 100, cost: 60, qty: 100, minQty: 5 })).json().product.id;
  await call(admin, 'POST', '/products', { name: 'راكد', price: 100, cost: 40, qty: 10 });
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('analytics', () => {
  it('is for the owner only', async () => {
    for (const u of ['dead', 'abc', 'lapsed', 'suppliers', 'forecast', 'follow', 'log']) expect((await call(staff, 'GET', `/analytics/${u}`)).statusCode).toBe(403);
  });

  it('dead stock, ABC and forecast from the sales', async () => {
    for (let i = 0; i < 3; i++) await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 500, items: [{ productId: a, qty: 5, price: 100 }] });
    const dead = (await call(admin, 'GET', '/analytics/dead?days=30')).json().rows;
    expect(dead.map((r: { name: string }) => r.name)).toEqual(['راكد']);
    expect(dead[0]).toMatchObject({ val: 400, last: '' });
    const abc = (await call(admin, 'GET', '/analytics/abc')).json().rows;
    expect(abc[0]).toMatchObject({ name: 'ماشي', cls: 'A', sold: 15, val: 1500 });
    // 85 left, 15 sold in 30 days = 0.5/day → 170 days of cover: not in the forecast; make it low
    expect((await call(admin, 'GET', '/analytics/forecast')).json().rows).toHaveLength(0);
    await call(admin, 'POST', `/products/${a}/adjust`, { newQty: 3, note: 'x' });
    const fc = (await call(admin, 'GET', '/analytics/forecast')).json().rows;
    expect(fc[0]).toMatchObject({ name: 'ماشي', order: 12 });
  });

  it('compares suppliers, follows up buyers and counts what a craftsman bought', async () => {
    const buy = (p: string, price: number) => call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: p, paid: 0, items: [{ productId: a, qty: 1, price }] });
    await buy('مورد 1', 50);
    await buy('مورد 2', 40);
    const sup = (await call(admin, 'GET', '/analytics/suppliers')).json().rows;
    expect(sup[0]).toMatchObject({ name: 'ماشي', save: 10 });
    expect(sup[0].list[0].s).toBe('مورد 2');
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', phone: '01012345678', paid: 100, items: [{ productId: a, qty: 1, price: 100 }] });
    const sp = (await call(admin, 'POST', '/analytics/spent', { names: ['سمير', 'غيره'] })).json().spent;
    expect(sp).toEqual({ سمير: 100 });
    expect((await call(admin, 'GET', '/analytics/log')).json().rows.length).toBeGreaterThan(0);
  });

  it('keeps the owner\'s lists (points, reservations, price lists…) in settings', async () => {
    expect((await call(admin, 'PUT', '/work/kv/reservations', { value: [{ pid: a, qty: 2, cust: 'سمير' }] })).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/work/kv/reservations')).json().value).toHaveLength(1);
    expect((await call(staff, 'GET', '/work/kv/usd')).statusCode).toBe(403);
  });
});
