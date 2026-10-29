import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';
import { reportTick } from '../src/modules/alerts/report.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let pid: string;
beforeEach(async () => {
  await resetDb(prisma);
  await prisma.setting.deleteMany({ where: { key: { in: ['alerts', 'report'] } } });
  await prisma.outboundMessage.deleteMany({});
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  await createUser(prisma, '01100000001', 'STAFF', 'موظف');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  pid = (await call(admin, 'POST', '/products', { name: 'مفصلة', price: 100, cost: 60, qty: 50 })).json().product.id;
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const sent = async () => (await prisma.outboundMessage.findMany({ where: { byName: '🔔 تنبيه تلقائي' }, orderBy: { createdAt: 'asc' } })).map((m) => m.body);
const cfg = (over: object) => call(admin, 'PUT', '/alerts/config', { on: true, to: ['01119199659'], disc: 15, short: 50, skip_admin: true, types: {}, ...over });

describe('instant alerts', () => {
  it('only the owner can read or change them', async () => {
    expect((await call(staff, 'GET', '/alerts/config')).statusCode).toBe(403);
    expect((await cfg({})).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/alerts/config')).json().config.to).toEqual(['201119199659']);
  });

  it('a sale under cost and a big discount from staff reach the owner', async () => {
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 50, items: [{ productId: pid, qty: 1, price: 50 }] });
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'علي', paid: 70, items: [{ productId: pid, qty: 1, price: 70 }] });
    const m = await sent();
    expect(m).toHaveLength(2);
    expect(m[0]).toContain('باع بأقل من سعر الشراء');
    expect(m[0]).toContain('مفصلة × 1 بـ 50 (الشراء 60)');
    expect(m[1]).toContain('عمل خصم كبير');
    expect(m[1]).toContain('بـ 70 بدل 100 (خصم 30%)');
  });

  it('the owner\'s own actions are skipped unless the switch is off', async () => {
    const sale = (await call(admin, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 50, items: [{ productId: pid, qty: 1, price: 50 }] })).json().invoice;
    expect(await sent()).toHaveLength(0);
    await cfg({ skip_admin: false });
    await call(admin, 'POST', `/invoices/${sale.id}/void`, { reason: 'غلط' });
    await call(admin, 'POST', `/products/${pid}/adjust`, { newQty: 40, note: 'جرد' });
    const m = await sent();
    expect(m[0]).toContain('لغى فاتورة بيع');
    expect(m[0]).toContain('بقيمة 50 ج');
    expect(m[1]).toContain('عدّل رصيد «مفصلة» يدوي');
    expect(m[1]).toContain('(-10)');
  });

  it('a type can be switched off, and the whole thing too', async () => {
    await cfg({ types: { below: false } });
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 50, items: [{ productId: pid, qty: 1, price: 50 }] });
    expect(await sent()).toHaveLength(0);
    await cfg({ on: false });
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'علي', paid: 40, items: [{ productId: pid, qty: 1, price: 40 }] });
    expect(await sent()).toHaveLength(0);
  });

  it('drawer shortage at closing and test message', async () => {
    await cfg({ skip_admin: false });
    await call(admin, 'POST', '/closing', { day: new Date().toISOString().slice(0, 10), cashActual: 0, note: '' });
    expect((await sent()).some((x) => x.includes('💵'))).toBe(false); // nothing expected, no gap
    expect((await call(admin, 'POST', '/alerts/test', {})).json().sent).toBe(1);
    expect((await sent())[0]).toContain('تنبيه تجربة');
  });
});

describe('daily report', () => {
  it('previews today and sends once when its time comes', async () => {
    await call(staff, 'POST', '/invoices', { kind: 'SALE', person: 'سمير', paid: 100, items: [{ productId: pid, qty: 1, price: 100 }] });
    await prisma.outboundMessage.deleteMany({});
    const text = (await call(admin, 'GET', '/alerts/report/preview')).json().text as string;
    expect(text).toContain('📊 تقرير يوم');
    expect(text).toContain('🛒 المبيعات: 100 ج (1 فاتورة)');
    expect(text).toContain('💰 المكسب التقريبي: 40 ج (40%)');
    await call(admin, 'PUT', '/alerts/report/config', { on: true, time: '00:00' });
    // 00:00 is "after midnight": the report is about the day that ended, and goes out between 00:00 and 12:00 Cairo
    const noon = new Date('2026-10-30T11:00:00Z'); // 13:00 Cairo: too late for a 00:00 report
    expect(await reportTick(prisma, noon)).toBeNull();
    const morning = new Date('2026-10-30T08:30:00Z'); // 10:30 Cairo
    expect(await reportTick(prisma, morning)).toBe('2026-10-29');
    expect(await reportTick(prisma, morning)).toBeNull(); // not twice
    expect(await sent()).toHaveLength(1);
  });
});
