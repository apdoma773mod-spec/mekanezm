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

async function product(name: string, price: number, cost: number, qty: number, minQty = 0) {
  return (await call(admin, 'POST', '/products', { name, price, cost, qty, minQty })).json().product as { id: string };
}

describe('debts and reminders', () => {
  it('lists debtors with their open invoices and remembers reminders', async () => {
    expect((await call(staff, 'GET', '/insights/debts')).statusCode).toBe(403);
    const p = await product('مفصلة', 50, 30, 10);
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 20, items: [{ productId: p.id, qty: 2, price: 50 }] });
    const d = (await call(admin, 'GET', '/insights/debts')).json();
    expect(d.template).toContain('{الاسم}');
    expect(d.debtors).toHaveLength(1);
    const x = d.debtors[0];
    expect(x).toMatchObject({ name: 'سمير', balance: 80, old: false, days: 0, reminder: null });
    expect(x.open).toHaveLength(1);
    await call(admin, 'POST', `/insights/debts/${x.id}/remind`);
    await call(admin, 'PUT', '/insights/debts/template', { text: 'أهلاً {الاسم}' });
    const d2 = (await call(admin, 'GET', '/insights/debts')).json();
    expect(d2.debtors[0].reminder.amount).toBe(80);
    expect(d2.template).toBe('أهلاً {الاسم}');
  });
});

describe('reorder and charts', () => {
  it('suggests products under their minimum with the last supplier', async () => {
    const p = await product('مفصلة', 50, 30, 0, 4);
    await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'الأمل', paid: 0, items: [{ productId: p.id, qty: 2, price: 30 }] });
    const s = (await call(admin, 'GET', '/insights/reorder?days=30')).json().suggestions;
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ name: 'مفصلة', qty: 2, min: 4, supplier: 'الأمل', need: 4 });
  });

  it('charts cover 30 days and 6 months', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 2, price: 50 }] });
    const c = (await call(admin, 'GET', '/insights/charts')).json().charts;
    expect(c.daily).toHaveLength(30);
    expect(c.daily[29].v).toBe(100);
    expect(c.monthly).toHaveLength(6);
    expect(c.monthly[5]).toMatchObject({ sales: 100, gross: 40, v: 40 });
    expect(c.top[0]).toEqual({ n: 'مفصلة', v: 100 });
  });
});
