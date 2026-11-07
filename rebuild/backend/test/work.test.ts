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

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('work systems storage', () => {
  it('keeps the wk_* documents for the owner only', async () => {
    expect((await call(admin, 'GET', '/work/kv/wk_orders')).json()).toEqual({ value: null });
    const orders = [{ id: 'a', code: 'DL-0001', type: 'دلفة', stage: 0 }];
    expect((await call(admin, 'PUT', '/work/kv/wk_orders', { value: orders })).statusCode).toBe(200);
    expect((await call(admin, 'GET', '/work/kv/wk_orders')).json().value).toEqual(orders);
    expect((await call(staff, 'GET', '/work/kv/wk_orders')).statusCode).toBe(403);
    expect((await call(admin, 'GET', '/work/kv/other')).statusCode).toBe(400);
  });

  it('lets everyone read the voice command words but only the owner save them', async () => {
    const v = { sale: ['بيع'], purchase: ['شراء'], stmt: ['كشف'], payin: ['تحصيل'], payout: ['سداد'] };
    expect((await call(staff, 'PUT', '/work/kv/voice_cmds', { value: v })).statusCode).toBe(403);
    expect((await call(admin, 'PUT', '/work/kv/voice_cmds', { value: v })).statusCode).toBe(200);
    expect((await call(staff, 'GET', '/work/kv/voice_cmds')).json().value).toEqual(v);
  });

  it('stores a drawing and serves it by its link without login', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
    const r = (await call(staff, 'POST', '/work/files', { data: `data:image/png;base64,${png}`, ext: 'png' })).json();
    expect(r.url).toMatch(/^\/api\/v1\/work\/files\/[a-f0-9]{24}\.png$/);
    const f = await app.inject({ method: 'GET', url: r.url });
    expect(f.statusCode).toBe(200);
    expect(f.headers['content-type']).toBe('image/png');
    expect((await app.inject({ method: 'GET', url: '/api/v1/work/files/../../x.png' })).statusCode).not.toBe(200);
  });
});
