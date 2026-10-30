import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let staffUserId: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  staffUserId = (await createUser(prisma, '01100000001', 'STAFF', 'كريم')).id;
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

async function product(name: string, price: number, cost: number, qty: number) {
  return (await call(admin, 'POST', '/products', { name, price, cost, qty })).json().product as { id: string; code: string };
}
const qtyOf = async (id: string) => Number((await prisma.product.findUniqueOrThrow({ where: { id } })).qty);

describe('quotes', () => {
  it('numbers QT-, never touches stock, and is marked converted after the sale', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const q = (await call(staff, 'POST', '/quotes', { person: 'سمير', shipping: 20, items: [{ productId: p.id, name: 'مفصلة', qty: 3, price: 50 }] })).json().quote;
    expect(q).toMatchObject({ no: 'QT-0001', total: 170, status: 'open' });
    expect(await qtyOf(p.id)).toBe(10);
    const inv = (await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', items: [{ productId: p.id, qty: 3, price: 50 }] })).json().invoice;
    const c = (await call(staff, 'POST', `/quotes/${q.id}/converted`, { invoiceId: inv.id })).json().quote;
    expect(c).toMatchObject({ status: 'converted', invoiceNo: inv.no });
    expect((await call(staff, 'GET', '/quotes?q=سمير')).json().total).toBe(1);
  });
});

describe('shipping', () => {
  it('follows a parcel to «اتحاسبنا» and records the payment and fee', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    const inv = (await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', phone: '01012345678', paid: 0, items: [{ productId: p.id, qty: 2, price: 50 }] })).json().invoice;
    const bad = await call(staff, 'POST', '/shipments', { kind: 'SHIP', name: 'سمير', phone: '01012345678' });
    expect(bad.statusCode).toBe(400);
    const s = (await call(staff, 'POST', '/shipments', { kind: 'SHIP', name: 'سمير', phone: '01012345678', gov: 'الجيزة', address: 'فيصل', invoiceNo: inv.no, cod: 100 })).json().shipment;
    expect(s).toMatchObject({ no: 'SP-0001', status: 'new', invoiceId: inv.id });
    await call(staff, 'PATCH', `/shipments/${s.id}`, { status: 'handed', carrier: 'بوسطة Bosta' });
    expect((await call(staff, 'GET', '/shipments?tab=open')).json().summary).toMatchObject({ open: 1, moving: 1, movingCod: 100 });
    await call(staff, 'PATCH', `/shipments/${s.id}`, { status: 'delivered' });
    const done = (await call(admin, 'POST', `/shipments/${s.id}/paid`, { amount: 100, fee: 30, recordPayment: true, recordExpense: true })).json().shipment;
    expect(done.status).toBe('paid');
    expect(done.log.map((l: { s: string }) => l.s)).toEqual(['new', 'handed', 'delivered', 'paid']);
    expect(Number((await prisma.contact.findFirstOrThrow({ where: { name: 'سمير' } })).balance)).toBe(0);
    expect(await prisma.expense.count({ where: { category: 'شحن' } })).toBe(1);
    expect((await call(staff, 'DELETE', `/shipments/${s.id}`)).statusCode).toBe(403);
  });
});

describe('gifts and second grade', () => {
  it('a gift leaves stock and the summary hides cost from staff', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    await call(staff, 'POST', '/stock-extras/gifts', { productId: p.id, qty: 2, toName: 'حسن', toKind: 'صنايعي' });
    expect(await qtyOf(p.id)).toBe(8);
    const s = (await call(staff, 'GET', '/stock-extras/gifts')).json();
    expect(s.total).toBe(100);
    expect(s.totalCost).toBeUndefined();
    expect((await call(admin, 'GET', '/stock-extras/gifts')).json().totalCost).toBe(60);
    expect((await call(staff, 'POST', '/stock-extras/gifts', { productId: p.id, qty: 99, toName: 'حسن' })).statusCode).toBe(400);
  });

  it('scratched pieces move to a «(درجة تانية)» product with the same cost', async () => {
    const p = await product('مفصلة', 100, 60, 10);
    const r = (await call(admin, 'POST', '/stock-extras/grade', { productId: p.id, qty: 3, price: 75 })).json().product;
    expect(r.name).toBe('مفصلة (درجة تانية)');
    expect(await qtyOf(p.id)).toBe(7);
    const t = await prisma.product.findUniqueOrThrow({ where: { id: r.productId } });
    expect([Number(t.qty), Number(t.cost), Number(t.price)]).toEqual([3, 60, 75]);
    await call(admin, 'POST', '/stock-extras/grade', { productId: p.id, qty: 1, price: 75 });
    expect(await qtyOf(r.productId)).toBe(4);
  });
});

