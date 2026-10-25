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
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  await createUser(prisma, '01100000001', 'STAFF', 'مندوب');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function product(name: string, price: number, cost: number, qty: number, company: 'MK' | 'HY' = 'MK') {
  return (await call(admin, 'POST', '/products', { name, price, cost, qty, company })).json().product as { id: string };
}
const qtyOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).qty);

describe('between the two companies', () => {
  it('a transfer is a sale at the seller and a purchase at the buyer; cancelling voids both', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    expect((await call(staff, 'POST', '/hy/ic', { seller: 'MK', lines: [{ productId: p.id, qty: 4, price: 30 }] })).statusCode).toBe(403);
    const r = (await call(admin, 'POST', '/hy/ic', { seller: 'MK', lines: [{ productId: p.id, qty: 4, price: 30 }] })).json().result;
    expect(r.sale.no).toMatch(/^MK-/);
    expect(await qtyOf(p.id)).toBe(6);
    const twin = await prisma.product.findUniqueOrThrow({ where: { id: r.buyerProducts[0] } });
    expect([twin.company, Number(twin.qty), twin.name]).toEqual(['HY', 4, 'مفصلة']);
    const acc = (await call(admin, 'GET', '/hy/account')).json().account;
    expect(acc).toMatchObject({ hyTook: 120, hyOwes: 120, net: 120 });
    expect(acc.rows.at(-1).b).toBe(120);
    expect((await call(admin, 'POST', '/hy/ic', { seller: 'MK', lines: [{ productId: p.id, qty: 99, price: 30 }] })).statusCode).toBe(400);

    await call(admin, 'POST', '/hy/account/settle', { dir: 'h2m', amount: 50 });
    expect((await call(admin, 'GET', '/hy/account')).json().account.net).toBe(70);

    const deals = (await call(admin, 'GET', '/hy/ic')).json().deals;
    expect(deals).toHaveLength(1);
    await call(admin, 'DELETE', `/hy/ic/${deals[0].ref}`);
    expect(await qtyOf(p.id)).toBe(10);
    expect(await qtyOf(twin.id)).toBe(0);
  });
});

describe('field orders and the van', () => {
  it('sells what is on the van now and requests the rest from Mekanizm', async () => {
    const mk = await product('خرطوم', 100, 60, 20);
    const hy = await product('خرطوم', 100, 60, 0, 'HY');
    // Load 3 from Mekanizm onto the van (transfer at cost, then van load).
    await call(staff, 'POST', '/hy/van/load', { lines: [{ productId: mk.id, qty: 3, src: 'mk', price: 60 }] });
    const v = (await call(staff, 'GET', '/hy/van')).json().van;
    expect(v.stock).toHaveLength(1);
    expect(v.stock[0]).toMatchObject({ productId: hy.id, qty: 3 });
    expect(await qtyOf(hy.id)).toBe(3);

    const o = (await call(staff, 'POST', '/hy/orders', { customer: 'ورشة النور', pay: 'cash', lines: [{ productId: hy.id, name: 'خرطوم', qty: 5, price: 100 }, { name: 'وصلة ٣ بوصة', qty: 1, nw: true }] })).json().order;
    expect(o.lines[0]).toMatchObject({ s: 3, r: 2, st: 'new' });
    expect(o.lines[1]).toMatchObject({ nw: true, st: 'short', r: 1 });
    expect(o.invoiceNo).toMatch(/^MK-/);
    expect(await qtyOf(hy.id)).toBe(0);
    expect((await call(staff, 'GET', '/hy/van')).json().van.stock).toHaveLength(0);
    expect(await prisma.wantedItem.count({ where: { source: 'الميدان' } })).toBe(1);

    await call(staff, 'POST', `/hy/orders/${o.id}/lines/1`, { st: 'cancel' });
    const done = (await call(staff, 'POST', `/hy/orders/${o.id}/lines/0`, { st: 'done' })).json().order;
    expect(done.status).toBe('done');
    const inv = (await call(staff, 'POST', `/hy/orders/${o.id}/invoice`, { paid: 0 })).json().order;
    expect(inv.lines[0].inv).toBeTruthy();
    // The 2 pieces came from Mekanizm's store through a transfer.
    expect(await qtyOf(mk.id)).toBe(15);
    expect(Number((await prisma.contact.findFirstOrThrow({ where: { name: 'ورشة النور' } })).balance)).toBe(200);
  });

  it('the end-of-day close records shortages with a reason and adjusts stock', async () => {
    const hy = await product('جلبة', 20, 10, 10, 'HY');
    await call(staff, 'POST', '/hy/van/load', { lines: [{ productId: hy.id, qty: 4, src: 'hy' }] });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
    const view = (await call(staff, 'GET', `/hy/van/close?date=${today}`)).json().close;
    expect(view.rows[0]).toMatchObject({ ld: 4, ex: 4 });
    expect((await call(staff, 'POST', '/hy/van/close', { date: today, items: [{ pid: hy.id, cnt: 3 }] })).statusCode).toBe(400);
    await call(staff, 'POST', '/hy/van/close', { date: today, items: [{ pid: hy.id, cnt: 3, why: 'وقعت', back: true }] });
    expect(await qtyOf(hy.id)).toBe(9);
    expect((await call(staff, 'GET', '/hy/van')).json().van.stock).toHaveLength(0);
    const again = (await call(staff, 'GET', `/hy/van/close?date=${today}`)).json().close;
    expect(again.record.closed).toBe(true);
    expect(again.record.diffValue).toBe(-10);
  });
});

