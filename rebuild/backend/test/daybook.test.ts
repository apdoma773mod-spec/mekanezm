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

const call = (cookie: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function product(name: string, price: number, cost: number, qty: number) {
  return (await call(admin, 'POST', '/products', { name, price, cost, qty })).json().product as { id: string };
}
const qtyOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).qty);

describe('daybook', () => {
  it('takes stock out right away and gives it back on edit and delete', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const add = await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 3, price: 50 });
    expect(add.statusCode).toBe(201);
    expect(await qtyOf(p.id)).toBe(7);
    const id = add.json().entry.id;
    await call(staff, 'PATCH', `/daybook/${id}`, { qty: 5 });
    expect(await qtyOf(p.id)).toBe(5);
    await call(staff, 'DELETE', `/daybook/${id}`);
    expect(await qtyOf(p.id)).toBe(10);
  });

  it('keeps undelivered «باقي له» pieces in stock until delivered', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const add = await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 4, owed: 3, price: 50, person: 'علي', pay: 'CREDIT' });
    expect(await qtyOf(p.id)).toBe(9);
    const day = (await call(staff, 'GET', '/daybook')).json();
    expect(day.owed).toHaveLength(1);
    await call(staff, 'POST', `/daybook/${add.json().entry.id}/deliver`);
    expect(await qtyOf(p.id)).toBe(6);
    expect((await call(staff, 'GET', '/daybook')).json().owed).toHaveLength(0);
  });

  it('refuses credit without a name and owed above the quantity', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    expect((await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 1, price: 50, pay: 'CREDIT' })).statusCode).toBe(400);
    expect((await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 1, owed: 2, price: 50 })).statusCode).toBe(400);
  });

  it('settles one invoice per customer with mixed payments, without moving stock twice', async () => {
    const p = await product('مفصلة', 50, 30, 20);
    await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 2, price: 50, pay: 'CASH' });
    await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 1, price: 50, pay: 'INSTAPAY' });
    await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 4, price: 50, person: 'سمير', pay: 'CREDIT' });
    await call(staff, 'POST', '/daybook', { kind: 'PAY', person: 'سمير', price: 120, pay: 'TRANSFER' });
    expect(await qtyOf(p.id)).toBe(13);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
    const res = await call(staff, 'POST', '/daybook/post', { day: today });
    expect(res.statusCode).toBe(200);
    const invs = res.json().invoices;
    expect(invs).toHaveLength(2);
    expect(await qtyOf(p.id)).toBe(13);

    const nameless = await prisma.invoice.findFirstOrThrow({ where: { person: 'يومية' } });
    expect(Number(nameless.total)).toBe(150);
    expect(nameless.contactId).toBeNull();
    expect(nameless.paidSplit).toEqual({ CASH: 100, INSTAPAY: 50 });
    const samir = await prisma.invoice.findFirstOrThrow({ where: { person: 'سمير' } });
    expect([Number(samir.total), Number(samir.paid), Number(samir.remaining)]).toEqual([200, 120, 80]);
    expect(Number((await prisma.contact.findFirstOrThrow({ where: { name: 'سمير' } })).balance)).toBe(80);

    const cash = (await call(admin, 'GET', '/cash/summary')).json().summary;
    expect(cash.byMethod.CASH.in).toBe(100);
    expect(cash.byMethod.INSTAPAY.in).toBe(50);
    expect(cash.byMethod.TRANSFER.in).toBe(120);

    const entry = await prisma.daybookEntry.findFirstOrThrow({ where: { pay: 'INSTAPAY' } });
    await call(staff, 'POST', `/daybook/${entry.id}/pay`, { pay: 'CASH' });
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: nameless.id } });
    expect(after.paidSplit).toEqual({ CASH: 150 });
    expect((await call(staff, 'PATCH', `/daybook/${entry.id}`, { qty: 9 })).statusCode).toBe(400);
  });

  it('voiding a settled invoice with undelivered pieces restores stock correctly', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/daybook', { kind: 'ITEM', productId: p.id, qty: 4, owed: 1, price: 50 });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
    const posted = (await call(staff, 'POST', '/daybook/post', { day: today })).json();
    expect(await qtyOf(p.id)).toBe(7);
    await call(admin, 'POST', `/invoices/${posted.invoices[0].id}/void`, { reason: 'غلط' });
    expect(await qtyOf(p.id)).toBe(10);
  });
});

describe('closing and stock count', () => {
  it('summarises the day and saves the counted cash with the difference', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 2, price: 50 }] });
    await call(admin, 'POST', '/expenses', { category: 'نقل', amount: 20 });
    const s = (await call(staff, 'GET', '/closings/summary')).json().summary;
    expect(s).toMatchObject({ salesCount: 1, salesTotal: 100, expenses: 20, cashExpected: 80 });
    expect(s.profit).toBeUndefined();
    expect((await call(admin, 'GET', '/closings/summary')).json().summary.profit).toBe(40);

    const saved = await call(staff, 'POST', '/closings', { day: s.day, cashActual: 75, note: 'ناقص ٥' });
    expect(saved.json().closing).toMatchObject({ cashExpected: 80, cashActual: 75, cashDiff: -5 });
    expect((await call(staff, 'GET', '/closings')).statusCode).toBe(403);
    expect((await call(admin, 'GET', '/closings')).json().total).toBe(1);
  });

  it('a count sets quantities and values the shortage and excess at cost', async () => {
    const a = await product('مفصلة', 50, 30, 10);
    const b = await product('مقبض', 20, 10, 5);
    const res = await call(admin, 'POST', '/counts', { items: [{ productId: a.id, counted: 8 }, { productId: b.id, counted: 7 }], note: 'جرد آخر الشهر' });
    expect(res.json().count).toMatchObject({ no: 'JR-0001', itemCount: 2, shortValue: 60, excessValue: 20 });
    expect(await qtyOf(a.id)).toBe(8);
    expect(await qtyOf(b.id)).toBe(7);
    expect((await call(staff, 'POST', '/counts', { items: [{ productId: a.id, counted: 1 }] })).statusCode).toBe(403);
  });
});
