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
  await createUser(prisma, '01000000001', 'ADMIN', 'المدير');
  await createUser(prisma, '01100000001', 'STAFF', 'موظف');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function product(name: string, price: number, cost: number, qty: number) {
  const res = await call(admin, 'POST', '/products', { name, price, cost, qty, unit: 'قطعة' });
  expect(res.statusCode).toBe(201);
  return res.json().product as { id: string; code: string };
}

const qtyOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).qty);
const balanceOf = async (name: string) => Number((await prisma.contact.findFirstOrThrow({ where: { name } })).balance);

describe('products', () => {
  it('generates codes, records opening stock, and hides cost from staff', async () => {
    const a = await product('مفصلة', 50, 30, 10);
    const b = await product('مقبض', 20, 12, 0);
    expect([a.code, b.code]).toEqual(['P0001', 'P0002']);
    const moves = await prisma.stockMove.findMany({ where: { productId: a.id } });
    expect(moves).toHaveLength(1);
    expect(Number(moves[0]!.qtyAfter)).toBe(10);

    const asStaff = await call(staff, 'GET', `/products/${a.id}`);
    expect(asStaff.json().product.cost).toBeUndefined();
    expect((await call(staff, 'POST', '/products', { name: 'x' })).statusCode).toBe(403);
  });

  it('never reuses a deleted code and accepts Arabic digits', async () => {
    const res = await call(admin, 'POST', '/products', { code: 'a١٢', name: 'سلك', price: '١٥٫٥' });
    expect(res.json().product).toMatchObject({ code: 'A12', price: 15.5 });
    await call(admin, 'DELETE', `/products/${res.json().product.id}`);
    const again = await call(admin, 'POST', '/products', { code: 'A12', name: 'تاني' });
    expect(again.statusCode).toBe(409);
  });

  it('adjusts stock to a counted quantity with a reason', async () => {
    const p = await product('ترباس', 10, 5, 7);
    const res = await call(admin, 'POST', `/products/${p.id}/adjust`, { newQty: 4, note: 'جرد' });
    expect(res.json().product.qty).toBe(4);
    const moves = await call(admin, 'GET', `/products/${p.id}/moves`);
    expect(moves.json().items[0]).toMatchObject({ qtyChange: -3, qtyAfter: 4, reason: 'ADJUST', note: 'جرد' });
  });

  it('finds a product by barcode or code', async () => {
    await call(admin, 'POST', '/products', { name: 'شنكل', barcode: '6221234567890' });
    expect((await call(staff, 'GET', '/products/lookup?code=6221234567890')).json().product.name).toBe('شنكل');
    expect((await call(staff, 'GET', '/products/lookup?code=p0001')).json().product.name).toBe('شنكل');
  });
});

describe('sales and purchases', () => {
  it('a cash sale takes stock out, numbers the invoice and computes profit for admins only', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const res = await call(staff, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 3, price: 50 }] });
    expect(res.statusCode).toBe(201);
    const inv = res.json().invoice;
    expect(inv).toMatchObject({ no: 'MK-0001', total: 150, paid: 150, remaining: 0 });
    expect(inv.profit).toBeUndefined();
    expect(await qtyOf(p.id)).toBe(7);
    const asAdmin = await call(admin, 'GET', `/invoices/${inv.id}`);
    expect(asAdmin.json().invoice.profit).toBe(60);
  });

  it('a credit sale creates the customer and puts the rest on their account', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const res = await call(staff, 'POST', '/invoices', {
      kind: 'SALE',
      person: 'أحمد النجار',
      phone: '01011112222',
      paid: 40,
      discount: 10,
      shipping: 20,
      items: [{ productId: p.id, qty: 2, price: 50 }],
    });
    expect(res.json().invoice).toMatchObject({ subtotal: 100, total: 110, paid: 40, remaining: 70 });
    expect(await balanceOf('أحمد النجار')).toBe(70);
  });

  it('refuses credit without a name and paying more than the total', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const noName = await call(staff, 'POST', '/invoices', { kind: 'SALE', paid: 0, items: [{ productId: p.id, qty: 1, price: 50 }] });
    expect(noName.statusCode).toBe(400);
    const over = await call(staff, 'POST', '/invoices', { kind: 'SALE', paid: 60, items: [{ productId: p.id, qty: 1, price: 50 }] });
    expect(over.statusCode).toBe(400);
  });

  it('a purchase adds stock, creates unknown products by name and updates cost', async () => {
    const p = await product('مفصلة', 50, 30, 0);
    const res = await call(admin, 'POST', '/invoices', {
      kind: 'PURCHASE',
      person: 'مورد الديب',
      paid: 0,
      items: [
        { productId: p.id, qty: 20, price: 32 },
        { name: 'مسمار ٤ سم', qty: 100, price: 0.5 },
      ],
    });
    expect(res.json().invoice).toMatchObject({ no: 'SH-0001', total: 690, remaining: 690 });
    expect(await qtyOf(p.id)).toBe(20);
    const created = await prisma.product.findFirstOrThrow({ where: { name: 'مسمار ٤ سم' } });
    expect(Number(created.qty)).toBe(100);
    expect(Number(created.cost)).toBe(0.5);
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).cost)).toBe(32);
    expect(await balanceOf('مورد الديب')).toBe(690);
  });

  it('editing re-applies stock and balance; voiding keeps paid money as credit', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const created = await call(staff, 'POST', '/invoices', {
      kind: 'SALE',
      person: 'سعيد',
      paid: 50,
      items: [{ productId: p.id, qty: 4, price: 50 }],
    });
    const id = created.json().invoice.id;
    expect(await balanceOf('سعيد')).toBe(150);

    expect((await call(staff, 'PUT', `/invoices/${id}`, { person: 'سعيد', items: [] })).statusCode).toBe(403);
    const edited = await call(admin, 'PUT', `/invoices/${id}`, {
      person: 'سعيد',
      paid: 50,
      items: [{ productId: p.id, qty: 2, price: 50 }],
    });
    expect(edited.json().invoice).toMatchObject({ total: 100, remaining: 50 });
    expect(await qtyOf(p.id)).toBe(8);
    expect(await balanceOf('سعيد')).toBe(50);

    const voided = await call(admin, 'POST', `/invoices/${id}/void`, { reason: 'غلط' });
    expect(voided.json().invoice.status).toBe('VOID');
    expect(await qtyOf(p.id)).toBe(10);
    expect(await balanceOf('سعيد')).toBe(-50);
    const again = await call(admin, 'POST', `/invoices/${id}/void`, { reason: 'تاني' });
    expect(again.statusCode).toBe(400);
  });

  it('a purchase whose goods were already sold cannot be voided', async () => {
    const p = await product('مفصلة', 50, 30, 0);
    const pur = await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', items: [{ productId: p.id, qty: 5, price: 30 }] });
    await call(staff, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 1, price: 50 }] });
    const res = await call(admin, 'POST', `/invoices/${pur.json().invoice.id}/void`, { reason: 'x' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('مفصلة');
  });
});