describe('partners, car and contracts', () => {
  it('partners get their share of Hydrolek profit', async () => {
    const hy = await product('جلبة', 100, 60, 10, 'HY');
    await call(admin, 'POST', '/invoices', { kind: 'SALE', company: 'HY', items: [{ productId: hy.id, qty: 5, price: 100 }] });
    const id = (await call(admin, 'POST', '/hy/partners', { name: 'حسام', share: 40 })).json().id;
    await call(admin, 'POST', `/hy/partners/${id}/moves`, { kind: 'capital', amount: 1000 });
    const b = (await call(admin, 'GET', '/hy/partners')).json().board;
    expect(b.profit).toBe(200);
    expect(b.partners[0]).toMatchObject({ capital: 1000, shareValue: 80, balance: 1080 });
    expect((await call(staff, 'GET', '/hy/partners')).statusCode).toBe(403);
  });

  it('a car cost is a Hydrolek expense, and a contract deposit is a payment on the customer', async () => {
    const vid = (await call(admin, 'POST', '/hy/vehicles', { name: 'سوزوكي', plate: 'س ع ١٢٣' })).json().id;
    await call(staff, 'POST', `/hy/vehicles/${vid}/log`, { kind: 'بنزين', amount: 300, km: 1200, liters: 20 });
    const e = await prisma.expense.findFirstOrThrow({ where: { category: 'سيارة: بنزين' } });
    expect(e.company).toBe('HY');
    const c = (await call(staff, 'POST', '/hy/contracts', { client: 'المهندس سامي', title: 'مطبخ كامل', total: 20000, deposit: 5000 })).json().contract;
    expect(c).toMatchObject({ no: 'CT-001', total: 20000 });
    expect(Number((await prisma.contact.findFirstOrThrow({ where: { name: 'المهندس سامي' } })).balance)).toBe(-5000);
    const c2 = (await call(staff, 'POST', `/hy/contracts/${c.id}`, { do: 'cost', amount: 3000, desc: 'خامات' })).json().contract;
    expect(c2.costs).toHaveLength(1);
    const today = (await call(staff, 'GET', '/hy/today')).json().today;
    expect(today).toMatchObject({ openRequests: 0, lateContracts: 0 });
  });

  it('WhatsApp messages queue for the bridge', async () => {
    await call(staff, 'POST', '/hy/wa', { to: '01012345678', body: 'تجربة' });
    const r = (await call(staff, 'GET', '/hy/alerts')).json();
    expect(r.outbox[0]).toMatchObject({ toPhone: '201012345678', status: 'queued' });
  });
});
