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
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  await createUser(prisma, '01100000001', 'STAFF', 'كريم');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});
const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('warehouses and product places', () => {
  it('warehouses: add, no duplicates, rename; staff can read but not change', async () => {
    const a = (await call(admin, 'POST', '/warehouses', { name: 'المخزن الرئيسي', note: 'الدور الأرضي' })).json();
    expect((await call(admin, 'POST', '/warehouses', { name: 'المخزن الرئيسي' })).statusCode).toBe(400);
    expect((await call(staff, 'POST', '/warehouses', { name: 'x' })).statusCode).toBe(403);
    expect((await call(staff, 'GET', '/warehouses')).json().warehouses).toHaveLength(1);
    expect((await call(admin, 'PUT', `/warehouses/${a.id}`, { name: 'المخزن الكبير', note: '' })).statusCode).toBe(200);
  });

  it('a product registered in a warehouse shows there with its spot and the part that is not on the shelf; the place survives an old-style save', async () => {
    const w = (await call(admin, 'POST', '/warehouses', { name: 'مخزن الجيزة' })).json();
    const p = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 10, cost: 6, qty: 50, minQty: 1, unit: 'قطعة' })).json().product;
    const put = await call(admin, 'PUT', `/products/${p.id}/info`, { loc: 'رف 3 عين 2', shelfQty: 12, stores: [{ w: w.id, s: 'عين 5' }] });
    expect(put.json().info).toMatchObject({ shelfQty: 12, stores: [{ w: w.id, s: 'عين 5' }] });
    // an older screen saves without the new fields: nothing is wiped
    const old = await call(admin, 'PUT', `/products/${p.id}/info`, { brand: 'ساميت', loc: 'رف 3 عين 2' });
    expect(old.json().info).toMatchObject({ shelfQty: 12, stores: [{ w: w.id, s: 'عين 5' }] });
    const list = (await call(staff, 'GET', `/warehouses/${w.id}/products`)).json();
    expect(list.items[0]).toMatchObject({ spot: 'عين 5', qty: 50, inStore: 38 });
    expect((await call(staff, 'GET', '/warehouses')).json().warehouses[0].products).toBe(1);
    expect((await call(admin, 'PUT', `/products/${p.id}/info`, { stores: [{ w: 'nope', s: '' }] })).statusCode).toBe(400);
    expect((await call(admin, 'DELETE', `/warehouses/${w.id}`)).statusCode).toBe(400); // still has a product
    await call(admin, 'PUT', `/products/${p.id}/info`, { stores: [], shelfQty: null });
    expect((await call(admin, 'DELETE', `/warehouses/${w.id}`)).statusCode).toBe(200);
  });
});
