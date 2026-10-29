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

async function product(name: string, price: number, qty: number) {
  return (await call(admin, 'POST', '/products', { name, price, cost: price / 2, qty })).json().product as { id: string };
}

describe('daily Excel import', () => {
  it('is for the owner only', async () => {
    const r = await call(staff, 'POST', '/daybook-import', { date: '2026-10-20', invoices: [] });
    expect(r.statusCode).toBe(403);
  });

  it('records the invoices, takes stock once and shows them as posted daybook rows', async () => {
    const a = await product('فلتر', 100, 10);
    const r = await call(admin, 'POST', '/daybook-import', {
      date: '2026-10-20',
      sig: 'd1',
      invoices: [
        { person: 'سمير', paid: 100, note: 'استيراد يومية Excel', items: [{ productId: a.id, name: 'فلتر', qty: 3, price: 100, pay: 'credit' }] },
        { person: '', noContact: true, paid: 100, items: [{ productId: a.id, name: 'فلتر', qty: 1, price: 100, pay: 'cash' }] },
      ],
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().invoices).toHaveLength(2);
    expect((await call(admin, 'GET', `/products/${a.id}`)).json().product.qty).toBe(6);
    const day = (await call(admin, 'GET', '/daybook?day=2026-10-20')).json();
    expect(day.entries).toHaveLength(2);
    expect(day.entries.every((e: { postedAt: string | null; note: string }) => e.postedAt && e.note === 'يومية استيراد Excel')).toBe(true);
    const contact = (await call(admin, 'GET', '/contacts?q=سمير')).json().items[0];
    expect(contact.balance).toBe(200);
  });

  it('is all or nothing: one bad invoice undoes the whole file', async () => {
    const a = await product('مفصلة', 10, 5);
    const r = await call(admin, 'POST', '/daybook-import', {
      date: '2026-10-20',
      invoices: [
        { person: 'أحمد', paid: 10, items: [{ productId: a.id, name: 'مفصلة', qty: 1, price: 10 }] },
        { person: 'محمد', paid: 999, items: [{ productId: a.id, name: 'مفصلة', qty: 1, price: 10 }] },
      ],
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.message).toContain('فاتورة 2');
    expect(await prisma.invoice.count()).toBe(0);
    expect((await call(admin, 'GET', `/products/${a.id}`)).json().product.qty).toBe(5);
  });

  it('refuses the same file twice unless forced', async () => {
    const a = await product('فلتر', 100, 10);
    const body = { date: '2026-10-20', sig: 'same', invoices: [{ person: 'سمير', paid: 100, items: [{ productId: a.id, name: 'فلتر', qty: 1, price: 100 }] }] };
    expect((await call(admin, 'POST', '/daybook-import', body)).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/daybook-import/seen?sig=same')).json().seen).toMatchObject({ n: 1 });
    const again = await call(admin, 'POST', '/daybook-import', body);
    expect(again.statusCode).toBe(400);
    expect(again.json().error.message).toContain('اتستورد قبل كده');
    expect((await call(admin, 'POST', '/daybook-import', { ...body, force: true })).statusCode).toBe(200);
  });
});