describe('staff and attendance', () => {
  it('links an account, punches in and out with the QR code, and pays salary into expenses', async () => {
    const s = (await call(admin, 'POST', '/staff', { name: 'كريم', salary: 6000, userId: staffUserId, shiftStart: '00:00' })).json().staff;
    const { code } = (await call(admin, 'POST', '/staff/punch-code')).json();
    const a = (await call(staff, 'POST', '/staff/punch', { code })).json().result;
    expect(a).toMatchObject({ kind: 'in', name: 'كريم' });
    expect((await call(staff, 'POST', '/staff/punch', { code })).json().result.kind).toBe('out');
    expect((await call(staff, 'POST', '/staff/punch', { code })).statusCode).toBe(400);
    expect((await call(admin, 'POST', '/staff/punch', { code: 'abcdef123456' })).statusCode).toBe(400);
    // 🔔 the owner is told on WhatsApp when someone comes in and leaves
    const alerts = (await prisma.outboundMessage.findMany({ where: { byName: '🔔 تنبيه تلقائي' }, orderBy: { createdAt: 'asc' } })).map((m) => m.body);
    expect(alerts.some((b) => b.includes('كريم حضر الساعة'))).toBe(true);
    expect(alerts.some((b) => b.includes('كريم انصرف الساعة'))).toBe(true);

    const mine = (await call(staff, 'GET', '/staff')).json();
    expect(mine.staff).toHaveLength(1);
    expect(mine.config).toBeUndefined();
    expect(mine.attendance).toHaveLength(1);

    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date()).slice(0, 7);
    await call(admin, 'POST', `/staff/${s.id}/moves`, { kind: 'advance', amount: 500, month });
    await call(admin, 'POST', `/staff/${s.id}/moves`, { kind: 'pay', amount: 2000, month });
    expect(await prisma.expense.count({ where: { category: { in: ['سلف', 'مرتبات'] } } })).toBe(2);
    expect((await call(staff, 'POST', `/staff/${s.id}/moves`, { kind: 'bonus', amount: 1, month })).statusCode).toBe(403);
  });

  it('manual attendance computes lateness from the shift start', async () => {
    const s = (await call(admin, 'POST', '/staff', { name: 'سيد', shiftStart: '10:00' })).json().staff;
    const a = (await call(admin, 'POST', '/staff/attendance', { staffId: s.id, day: '2026-10-01', inTime: '10:25', outTime: '18:00' })).json().attendance;
    expect(a).toMatchObject({ lateMin: 25, method: 'manual' });
    expect(new Date(a.inAt).toISOString()).toBe('2026-10-01T07:25:00.000Z');
  });

  it('points: hand-given points and redemptions add up on the board', async () => {
    const s = (await call(admin, 'POST', '/staff', { name: 'سيد', startDate: '2099-01-01' })).json().staff;
    await call(admin, 'POST', `/staff/${s.id}/points`, { pts: 10, why: 'بيعة كبيرة' });
    await call(admin, 'POST', `/staff/${s.id}/points`, { pts: -3, why: 'غلطة' });
    const b = (await call(admin, 'GET', '/staff/points')).json();
    expect(b.rows[0]).toMatchObject({ man: 7, balance: 7 });
    expect(b.config.rewards.length).toBeGreaterThan(0);
  });
});

describe('kits, samples and wanted', () => {
  it('kits get K codes and a barcode', async () => {
    const p = await product('عود ألمنيوم', 100, 60, 10);
    const k = (await call(admin, 'POST', '/kits', { name: 'طقم جرار', param: 'دلفة', def: 2, slots: [{ label: 'عود', mode: 'param', qty: 1, per: 1, products: [p.id] }] })).json().kit;
    expect(k).toMatchObject({ code: 'K0001', barcode: '290000000001' });
    expect((await call(staff, 'GET', '/kits/lookup?code=290000000001')).json().kit.name).toBe('طقم جرار');
    expect((await call(staff, 'POST', '/kits', { name: 'x', slots: [{ label: 'a', qty: 1, products: [p.id] }] })).statusCode).toBe(403);
  });

  it('samples are off for staff until switched on; sold makes a zero invoice, lost lowers stock', async () => {
    const p = await product('مفصلة', 50, 30, 10);
    expect((await call(staff, 'POST', '/samples', { productName: 'مفصلة' })).statusCode).toBe(403);
    await call(admin, 'PUT', '/samples/flag', { on: true });
    const a = (await call(staff, 'POST', '/samples', { productName: 'مفصلة', qty: 2, customer: 'سمير' })).json().sample;
    const b = (await call(staff, 'POST', '/samples', { productName: 'مفصلة', qty: 1 })).json().sample;
    expect(await qtyOf(p.id)).toBe(10);
    expect((await call(staff, 'GET', '/samples/count?name=سمير')).json().count).toBe(1);
    const sold = (await call(staff, 'POST', `/samples/${a.id}/status`, { status: 'sold' })).json().sample;
    expect(sold.invoiceId).toBeTruthy();
    await call(staff, 'POST', `/samples/${b.id}/status`, { status: 'lost' });
    expect(await qtyOf(p.id)).toBe(7);
  });

  it('wanted list: anyone adds, the owner marks it available', async () => {
    const w = (await call(staff, 'POST', '/wanted', { descr: 'مفصلة ٣٥ سم' })).json().item;
    expect(w).toMatchObject({ source: 'المحل', byName: 'كريم' });
    expect((await call(staff, 'POST', `/wanted/${w.id}/done`)).statusCode).toBe(403);
    await call(admin, 'POST', `/wanted/${w.id}/done`);
    expect((await call(staff, 'GET', '/wanted')).json().items).toHaveLength(0);
  });
});
