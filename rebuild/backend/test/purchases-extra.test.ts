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
  pid = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 50, cost: 10, qty: 0 })).json().product.id;
});

const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const buy = async (person: string, price: number, date: string, paid = 0, note = '') =>
  (await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', date, person, note, items: [{ productId: pid, qty: 5, price }], paid })).json().invoice;

describe('purchases screen extras', () => {
  it('filters by supplier and payment, searches the supplier invoice number, and previews three lines', async () => {
    await buy('المورد أ', 20, '2026-10-01', 100, 'فاتورة المورد: 8812 — جاية بالعربية');
    await buy('المورد ب', 15, '2026-10-02', 0);
    const all = (await call(admin, 'GET', '/invoices?kind=PURCHASE')).json();
    expect(all.total).toBe(2);
    expect(all.items[0].preview).toEqual([{ name: 'مفصلة', qty: 5 }]);
    expect((await call(admin, 'GET', '/invoices?kind=PURCHASE&person=المورد ب')).json().total).toBe(1);
    expect((await call(admin, 'GET', '/invoices?kind=PURCHASE&pay=paid')).json().items.map((x: { person: string }) => x.person)).toEqual(['المورد أ']);
    expect((await call(admin, 'GET', '/invoices?kind=PURCHASE&pay=credit')).json().items.map((x: { person: string }) => x.person)).toEqual(['المورد ب']);
    expect((await call(admin, 'GET', '/invoices?kind=PURCHASE&q=8812')).json().total).toBe(1);
    expect((await call(admin, 'GET', '/invoices/persons?kind=PURCHASE')).json().persons).toEqual(['المورد أ', 'المورد ب']);
  });

  it('shows the cost change against the previous purchase and can push it to stock', async () => {
    await buy('المورد أ', 20, '2026-10-01', 100);
    const second = await buy('المورد أ', 25, '2026-10-05', 125);
    const items = (await call(admin, 'GET', `/invoices/${second.id}/cost-change`)).json().items;
    expect(items).toEqual([{ name: 'مفصلة', productId: pid, price: 25, prev: 20, cost: 25 }]);
    // make the stock cost different, then push the invoice prices
    await app.inject({ method: 'PATCH', url: `/api/v1/products/${pid}`, headers: { cookie: admin }, payload: { cost: 7 } });
    expect((await call(admin, 'POST', `/invoices/${second.id}/apply-cost`, {})).json().updated).toBe(1);
    expect(Number((await call(admin, 'GET', `/products/${pid}`)).json().product.cost)).toBe(25);
    expect((await call(staff, 'GET', `/invoices/${second.id}/cost-change`)).statusCode).toBe(403);
  });

  it('spots a duplicate purchase: same supplier and total, with the same supplier number or the same day', async () => {
    await buy('المورد أ', 20, new Date().toISOString().slice(0, 10), 100, 'فاتورة المورد: 55');
    const dup = (b: object) => call(staff, 'POST', '/invoices/check-duplicate', b);
    expect((await dup({ person: 'المورد أ', total: 100, sno: '55' })).json().duplicate).toMatchObject({ total: 100 });
    expect((await dup({ person: 'المورد أ', total: 100, sno: '56' })).json().duplicate).toBeNull();
    expect((await dup({ person: 'المورد ب', total: 100, sno: '55' })).json().duplicate).toBeNull();
  });
});
