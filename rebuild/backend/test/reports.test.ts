import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { REPORT_IDS } from '@mk/shared';
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

async function product(name: string, price: number, cost: number, qty: number, minQty = 0) {
  return (await call(admin, 'POST', '/products', { name, price, cost, qty, minQty })).json().product as { id: string };
}

describe('reports', () => {
  it('are admin only', async () => {
    expect((await call(staff, 'GET', '/reports/perf')).statusCode).toBe(403);
  });

  it('every report runs on an empty and on a busy shop', async () => {
    for (const id of REPORT_IDS) expect((await call(admin, 'GET', `/reports/${id}`)).statusCode, id).toBe(200);
    const p = await product('مفصلة', 50, 30, 10, 2);
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 50, items: [{ productId: p.id, qty: 4, price: 50 }] });
    await call(admin, 'POST', '/expenses', { category: 'نقل', amount: 20 });
    for (const id of REPORT_IDS) expect((await call(admin, 'GET', `/reports/${id}`)).statusCode, id).toBe(200);
  });

  it('the performance summary adds up like the old one', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(admin, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 4, price: 50 }] });
    await call(admin, 'POST', '/expenses', { category: 'نقل', amount: 20 });
    const r = (await call(admin, 'GET', '/reports/perf')).json().report;
    const val = (label: string) => r.rows.find((x: { c: unknown[] }) => x.c[0] === label).c[1];
    expect(val('صافي المبيعات')).toBe(200);
    expect(val('(–) تكلفة البضاعة')).toBe(-120);
    expect(val('مجمل الربح')).toBe(80);
    expect(val('صافي الربح')).toBe(60);
    expect((await call(admin, 'GET', '/reports/headline')).json().headline).toEqual({ net: 200, gross: 80, np: 60 });
  });

  it('low stock suggests a quantity and customer debts link to the contact', async () => {
    const p = await product('مفصلة', 50, 30, 3, 5);
    await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 0, items: [{ productId: p.id, qty: 1, price: 50 }] });
    const low = (await call(admin, 'GET', '/reports/stockLow')).json().report;
    const c = low.rows[0].c;
    expect([c[1], c[3], c[4], c[5]]).toEqual(['مفصلة', 2, 5, 8]);
    const debt = (await call(admin, 'GET', '/reports/debtC')).json().report;
    expect(debt.rows).toHaveLength(1);
    expect(debt.rows[0].c[2]).toBe(50);
    expect(debt.rows[0].go.kind).toBe('contact');
  });
});
