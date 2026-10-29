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

const call = (cookie: string, method: 'GET' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('customer prices and limits', () => {
  it('everyone can read them (the invoice applies the discount) but only the owner edits', async () => {
    expect((await call(staff, 'PUT', '/terms', { terms: {} })).statusCode).toBe(403);
    expect((await call(admin, 'PUT', '/terms', { terms: { سمير: { tier: 'جملة', pct: 5, limit: 1000, note: 'دفعه كل شهر' } } })).statusCode).toBe(200);
    expect((await call(staff, 'GET', '/terms')).json().terms).toEqual({ سمير: { tier: 'جملة', pct: 5, limit: 1000, note: 'دفعه كل شهر' } });
  });

  it('drops a customer whose terms were all cleared, like the old screen', async () => {
    await call(admin, 'PUT', '/terms', { terms: { سمير: { pct: 5 }, علي: { pct: 0 } } });
    expect(Object.keys((await call(admin, 'GET', '/terms')).json().terms)).toEqual(['سمير']);
  });

  it('refuses a discount over 100%', async () => {
    expect((await call(admin, 'PUT', '/terms', { terms: { سمير: { pct: 150 } } })).statusCode).toBe(400);
  });
});
