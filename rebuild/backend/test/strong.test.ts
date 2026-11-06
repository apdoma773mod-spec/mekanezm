import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';
import { suggestPrice } from '../src/modules/products/cost-rises.js';

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

const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const product = async (name: string, price = 100, cost = 60) => (await call(admin, 'POST', '/products', { name, price, cost, qty: 100, minQty: 1, unit: 'قطعة' })).json().product;
const buy = (pid: string, price: number, person = 'مورد') => call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person, items: [{ productId: pid, name: 'x', qty: 5, price }] });
const sell = (pid: string, person: string, qty: number, paid?: number) => call(admin, 'POST', '/invoices', { kind: 'SALE', person, items: [{ productId: pid, name: 'x', qty, price: 100 }], ...(paid !== undefined ? { paid } : {}) });

describe('cost rises', () => {
  it('keeps the margin when suggesting a price', () => {
    expect(suggestPrice(100, 60, 66)).toBe(110);
    expect(suggestPrice(0, 60, 66)).toBe(0);
  });

  it('a purchase 10% above the old cost lands on the list with a suggestion; a small rise does not; apply changes the sell price', async () => {
    const a = await product('مقبض');
    const b = await product('مفصلة');
    await buy(a.id, 66);
    await buy(b.id, 61);
    expect((await call(staff, 'GET', '/cost-rises')).statusCode).toBe(403);
    const L = (await call(admin, 'GET', '/cost-rises')).json().items;
    expect(L).toHaveLength(1);
    expect(L[0]).toMatchObject({ name: 'مقبض', oldCost: 60, newCost: 66, sell: 100, suggested: 110, pct: 10 });
    // the owner's own purchases are not alerted (skip_admin); a worker's purchase is
    const c = await product('كوالين');
    await call(staff, 'POST', '/invoices', { kind: 'PURCHASE', person: 'مورد', items: [{ productId: c.id, name: 'x', qty: 5, price: 70 }] });
    expect((await prisma.outboundMessage.findMany({ where: { body: { contains: 'تكلفة' } } })).length).toBeGreaterThan(0);
    expect((await call(admin, 'POST', `/cost-rises/${a.id}/apply`, { price: 112 })).statusCode).toBe(200);
    expect(Number((await prisma.product.findUnique({ where: { id: a.id } }))!.price)).toBe(112);
    expect((await call(admin, 'GET', '/cost-rises')).json().items.map((x: { name: string }) => x.name)).toEqual(['كوالين']);
  });
});

describe('customer rating', () => {
  it('new, cash, and late customers', async () => {
    const p = await product('صنف');
    const c = (await call(admin, 'POST', '/contacts', { type: 'CUSTOMER', name: 'عميل جديد' })).json().contact;
    expect((await call(staff, 'GET', `/contact-rating/${c.id}`)).json().rating).toMatchObject({ isNew: true });
    await sell(p.id, 'عميل جديد', 1);
    expect((await call(staff, 'GET', `/contact-rating/${c.id}`)).json().rating).toMatchObject({ stars: 5, label: 'بيدفع كاش' });
    await sell(p.id, 'عميل جديد', 2, 0);
    expect((await call(staff, 'GET', `/contact-rating/${c.id}`)).json().rating).toMatchObject({ stars: 5, days: 0 });
    // make the open invoice 45 days old
    await prisma.invoice.updateMany({ where: { remaining: { gt: 0 } }, data: { date: new Date(Date.now() - 45 * 864e5) } });
    const r = (await call(staff, 'GET', `/contact-rating/${c.id}`)).json().rating;
    expect(r.stars).toBe(3);
    expect(r.days).toBeGreaterThanOrEqual(44);
  });
});

describe('returns analysis and accountant export', () => {
  it('counts what comes back by product and person, with the reasons', async () => {
    const p = await product('كوالين');
    await sell(p.id, 'ست منى', 10);
    await call(admin, 'POST', '/returns', { kind: 'SALE', productId: p.id, person: 'ست منى', qty: 2, price: 100, note: 'مقاس غلط' });
    await call(admin, 'POST', '/returns', { kind: 'PURCHASE', productId: p.id, person: 'مورد الأمل', qty: 1, price: 60, note: 'عيب تصنيع' });
    expect((await call(staff, 'GET', '/reports/returns-analysis')).statusCode).toBe(403);
    const r = (await call(admin, 'GET', '/reports/returns-analysis')).json().report;
    expect(r.sale).toMatchObject({ count: 1, total: 200, salesTotal: 1000, ratePct: 20 });
    expect(r.purchase).toMatchObject({ count: 1, total: 60 });
    expect(r.products.find((x: { kind: string }) => x.kind === 'SALE')).toMatchObject({ name: 'كوالين', qty: 2, ratePct: 20 });
    expect(r.people.map((x: { name: string }) => x.name)).toContain('مورد الأمل');
    expect(r.reasons.map((x: { note: string }) => x.note)).toEqual(expect.arrayContaining(['مقاس غلط', 'عيب تصنيع']));
  });

  it('the month export has the sheets and the numbers', async () => {
    const p = await product('صنف');
    await sell(p.id, 'زبون', 3);
    await buy(p.id, 60);
    await call(admin, 'POST', '/expenses', { note: 'كهرباء', category: 'عام', amount: 100, method: 'CASH', company: 'MK' });
    const month = new Date().toISOString().slice(0, 7);
    expect((await call(staff, 'GET', `/reports/accountant?month=${month}`)).statusCode).toBe(403);
    const x = (await call(admin, 'GET', `/reports/accountant?month=${month}`)).json();
    expect(x.sheets.map((s: { name: string }) => s.name)).toEqual(['ملخص', 'مبيعات', 'مشتريات', 'مصروفات', 'دفعات', 'مرتجعات', 'أرصدة']);
    const sum = x.sheets[0].rows;
    expect(sum.find((r: unknown[]) => r[0] === 'إجمالي المبيعات')[1]).toBe(300);
    expect(sum.find((r: unknown[]) => r[0] === 'إجمالي المصروفات')[1]).toBe(100);
    expect(x.sheets[1].rows).toHaveLength(2);
    expect((await call(admin, 'GET', '/reports/accountant?month=2026-13')).statusCode).toBe(400);
  });
});
