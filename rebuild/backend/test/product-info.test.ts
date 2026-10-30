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
  pid = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 50, cost: 20, qty: 10, unit: 'قطعة' })).json().product.id;
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('product card details', () => {
  it('saves details, packs and photos (owner) and everyone can read them', async () => {
    const body = { brand: 'بلوم', finish: 'نيكل', size: '35 مم', specs: 'كاتم صوت', loc: 'رف 3', grp: 'مفصلات', descr: 'مفصلة هيدروليك', packs: [{ u: 'علبة', n: 12 }, { u: 'مسمار', n: 0.004, x: 250, small: true }], imgs: ['/api/v1/work/files/a.jpg'] };
    expect((await call(staff, 'PUT', `/products/${pid}/info`, body)).statusCode).toBe(403);
    expect((await call(admin, 'PUT', `/products/${pid}/info`, body)).statusCode).toBe(200);
    const one = (await call(staff, 'GET', `/products/${pid}/info`)).json().info;
    expect(one).toMatchObject({ brand: 'بلوم', loc: 'رف 3', grp: 'مفصلات' });
    expect(one.packs).toHaveLength(2);
    const all = (await call(staff, 'GET', '/products/info/all')).json().infos;
    expect(all[pid].packs[0]).toEqual({ u: 'علبة', n: 12 });
    expect((await call(admin, 'GET', '/products/info/groups')).json().groups).toEqual(['مفصلات']);
  });

  it('makes a size/color variant with zero stock in the same group and lists siblings', async () => {
    await call(admin, 'PUT', `/products/${pid}/info`, { brand: 'بلوم', specs: 'x', packs: [{ u: 'علبة', n: 12 }] });
    const v = (await call(admin, 'POST', `/products/${pid}/variant`, { name: 'مفصلة', size: '45 سم', finish: 'أسود', price: 60, cost: 25 })).json();
    expect(v.code).toMatch(/^P/);
    const made = (await call(admin, 'GET', `/products/${v.id}`)).json().product;
    expect(made).toMatchObject({ qty: 0, price: 60, cost: 25 });
    const sib = (await call(staff, 'GET', `/products/${pid}/siblings`)).json();
    expect(sib.group).toBe('مفصلة');
    expect(sib.items).toHaveLength(1);
    expect(sib.items[0]).toMatchObject({ size: '45 سم', finish: 'أسود', qty: 0 });
    expect(sib.items[0].price).toBeUndefined(); // staff don't see prices here
    expect((await call(admin, 'GET', `/products/${v.id}/info`)).json().info.packs).toEqual([{ u: 'علبة', n: 12 }]);
    expect((await call(admin, 'POST', `/products/${pid}/variant`, { name: 'مفصلة', size: '45 سم', finish: 'أسود', price: 60, cost: 25 })).statusCode).toBe(400);
  });

  it('owner card: sold in 90 days, best customers, last purchase', async () => {
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 100, items: [{ productId: pid, qty: 2, price: 50 }] });
    await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'مورد', paid: 0, items: [{ productId: pid, qty: 5, price: 18 }] });
    const c = (await call(admin, 'GET', `/products/${pid}/card`)).json();
    expect(c.sold90).toBe(2);
    expect(c.top).toEqual([{ name: 'سمير', qty: 2 }]);
    expect(c.lastBuy).toMatchObject({ price: 18, person: 'مورد' });
    expect((await call(staff, 'GET', `/products/${pid}/card`)).statusCode).toBe(403);
  });
});
