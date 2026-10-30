import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';
import { autoTick } from '../src/modules/alerts/auto.js';

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

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const msgs = () => prisma.outboundMessage.findMany({ orderBy: { createdAt: 'asc' } });
const cfg = (o: object) =>
  call(admin, 'PUT', '/autosend', { staffMonthly: { on: true }, debtsWeekly: { on: false, day: 6, time: '11:00', minDays: 14, minAmount: 0 }, onlineStatus: { on: false }, ...o });

describe('automatic messages', () => {
  it('only the owner sees and changes them; customer messages are off by default', async () => {
    expect((await call(staff, 'GET', '/autosend')).statusCode).toBe(403);
    const c = (await call(admin, 'GET', '/autosend')).json().config;
    expect(c.staffMonthly.on).toBe(true);
    expect(c.debtsWeekly.on).toBe(false);
    expect(c.onlineStatus.on).toBe(false);
  });

  it('the monthly worker summary goes to the owner once', async () => {
    await call(admin, 'POST', '/staff', { name: 'محمود', job: 'بياع', payType: 'month', salary: 3000, startDate: '2026-01-01' });
    const day = new Date('2026-11-02T09:30:00+02:00');
    await autoTick(prisma, day);
    await autoTick(prisma, day);
    const m = (await msgs()).filter((x) => x.body.includes('ملخص العمال'));
    expect(m).toHaveLength(1);
    expect(m[0]!.body).toContain('محمود');
    expect(m[0]!.body).toContain('أكتوبر 2026');
  });

  it('weekly debt reminders go only to customers owing long enough, and only when switched on', async () => {
    const old = (await call(admin, 'POST', '/contacts', { type: 'CUSTOMER', name: 'عم سيد', phone: '01001112223', openingBalance: 500 })).json().contact;
    expect(old.name).toBe('عم سيد');
    const sat = new Date('2026-11-07T11:30:00+02:00'); // a Saturday
    await autoTick(prisma, sat);
    expect((await msgs()).filter((x) => x.toPhone.includes('1001112223'))).toHaveLength(0);
    await cfg({ debtsWeekly: { on: true, day: 6, time: '11:00', minDays: 14, minAmount: 0 } });
    await autoTick(prisma, sat);
    const sent = (await msgs()).filter((x) => x.toPhone === '201001112223');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain('عم سيد');
    await autoTick(prisma, sat);
    expect((await msgs()).filter((x) => x.toPhone === '201001112223')).toHaveLength(1);
  });

  it('an online customer gets the shipment steps, a shop customer does not', async () => {
    const p = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 10, cost: 5, qty: 50, minQty: 1, unit: 'قطعة' })).json().product;
    const mk = async (online: boolean, phone: string) => {
      const inv = (await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'عميل', phone, online, items: [{ productId: p.id, name: 'مفصلة', qty: 1, price: 10 }] })).json().invoice;
      const sh = (await call(admin, 'POST', '/shipments', { kind: 'SHIP', name: 'عميل', phone, gov: 'القاهرة', address: 'مدينة نصر', invoiceNo: inv.no, carrier: 'بوسطة' })).json().shipment;
      return sh.id as string;
    };
    const a = await mk(true, '01234567890');
    const b = await mk(false, '01555555555');
    await cfg({ onlineStatus: { on: true } });
    await call(admin, 'PATCH', `/shipments/${a}`, { status: 'handed' });
    await call(admin, 'PATCH', `/shipments/${b}`, { status: 'handed' });
    await new Promise((r) => setTimeout(r, 600));
    const m = await msgs();
    expect(m.filter((x) => x.toPhone === '201234567890' && x.body.includes('اتجهّز'))).toHaveLength(1);
    expect(m.filter((x) => x.toPhone === '201555555555')).toHaveLength(0);
  });
});
