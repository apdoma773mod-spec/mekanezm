import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { BRIDGE_SECRET, createTestApp, createUser, login, resetDb } from './helpers.js';

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
  await prisma.contact.createMany({
    data: [
      { type: 'CUSTOMER', name: 'محمد علي', phone: '01012345678' },
      { type: 'CUSTOMER', name: 'سعيد', phone: '٠١١٢٣٤٥٦٧٨٩' }, // Arabic digits
      { type: 'CUSTOMER', name: 'مكرر', phone: '+20 101 234 5678' }, // same as the first
      { type: 'CUSTOMER', name: 'بلا رقم', phone: '' },
      { type: 'CUSTOMER', name: 'رقم غلط', phone: '12345' },
      { type: 'SUPPLIER', name: 'مورد', phone: '01234567890' },
    ],
  });
});
const call = (cookie: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const bridge = (url: string, payload: unknown = {}) =>
  app.inject({ method: 'POST', url: `/api/v1/bridge${url}`, headers: { 'x-bridge-secret': BRIDGE_SECRET }, payload: payload as object });

describe('broadcast to all customers', () => {
  it('admin only; counts valid, de-duplicated customers (suppliers and bad numbers left out)', async () => {
    expect((await call(staff, 'GET', '/broadcast/audience')).statusCode).toBe(403);
    expect((await call(staff, 'POST', '/broadcast/send', { id: 'abcdefgh1', text: 'عرض جديد على المفصلات', audience: 'customers' })).statusCode).toBe(403);
    const a = (await call(admin, 'GET', '/broadcast/audience')).json();
    expect(a).toMatchObject({ customers: 2, noPhone: 2, subscribers: 0 });
  });

  it('one press queues one personalised message per customer, with the opt-out line; pressing twice does not double-send', async () => {
    const body = { id: 'batch-0001', text: 'أهلاً {الاسم}، وصلنا مجرى بلي جديد', audience: 'customers' };
    const r = (await call(admin, 'POST', '/broadcast/send', body)).json();
    expect(r).toMatchObject({ total: 2, queued: 2, sent: 0 });
    const rows = await prisma.outboundMessage.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((x) => x.toPhone).sort()).toEqual(['01012345678', '01123456789']);
    expect(rows.find((x) => x.toPhone === '01012345678')!.body).toMatch(/^أهلاً محمد، وصلنا مجرى بلي جديد\n\n.*إلغاء/);
    const again = (await call(admin, 'POST', '/broadcast/send', body)).json();
    expect(again.duplicate).toBe(true);
    expect(await prisma.outboundMessage.count()).toBe(2);
  });

  it('the bridge gets ads one at a time with a gap, while alerts are not delayed', async () => {
    await call(admin, 'POST', '/broadcast/send', { id: 'batch-0002', text: 'إعلان تجربة للعملاء', audience: 'customers' });
    await prisma.outboundMessage.create({ data: { toPhone: '01099999999', body: '🔔 تنبيه', byName: '🔔 تنبيه السيستم' } });
    const first = (await bridge('/out/claim')).json() as { to_phone: string }[];
    expect(first).toHaveLength(2); // the alert + exactly one ad
    expect(first.some((m) => m.to_phone === '01099999999')).toBe(true);
    const second = (await bridge('/out/claim')).json() as unknown[];
    expect(second).toHaveLength(0); // gap not over yet, nothing new for the alert either
    // gap passes → next ad comes out
    await prisma.outboundMessage.updateMany({ where: { byName: { startsWith: '📣 إعلان:' }, claimedAt: { not: null } }, data: { claimedAt: new Date(Date.now() - 60_000) } });
    expect(((await bridge('/out/claim')).json() as unknown[]).length).toBe(1);
  });

  it('the daily cap holds the rest for tomorrow', async () => {
    await prisma.setting.create({ data: { key: 'wa_broadcast_limits', value: { gapSec: 5, daily: 1 } } });
    await call(admin, 'POST', '/broadcast/send', { id: 'batch-0003', text: 'إعلان تجربة للعملاء', audience: 'customers' });
    expect(((await bridge('/out/claim')).json() as unknown[]).length).toBe(1);
    await prisma.outboundMessage.updateMany({ where: { claimedAt: { not: null } }, data: { claimedAt: new Date(Date.now() - 3 * 3600e3) } });
    expect(((await bridge('/out/claim')).json() as unknown[]).length).toBe(0);
  });

  it('cancel stops what has not gone out; the progress counts follow what the bridge reports', async () => {
    await call(admin, 'POST', '/broadcast/send', { id: 'batch-0004', text: 'إعلان تجربة للعملاء', audience: 'customers' });
    const [m] = (await bridge('/out/claim')).json() as { id: string }[];
    await bridge('/out/done', { id: m!.id, ok: true });
    const c = (await call(admin, 'POST', '/broadcast/item/batch-0004/cancel')).json();
    expect(c.cancelled).toBe(1);
    const d = (await call(admin, 'GET', '/broadcast/item/batch-0004')).json();
    expect(d).toMatchObject({ total: 2, sent: 1, queued: 0, failed: 1 });
    expect(d.failures[0].err).toMatch(/اتلغى/);
  });

  it('«إلغاء» from someone who got an ad removes them for good (also from the queue) and they get a confirmation; a bare «إلغاء» from a stranger is a normal message', async () => {
    await call(admin, 'POST', '/broadcast/send', { id: 'batch-0005', text: 'إعلان تجربة للعملاء', audience: 'customers' });
    const r = (await bridge('/wa/submit', { phone: '201012345678', name: 'محمد', body: 'إلغاء' })).json();
    expect(r.id).toBe('optout');
    expect(await prisma.waOrder.count()).toBe(0);
    const left = await prisma.outboundMessage.findMany({ where: { byName: { startsWith: '📣 إعلان:' }, status: 'queued' } });
    expect(left.map((x) => x.toPhone)).toEqual(['01123456789']);
    expect(await prisma.outboundMessage.count({ where: { byName: '📣 إلغاء إعلانات' } })).toBe(1);
    expect((await call(admin, 'GET', '/broadcast/audience')).json()).toMatchObject({ customers: 1, optedOut: 1 });
    expect((await call(admin, 'GET', '/broadcast/optout')).json().items).toEqual([{ phone: '01012345678', name: 'محمد علي' }]);
    // someone never messaged by us: it is just a message, not an opt-out
    const s = (await bridge('/wa/submit', { phone: '01555555555', name: 'غريب', body: 'إلغاء' })).json();
    expect(s.id).not.toBe('optout');
    // bring them back
    await call(admin, 'DELETE', '/broadcast/optout/01012345678');
    expect((await call(admin, 'GET', '/broadcast/audience')).json()).toMatchObject({ customers: 2, optedOut: 0 });
  });

  it('subscribers: one per number, the cancelled ones are left out; the filter rules the bridge reads include the opt-out word without touching the saved rules', async () => {
    await prisma.webRequest.createMany({
      data: [
        { name: 'منى', phone: '01212345678', note: '📣 اشتراك في جديد الواتساب\nمهتم بـ: مفصلات' },
        { name: 'منى', phone: '01212345678', note: '📣 اشتراك في جديد الواتساب\nمهتم بـ: مفصلات' },
        { name: 'سامي', phone: '01512345678', note: '📣 اشتراك في جديد الواتساب', status: 'closed' },
      ],
    });
    expect((await call(admin, 'GET', '/broadcast/audience')).json()).toMatchObject({ subscribers: 1, both: 3 });
    await prisma.setting.create({ data: { key: 'wa_rules', value: { rules: [{ phrases: ['طلب'], type: 'طلب', mode: 'contains', on: true }] } } });
    const rules = (await app.inject({ method: 'GET', url: '/api/v1/bridge/rules', headers: { 'x-bridge-secret': BRIDGE_SECRET } })).json() as { rules: { type: string }[] };
    expect(rules.rules.map((x) => x.type)).toEqual(['طلب', 'إلغاء إعلانات']);
    expect(((await prisma.setting.findUnique({ where: { key: 'wa_rules' } }))!.value as { rules: unknown[] }).rules).toHaveLength(1);
  });
});
