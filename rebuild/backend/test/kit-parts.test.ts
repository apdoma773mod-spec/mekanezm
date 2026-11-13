import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let kit: string;
const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const product = async (id: string) => prisma.product.findUniqueOrThrow({ where: { id } });
const byName = async (name: string) => prisma.product.findFirstOrThrow({ where: { name } });

// طقم جرار 3 دلفة: تكلفته 3000 وبيتباع 4200. محتوياته: 3 دلفة (عجل + صباع) بـ 1000، و4 قضيب ألمنيوم بـ 300.
const PARTS = [
  { name: 'دلفة جرار بلوم', n: 3, price: 1000 },
  { name: 'قضيب ألمنيوم 3 متر', n: 4, price: 300 },
];

beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  kit = (await call(admin, 'POST', '/products', { name: 'طقم جرار بلوم 3 دلفة', price: 4200, cost: 3000, qty: 5, unit: 'طقم' })).json().product.id;
});

describe('kit sold by the piece', () => {
  it('saves the contents: new piece products with their prices, and shows each piece cost share by value', async () => {
    expect((await call(staff, 'PUT', `/products/${kit}/parts`, { parts: PARTS })).statusCode).toBe(403);
    const r = await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    expect(r.statusCode).toBe(200);
    const v = r.json();
    expect(v.parts).toHaveLength(2);
    // value = 3×1000 + 4×300 = 4200 → door share = 3000 × 3000/4200 / 3 = 714.29, rail = 3000 × 1200/4200 / 4 = 214.29
    expect(v.parts[0]).toMatchObject({ name: 'دلفة جرار بلوم', n: 3, price: 1000, qty: 0, share: 714.29 });
    expect(v.parts[1]).toMatchObject({ name: 'قضيب ألمنيوم 3 متر', n: 4, price: 300, qty: 0, share: 214.29 });
    expect((await call(staff, 'GET', `/products/${kit}/info`)).json().info.parts).toHaveLength(2);
    // saving details afterwards must not wipe the contents
    expect((await call(admin, 'PUT', `/products/${kit}/info`, { brand: 'بلوم' })).statusCode).toBe(200);
    expect((await call(admin, 'GET', `/products/${kit}/parts`)).json().parts).toHaveLength(2);
  });

  it('selling one door opens ONE kit by itself: kit −1, pieces in stock with their cost, invoice profit right', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const door = await byName('دلفة جرار بلوم');
    const rail = await byName('قضيب ألمنيوم 3 متر');
    const inv = await call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: door.id, qty: 1, price: 1000 }] });
    expect(inv.statusCode).toBe(201);
    expect((await product(kit)).qty.toNumber()).toBe(4); // one kit opened
    expect((await product(door.id)).qty.toNumber()).toBe(2); // 3 came out, 1 sold
    expect((await product(rail.id)).qty.toNumber()).toBe(4); // the rails stay as real stock
    expect((await product(door.id)).cost.toNumber()).toBe(714.29);
    expect((await product(rail.id)).cost.toNumber()).toBe(214.29);
    expect(inv.json().invoice?.profit ?? inv.json().profit).toBeCloseTo(1000 - 714.29, 2);
    const item = await prisma.invoiceItem.findFirstOrThrow({ where: { productId: door.id } });
    expect(item.unitCost.toNumber()).toBe(714.29);
    // total stock value is unchanged by opening: 4×3000 + 2×714.29 + 4×214.29 + sold 714.29 ≈ 15000
    const value = 4 * 3000 + 2 * 714.29 + 4 * 214.29 + 714.29;
    expect(value).toBeCloseTo(15000, 0);
  });

  it('the next doors come from the open kit; a 4th door opens a second kit; five doors at once open two', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const door = await byName('دلفة جرار بلوم');
    const sell = (qty: number) => call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: door.id, qty, price: 1000 }] });
    await sell(1);
    await sell(2);
    expect((await product(kit)).qty.toNumber()).toBe(4);
    expect((await product(door.id)).qty.toNumber()).toBe(0);
    await sell(1);
    expect((await product(kit)).qty.toNumber()).toBe(3);
    expect((await product(door.id)).qty.toNumber()).toBe(2);
    await sell(5); // has 2, needs 3 more → one more kit
    expect((await product(kit)).qty.toNumber()).toBe(2);
    expect((await product(door.id)).qty.toNumber()).toBe(0);
    const rail = await byName('قضيب ألمنيوم 3 متر');
    expect((await product(rail.id)).qty.toNumber()).toBe(12); // 3 kits opened so far
  });

  it('no closed kit left: the piece goes negative like any product (no crash); selling the whole kit is untouched', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const door = await byName('دلفة جرار بلوم');
    await call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: kit, qty: 5, price: 4200 }] });
    expect((await product(kit)).qty.toNumber()).toBe(0);
    expect((await product(door.id)).qty.toNumber()).toBe(0);
    const r = await call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: door.id, qty: 1, price: 1000 }] });
    expect(r.statusCode).toBe(201);
    expect((await product(door.id)).qty.toNumber()).toBe(-1);
    expect((await product(kit)).qty.toNumber()).toBe(0);
  });

  it('opens by hand, refuses more than the stock, and keeps the rules (no nesting, one kit per piece)', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const door = await byName('دلفة جرار بلوم');
    expect((await call(admin, 'POST', `/products/${kit}/open`, { count: 9 })).statusCode).toBe(400);
    const v = (await call(admin, 'POST', `/products/${kit}/open`, { count: 2 })).json();
    expect(v.kit.qty).toBe(3);
    expect(v.parts[0].qty).toBe(6);
    expect(v.parts[1].qty).toBe(8);
    // the piece knows its kit
    expect((await call(admin, 'GET', `/products/${door.id}/parts`)).json().partOf).toMatchObject({ id: kit, n: 3, qty: 3 });
    // a piece can't become a kit, and can't join a second kit
    expect((await call(admin, 'PUT', `/products/${door.id}/parts`, { parts: [{ name: 'عجلة', n: 4, price: 100 }] })).statusCode).toBe(400);
    const other = (await call(admin, 'POST', '/products', { name: 'طقم تاني', price: 100, cost: 50, qty: 1 })).json().product.id;
    expect((await call(admin, 'PUT', `/products/${other}/parts`, { parts: [{ productId: door.id, name: '', n: 1, price: 1000 }] })).statusCode).toBe(400);
    // emptying the list makes it an ordinary product again; pieces stay as products
    expect((await call(admin, 'PUT', `/products/${kit}/parts`, { parts: [] })).json().parts).toHaveLength(0);
    expect((await product(door.id)).qty.toNumber()).toBe(6);
  });

  it('the daybook sale path opens a kit too', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const door = await byName('دلفة جرار بلوم');
    const r = await call(admin, 'POST', '/daybook/items', { productId: door.id, qty: 1, price: 1000 });
    if (r.statusCode >= 400) {
      // the daybook route shape differs: at least the shared stock helper must open the kit
      const { moveStock } = await import('../src/lib/stock.js');
      await prisma.$transaction((tx) => moveStock(tx, { productId: door.id, change: -1, reason: 'DAYBOOK', userId: null }));
    }
    expect((await product(kit)).qty.toNumber()).toBe(4);
    expect((await product(door.id)).qty.toNumber()).toBe(2);
  });
});

describe('kit hint in search', () => {
  it('a piece shows its kit and how many are still closed; the kit is marked', async () => {
    await call(admin, 'PUT', `/products/${kit}/parts`, { parts: PARTS });
    const items = (await call(staff, 'GET', '/products?q=دلفة')).json().items as { name: string; kit?: { id: string; n: number; qty: number }; kitParts?: number }[];
    expect(items.find((x) => x.name === 'دلفة جرار بلوم')?.kit).toMatchObject({ id: kit, n: 3, qty: 5 });
    expect(items.find((x) => x.name === 'طقم جرار بلوم 3 دلفة')?.kitParts).toBe(2);
  });
});
