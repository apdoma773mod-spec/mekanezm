import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { parseVodafoneSms } from '../src/modules/inbox/sms.js';
import { BRIDGE_SECRET, SMS_TOKEN, createTestApp, createUser, login, resetDb } from './helpers.js';

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

const sms = (text: string, from = 'VF Cash', token = SMS_TOKEN) =>
  app.inject({ method: 'POST', url: '/api/v1/sms/in', payload: { token, text, from } });

const bridge = (method: 'GET' | 'POST', url: string, payload?: unknown, secret = BRIDGE_SECRET) =>
  app.inject({
    method,
    url: `/api/v1/bridge${url}`,
    headers: { 'x-bridge-secret': secret },
    ...(payload !== undefined ? { payload: payload as object } : {}),
  });

describe('vodafone cash parser (same rules as the old sms-in function)', () => {
  it('reads money received', () => {
    expect(parseVodafoneSms('VF', 'استلمت 500.00 ج.م من رقم 01012345678 فودافون كاش')).toEqual({
      amount: 500,
      direction: 'in',
      phone: '01012345678',
      note: 'فودافون كاش (استلام)',
    });
  });

  it('reads money sent, with Arabic-Indic digits and thousands separators', () => {
    const r = parseVodafoneSms('VF', 'تم تحويل ١,٢٥٠ جنيه لرقم 01099999999 من فودافون كاش');
    expect(r).toMatchObject({ amount: 1250, direction: 'out', phone: '01099999999' });
  });

  it('ignores messages that are not cash moves', () => {
    expect(parseVodafoneSms('BANK', 'عرض خاص 50% على كل حاجة')).toBeNull();
    expect(parseVodafoneSms('VF', 'رصيدك 300 جنيه')).toBeNull();
  });
});

describe('vodafone cash inbox', () => {
  it('refuses a wrong token and records a valid cash message as pending', async () => {
    expect((await sms('استلمت 80 جنيه من رقم 01012345678 فودافون كاش', 'VF', 'nope')).statusCode).toBe(403);
    const ok = await sms('استلمت 80 جنيه من رقم 01012345678 فودافون كاش');
    expect(ok.json()).toMatchObject({ ok: true, amount: 80, direction: 'in' });
    const pending = (await call(admin, 'GET', '/sms/pending')).json();
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0]).toMatchObject({ amount: 80, phone: '01012345678' });
  });

  it('ignores non-cash messages without storing them', async () => {
    expect((await sms('عرض خاص', 'BANK')).json()).toEqual({ ok: true, ignored: true });
    expect((await call(admin, 'GET', '/sms/pending')).json().items).toHaveLength(0);
  });

  it('only the owner can see or decide what the money is for', async () => {
    await sms('استلمت 80 جنيه من رقم 01012345678 فودافون كاش');
    const id = (await call(admin, 'GET', '/sms/pending')).json().items[0].id;
    expect((await call(staff, 'GET', '/sms/pending')).statusCode).toBe(403);
    expect((await call(staff, 'POST', `/sms/${id}/status`, { status: 'used' })).statusCode).toBe(403);
    expect((await call(admin, 'POST', `/sms/${id}/status`, { status: 'ignored' })).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/sms/pending')).json().items).toHaveLength(0);
  });
});

describe('whatsapp bridge', () => {
  it('needs the bridge secret', async () => {
    expect((await bridge('POST', '/out/claim', {}, 'wrong')).statusCode).toBe(403);
  });

  it('hands out queued messages once, then accepts the result', async () => {
    const m = await prisma.outboundMessage.create({ data: { toPhone: '201012345678', body: 'أهلًا', byName: 'عبده' } });
    const claimed = (await bridge('POST', '/out/claim')).json();
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id: m.id, to_phone: '201012345678', body: 'أهلًا' });
    expect((await bridge('POST', '/out/claim')).json()).toHaveLength(0);
    expect((await bridge('POST', '/out/done', { id: m.id, ok: true })).statusCode).toBe(200);
    expect((await prisma.outboundMessage.findUnique({ where: { id: m.id } }))?.status).toBe('sent');
  });

  it('keeps print jobs in the same queue (PRINT:receipt style)', async () => {
    await prisma.outboundMessage.create({ data: { toPhone: 'PRINT:label', body: '<html></html>', byName: 'طباعة' } });
    const [job] = (await bridge('POST', '/out/claim')).json();
    expect(job.to_phone).toBe('PRINT:label');
  });

  it('stores orders once per message id', async () => {
    const payload = { msgId: 'm1', phone: '01012345678', name: 'أحمد', body: 'طلب 2 فلتر زيت' };
    expect((await bridge('POST', '/wa/submit', payload)).json().id).toBeTruthy();
    expect((await bridge('POST', '/wa/submit', payload)).json().id).toBe('duplicate');
    expect(await prisma.waOrder.count()).toBe(1);
  });

  it('accepts only real images and matches known phones by their last 10 digits', async () => {
    const bad = await bridge('POST', '/photo/submit', { phone: '1', img: 'data:text/plain;base64,aGk=' });
    expect(bad.statusCode).toBe(403);
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect((await bridge('POST', '/photo/submit', { msgId: 'p1', phone: '01012345678', img: png })).json().id).toBeTruthy();
    await call(admin, 'POST', '/contacts', { type: 'CUSTOMER', name: 'سمير', phone: '+20 101 234 5678' });
    expect((await bridge('GET', '/known-phones')).json()).toEqual(['1012345678']);
  });
});