describe('payments, returns, statement and cash', () => {
  it('payments lower the balance, cancelling restores it, and the statement adds up', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'كريم', paid: 0, items: [{ productId: p.id, qty: 4, price: 50 }] });
    const contact = await prisma.contact.findFirstOrThrow({ where: { name: 'كريم' } });

    const pay = await call(admin, 'POST', '/payments', { contactId: contact.id, amount: '٨٠', method: 'INSTAPAY' });
    expect(pay.json().payment).toMatchObject({ direction: 'IN', amount: 80, method: 'INSTAPAY' });
    expect(await balanceOf('كريم')).toBe(120);

    const second = await call(admin, 'POST', '/payments', { contactId: contact.id, amount: 20 });
    await call(admin, 'POST', `/payments/${second.json().payment.id}/cancel`);
    expect(await balanceOf('كريم')).toBe(120);

    const ret = await call(admin, 'POST', '/returns', {
      kind: 'SALE',
      productId: p.id,
      qty: 1,
      price: 50,
      contactId: contact.id,
      settlement: 'BALANCE',
    });
    expect(ret.statusCode).toBe(201);
    expect(await balanceOf('كريم')).toBe(70);
    expect(await qtyOf(p.id)).toBe(7);

    const st = (await call(admin, 'GET', `/contacts/${contact.id}/statement`)).json().statement;
    expect(st.lines.map((l: { kind: string }) => l.kind)).toEqual(['INVOICE', 'PAYMENT', 'RETURN']);
    expect(st.closing).toBe(70);
  });

  it('the cash summary nets sales, purchases, collections, cash returns and expenses', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/invoices', { kind: 'SALE', items: [{ productId: p.id, qty: 2, price: 50 }] });
    await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', items: [{ productId: p.id, qty: 1, price: 30 }] });
    await call(admin, 'POST', '/returns', { kind: 'SALE', productId: p.id, qty: 1, price: 50 });
    await call(admin, 'POST', '/expenses', { category: 'كهرباء', amount: 15 });

    const s = (await call(admin, 'GET', '/cash/summary')).json().summary;
    expect(s.totals).toEqual({ in: 100, out: 95, net: 5 });
    expect(s.byMethod.CASH.net).toBe(5);
    expect(s.moves).toHaveLength(4);

    const today = (await call(staff, 'GET', '/cash/today')).json().today;
    expect(today.sales).toMatchObject({ count: 1, total: 100 });
    expect(today.profit).toBeUndefined();
    expect((await call(staff, 'GET', '/cash/summary')).statusCode).toBe(403);
  });

  it('contacts with a balance cannot be deleted and names stay unique per type', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'هاني', paid: 0, items: [{ productId: p.id, qty: 1, price: 50 }] });
    const c = await prisma.contact.findFirstOrThrow({ where: { name: 'هاني' } });
    expect((await call(admin, 'DELETE', `/contacts/${c.id}`)).statusCode).toBe(400);
    expect((await call(admin, 'POST', '/contacts', { type: 'CUSTOMER', name: 'هاني' })).statusCode).toBe(409);
    expect((await call(admin, 'POST', '/contacts', { type: 'SUPPLIER', name: 'هاني' })).statusCode).toBe(201);
  });
});
