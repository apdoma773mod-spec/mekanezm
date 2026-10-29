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

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('market prices', () => {
  it('is for the owner only', async () => {
    expect((await call(staff, 'GET', '/market-prices')).statusCode).toBe(403);
    expect((await call(staff, 'PUT', '/market-prices', { prices: {} })).statusCode).toBe(403);
  });

  it('keeps typed prices and reports the last purchase price from each supplier', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 50, cost: 10, qty: 0 })).json().product;
    const buy = (person: string, price: number, date: string) =>
      call(admin, 'POST', '/invoices', { kind: 'PURCHASE', date, person, items: [{ productId: p.id, qty: 5, price }], paid: 0, payMethod: 'CASH' });
    expect((await buy('المورد أ', 20, '2026-10-01')).statusCode).toBe(201);
    expect((await buy('المورد أ', 18, '2026-10-05')).statusCode).toBe(201);
    expect((await buy('المورد ب', 15, '2026-10-03')).statusCode).toBe(201);

    expect((await call(admin, 'PUT', '/market-prices', { prices: { [p.code]: [{ s: 'سوق العتبة', p: 12, at: '2026-10-06' }] } })).statusCode).toBe(200);
    const got = (await call(admin, 'GET', '/market-prices')).json();
    expect(got.prices[p.code]).toEqual([{ s: 'سوق العتبة', p: 12, at: '2026-10-06' }]);
    const byS = Object.fromEntries(got.buys.map((b: { s: string; p: number }) => [b.s, b.p]));
    expect(byS).toEqual({ 'المورد أ': 18, 'المورد ب': 15 });
    expect(got.last).toHaveLength(1);
    expect(got.last[0]).toMatchObject({ s: 'المورد أ', p: 18 });
  });
});
