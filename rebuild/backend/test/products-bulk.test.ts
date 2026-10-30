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

const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function product(name: string, price: number, cost: number, qty: number, unit = 'قطعة') {
  const res = await call(admin, 'POST', '/products', { name, price, cost, qty, unit });
  expect(res.statusCode).toBe(201);
  return res.json().product as { id: string };
}
const fetchP = async (id: string) => (await call(admin, 'GET', `/products/${id}`)).json().product;

describe('bulk price', () => {
  it('raises sell price by a percent and rounds to 5', async () => {
    const a = await product('أ', 100, 60, 1);
    const b = await product('ب', 33, 20, 1);
    const res = await call(admin, 'POST', '/products/bulk-price', { ids: [a.id, b.id], field: 'price', pct: 10, round: 5 });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(2);
    expect(Number((await fetchP(a.id)).price)).toBe(110);
    expect(Number((await fetchP(b.id)).price)).toBe(35);
    expect(Number((await fetchP(a.id)).cost)).toBe(60);
  });

  it('changes cost only, or both', async () => {
    const a = await product('أ', 100, 50, 1);
    await call(admin, 'POST', '/products/bulk-price', { ids: [a.id], field: 'cost', pct: -20 });
    expect(Number((await fetchP(a.id)).cost)).toBe(40);
    expect(Number((await fetchP(a.id)).price)).toBe(100);
    await call(admin, 'POST', '/products/bulk-price', { ids: [a.id], field: 'both', pct: 50 });
    expect(Number((await fetchP(a.id)).cost)).toBe(60);
    expect(Number((await fetchP(a.id)).price)).toBe(150);
  });

  it('is for the owner only and rejects a zero percent', async () => {
    const a = await product('أ', 100, 50, 1);
    expect((await call(staff, 'POST', '/products/bulk-price', { ids: [a.id], field: 'price', pct: 5 })).statusCode).toBe(403);
    expect((await call(admin, 'POST', '/products/bulk-price', { ids: [a.id], field: 'price', pct: 0 })).statusCode).toBe(400);
    expect((await call(admin, 'POST', '/products/bulk-price', { ids: [a.id], field: 'price', pct: -95 })).statusCode).toBe(400);
  });
});

describe('re-categorise', () => {
  it('moves the sent products to their new category, owner only', async () => {
    const a = await product('مفصلة عدل', 10, 5, 1);
    const b = await product('مجرى سفلي', 10, 5, 1);
    expect((await call(staff, 'POST', '/products/recat', { items: [{ id: a.id, category: 'مفصلات' }] })).statusCode).toBe(403);
    const res = await call(admin, 'POST', '/products/recat', { items: [{ id: a.id, category: 'مفصلات' }, { id: b.id, category: 'مجرى الادراج' }] });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(2);
    expect((await fetchP(a.id)).category).toBe('مفصلات');
    expect((await fetchP(b.id)).category).toBe('مجرى الادراج');
    expect((await call(admin, 'POST', '/products/recat', { items: [{ id: a.id, category: 'مفصلات' }] })).json().updated).toBe(0);
  });
});

describe('split a roll', () => {
  it('moves stock from the big unit to the small one and spreads the cost', async () => {
    const roll = await product('لفة سلك', 1000, 500, 4, 'لفة');
    const meter = await product('سلك متر', 15, 4, 10, 'متر');
    const res = await call(admin, 'POST', '/products/split', { sourceId: roll.id, targetId: meter.id, ratio: 100, qty: 1 });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Number(body.source.qty)).toBe(3);
    expect(Number(body.target.qty)).toBe(110);
    // (10*4 + 100*5) / 110 = 4.909 -> 4.91
    expect(Number(body.target.cost)).toBeCloseTo(4.91, 2);
  });

  it('refuses the same product on both sides and staff', async () => {
    const roll = await product('لفة', 1000, 500, 4);
    expect((await call(admin, 'POST', '/products/split', { sourceId: roll.id, targetId: roll.id, ratio: 2, qty: 1 })).statusCode).toBe(400);
    expect((await call(staff, 'POST', '/products/split', { sourceId: roll.id, targetId: roll.id, ratio: 2, qty: 1 })).statusCode).toBe(403);
  });
});

describe('old goods and file import', () => {
  it('estimates the cost of products that have a price but no cost, and marks it', async () => {
    const a = await product('قديم', 100, 0, 3);
    await product('عادي', 100, 40, 3);
    const zero = (await call(admin, 'GET', '/products/old-goods')).json();
    expect(zero.count).toBe(1);
    const res = await call(admin, 'POST', '/products/old-goods/estimate', { pct: 70 });
    expect(res.json().updated).toBe(1);
    const p = await fetchP(a.id);
    expect(Number(p.cost)).toBe(70);
    expect(p.costEst).toBe(true);
    // a real cost clears the «تقديري» mark
    await app.inject({ method: 'PATCH', url: `/api/v1/products/${a.id}`, headers: { cookie: admin }, payload: { cost: 65 } });
    expect((await fetchP(a.id)).costEst).toBe(false);
  });

  it('adds old goods line by line, skipping names that exist', async () => {
    await product('مفصلة', 50, 20, 1);
    const res = await call(admin, 'POST', '/products/old-goods/add', {
      pct: 75,
      category: 'بضاعة قديمة',
      unit: 'قطعة',
      lines: [
        { name: 'مفصلة', qty: 5, price: 80 },
        { name: 'مقبض 128', qty: 50, price: 40, cost: 28 },
        { name: 'سوستة', qty: 20, price: 85 },
      ],
    });
    expect(res.json()).toMatchObject({ added: 2, estimated: 1, skipped: ['مفصلة (موجود)'] });
    const list = (await call(admin, 'GET', '/products/all?q=سوستة')).json().items;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ qty: 20, price: 85, cost: 63.75, costEst: true, category: 'بضاعة قديمة' });
  });

  it('imports names with zero stock and skips duplicates', async () => {
    await product('موجود', 10, 5, 1);
    const res = await call(admin, 'POST', '/products/import', { category: 'إكسسوارات مطابخ', rows: [{ name: 'موجود', price: 1, cost: 0 }, { name: 'جديد', price: 30, cost: 0 }] });
    expect(res.json()).toEqual({ added: 1, skipped: 1 });
    const n = (await call(admin, 'GET', '/products/all?q=جديد')).json().items[0];
    expect(n).toMatchObject({ qty: 0, minQty: 5, price: 30 });
  });

  it('keeps cost out of the full list for staff and these tools are owner-only', async () => {
    await product('س', 10, 5, 1);
    const items = (await call(staff, 'GET', '/products/all')).json().items;
    expect(items[0].cost).toBeUndefined();
    expect((await call(staff, 'GET', '/products/old-goods')).statusCode).toBe(403);
    expect((await call(staff, 'POST', '/products/import', { rows: [{ name: 'x' }] })).statusCode).toBe(403);
  });
});
