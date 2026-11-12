import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { moveStock } from '../src/lib/stock.js';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let hinge: string;
let screw: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  admin = await login(app, '01000000001');
  hinge = (await call('POST', '/products', { name: 'مفصلة', price: 10, cost: 6, qty: 100, minQty: 1, unit: 'قطعة' })).json().product.id;
  screw = (await call('POST', '/products', { name: 'مسمار', price: 1, cost: 0.5, qty: 50, minQty: 1, unit: 'قطعة' })).json().product.id;
});

const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie: admin }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sell = (productId: string, n: number) => prisma.$transaction((tx) => moveStock(tx, { productId, change: -n, reason: 'SALE', userId: null }));
const qtyOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).qty);

describe('stock count while selling', () => {
  it('counted 100, 30 sold after counting → stock is 70, not 100', async () => {
    const at = new Date().toISOString();
    await sleep(40);
    await sell(hinge, 30);
    const res = await call('POST', '/counts', { items: [{ productId: hinge, counted: 100, countedAt: at }] });
    expect(res.statusCode).toBe(201);
    expect(res.json().count.items[0]).toMatchObject({ before: 100, counted: 100, diff: 0, after: 70 });
    expect(await qtyOf(hinge)).toBe(70);
  });

  it('a real shortage is kept and the later sales stay: counted 95 of 100, then 30 sold → 65', async () => {
    const at = new Date().toISOString();
    await sleep(40);
    await sell(hinge, 30);
    const res = await call('POST', '/counts', { items: [{ productId: hinge, counted: 95, countedAt: at }] });
    expect(res.json().count.items[0]).toMatchObject({ before: 100, diff: -5, after: 65 });
    expect(res.json().count.shortValue).toBe(30);
    expect(await qtyOf(hinge)).toBe(65);
  });

  it('three days of counting: each product is reconciled at its own count time', async () => {
    const t1 = new Date().toISOString(); // day 1: hinges counted
    await sleep(40);
    await sell(hinge, 30); // sold after the hinge count
    await sell(screw, 10); // sold BEFORE the screw count
    await sleep(40);
    const t3 = new Date().toISOString(); // day 3: screws counted (40 really there)
    await sleep(40);
    await sell(screw, 5);
    await sell(hinge, 20);
    const res = await call('POST', '/counts', { items: [{ productId: hinge, counted: 100, countedAt: t1 }, { productId: screw, counted: 40, countedAt: t3 }] });
    const L = res.json().count.items as { productId: string; before: number; diff: number; after: number }[];
    expect(L.find((x) => x.productId === hinge)).toMatchObject({ before: 100, diff: 0, after: 50 });
    expect(L.find((x) => x.productId === screw)).toMatchObject({ before: 40, diff: 0, after: 35 });
    expect(await qtyOf(hinge)).toBe(50);
    expect(await qtyOf(screw)).toBe(35);
  });

  it('purchases and returns that happened after the count are kept too', async () => {
    const at = new Date().toISOString();
    await sleep(40);
    await prisma.$transaction((tx) => moveStock(tx, { productId: hinge, change: 40, reason: 'PURCHASE', userId: null }));
    const res = await call('POST', '/counts', { items: [{ productId: hinge, counted: 98, countedAt: at }] });
    expect(res.json().count.items[0]).toMatchObject({ before: 100, diff: -2, after: 138 });
  });

  it('old screens (no time) still work: counted vs the current stock', async () => {
    const res = await call('POST', '/counts', { items: [{ productId: hinge, counted: 90 }] });
    expect(res.json().count.items[0]).toMatchObject({ before: 100, diff: -10 });
    expect(await qtyOf(hinge)).toBe(90);
    const legacy = await call('POST', '/counts', { items: [{ productId: screw, counted: 45, baseline: 50 }] });
    expect(legacy.json().count.items[0]).toMatchObject({ before: 50, diff: -5 });
  });

  it('preview gives the same numbers as the save and changes nothing; it flags products that would go negative', async () => {
    const at = new Date().toISOString();
    await sleep(40);
    await sell(screw, 45);
    const items = [{ productId: hinge, counted: 100, countedAt: at }, { productId: screw, counted: 40, countedAt: at }];
    const p = (await call('POST', '/counts/preview', { items })).json();
    expect(p.lines.find((l: { productId: string }) => l.productId === screw)).toMatchObject({ before: 50, diff: -10, after: -5 });
    expect(p.negative).toHaveLength(1);
    expect(await qtyOf(screw)).toBe(5);
    await call('POST', '/counts', { items });
    expect(await qtyOf(screw)).toBe(-5);
  });

  it('two devices counting the same session do not erase each other', async () => {
    const items = { [hinge]: { start: 100, cnt: null, qAt: null }, [screw]: { start: 50, cnt: null, qAt: null } };
    await call('POST', '/counts/session-op', { op: 'create', session: { id: 's1', name: 'رف', cat: '', created: new Date().toISOString(), status: 'open', items } });
    await call('POST', '/counts/session-op', { op: 'set', sid: 's1', pid: hinge, cnt: '70' });
    const r = await call('POST', '/counts/session-op', { op: 'set', sid: 's1', pid: screw, cnt: '48' });
    const s = r.json().value[0];
    expect(s.items[hinge].cnt).toBe('70');
    expect(s.items[screw].cnt).toBe('48');
    expect(s.items[screw].at).toBeTruthy();
    const closed = await call('POST', '/counts/session-op', { op: 'close', sid: 's1', approved: new Date().toISOString() });
    expect(closed.json().value[0].status).toBe('closed');
    expect((await call('POST', '/counts/session-op', { op: 'set', sid: 's1', pid: hinge, cnt: '1' })).statusCode).toBe(400);
    expect((await call('POST', '/counts/session-op', { op: 'close', sid: 's1', approved: 'x' })).statusCode).toBe(400);
  });

  it('approving a session counted over days: sales in between are kept, and a second approve is refused', async () => {
    const items = { [hinge]: { start: 100, cnt: null, qAt: null }, [screw]: { start: 50, cnt: null, qAt: null } };
    await call('POST', '/counts/session-op', { op: 'create', session: { id: 's2', name: 'جرد ٣ أيام', cat: '', created: new Date().toISOString(), status: 'open', items } });
    await call('POST', '/counts/session-op', { op: 'set', sid: 's2', pid: hinge, cnt: '100' }); // day 1
    await sleep(40);
    await sell(hinge, 30); // the guys take 30
    await sell(screw, 5);
    await sleep(40);
    const r = await call('POST', '/counts/session-op', { op: 'set', sid: 's2', pid: screw, cnt: '40' }); // day 3: 45 in system, counted 40
    expect(r.json().value[0].items[screw].qAt).toBe(45);
    await sell(screw, 2); // sold after the count
    const pv = (await call('POST', '/counts/session-preview', { sid: 's2' })).json();
    expect(pv.lines.find((l: { productId: string }) => l.productId === hinge)).toMatchObject({ before: 100, diff: 0, after: 70 });
    expect(pv.lines.find((l: { productId: string }) => l.productId === screw)).toMatchObject({ before: 45, diff: -5, after: 38 });
    expect(await qtyOf(hinge)).toBe(70);
    const ok = await call('POST', '/counts/session-approve', { sid: 's2' });
    expect(ok.statusCode).toBe(200);
    expect(await qtyOf(hinge)).toBe(70);
    expect(await qtyOf(screw)).toBe(38);
    expect(ok.json().value[0].status).toBe('closed');
    expect((await call('POST', '/counts/session-approve', { sid: 's2' })).statusCode).toBe(400);
    expect(await qtyOf(screw)).toBe(38);
  });
});
