import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN');
  admin = await login(app, '01000000001');
});

describe('supplier discount on purchase lines', () => {
  it('stock cost is the price AFTER the discount; total = qty × list × (1 − d); the DTO keeps list price and %', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'مجرى بالما 50', price: 400, cost: 0, qty: 0 })).json().product.id;
    const r = await call(admin, 'POST', '/invoices', {
      kind: 'PURCHASE',
      person: 'الطنطاوي',
      paid: 0,
      supplierDisc: 10,
      items: [{ productId: p, qty: 50, price: 305, discPct: 10 }],
    });
    expect(r.statusCode).toBe(201);
    const inv = r.json().invoice;
    expect(inv.total).toBe(13725); // 50 × 305 × 0.9 — the figure written on the supplier's invoice
    expect(inv.items[0]).toMatchObject({ price: 274.5, listPrice: 305, discPct: 10, total: 13725 });
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: p } });
    expect(prod.cost.toNumber()).toBe(274.5);
    expect(prod.qty.toNumber()).toBe(50);
    // the supplier remembers the discount for the next invoice
    const c = (await call(admin, 'GET', '/contacts?type=SUPPLIER')).json().items[0];
    expect(c.buyDisc).toBe(10);
  });

  it('no discount: nothing changes (price = list price, discPct 0), and the supplier discount can be cleared', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'صفاية', price: 500, cost: 0, qty: 0 })).json().product.id;
    await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'المورد', paid: 0, supplierDisc: 10, items: [{ productId: p, qty: 1, price: 100, discPct: 10 }] });
    const r = await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'المورد', paid: 0, supplierDisc: 0, items: [{ productId: p, qty: 2, price: 100 }] });
    const it = r.json().invoice.items[0];
    expect(it).toMatchObject({ price: 100, listPrice: 100, discPct: 0, total: 200 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p } })).cost.toNumber()).toBe(100);
    expect((await call(admin, 'GET', '/contacts?type=SUPPLIER')).json().items[0].buyDisc).toBe(0);
  });

  it('an old screen (no discPct / supplierDisc) works as before; a sale ignores discPct', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'قفل', price: 80, cost: 30, qty: 5 })).json().product.id;
    const buy = await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'م', paid: 0, items: [{ productId: p, qty: 2, price: 40 }] });
    expect(buy.json().invoice.items[0]).toMatchObject({ price: 40, total: 80, discPct: 0 });
    const sale = await call(admin, 'POST', '/invoices', { kind: 'SALE', paid: 80, items: [{ productId: p, qty: 1, price: 80, discPct: 50 }] });
    expect(sale.json().invoice.items[0]).toMatchObject({ price: 80, total: 80, discPct: 0 });
  });

  it('editing the invoice keeps list price and discount; the stock cost follows', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'سلة', price: 3000, cost: 0, qty: 0 })).json().product.id;
    const id = (await call(admin, 'POST', '/invoices', { kind: 'PURCHASE', person: 'المورد', paid: 0, items: [{ productId: p, qty: 2, price: 2300, discPct: 10 }] })).json().invoice.id;
    const u = await call(admin, 'PUT', `/invoices/${id}`, { company: 'MK', person: 'المورد', paid: 0, items: [{ productId: p, qty: 2, price: 2300, discPct: 20 }] });
    expect(u.statusCode).toBe(200);
    expect(u.json().invoice.items[0]).toMatchObject({ price: 1840, listPrice: 2300, discPct: 20, total: 3680 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p } })).cost.toNumber()).toBe(1840);
  });
});

describe('supplier phones', () => {
  it('keeps several numbers with their names, the main one stays in phone, and an old screen update does not wipe them', async () => {
    const c = (
      await call(admin, 'POST', '/contacts', {
        type: 'SUPPLIER',
        name: 'الطنطاوي',
        phone: '01011111111',
        phones: [
          { n: '01022222222', l: 'صاحب المؤسسة' },
          { n: '0233334444', l: 'أرضي' },
        ],
      })
    ).json().contact;
    expect(c.phone).toBe('01011111111');
    expect(c.phones).toEqual([
      { n: '01022222222', l: 'صاحب المؤسسة' },
      { n: '0233334444', l: 'أرضي' },
    ]);
    // an old screen saves only name/phone: the extra numbers stay
    await call(admin, 'PATCH', `/contacts/${c.id}`, { phone: '01011111111', address: 'الجيزة' });
    expect((await call(admin, 'GET', `/contacts/${c.id}`)).json().contact.phones).toHaveLength(2);
    // searching any of the numbers finds him
    expect((await call(admin, 'GET', '/contacts?q=22222222')).json().items.map((x: { name: string }) => x.name)).toEqual(['الطنطاوي']);
    expect((await call(admin, 'GET', '/contacts?q=33334444')).json().items).toHaveLength(1);
    expect((await call(admin, 'GET', '/contacts?q=99999999')).json().items).toHaveLength(0);
    // editing the list replaces it
    const u = (await call(admin, 'PATCH', `/contacts/${c.id}`, { phones: [{ n: '01033333333', l: 'موظف' }] })).json().contact;
    expect(u.phones).toEqual([{ n: '01033333333', l: 'موظف' }]);
    expect((await call(admin, 'PATCH', `/contacts/${c.id}`, { phones: [] })).json().contact.phones).toEqual([]);
  });
});
