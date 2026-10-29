import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { describeBackup, dayOf, takeSnapshot } from '../src/modules/backup/service.js';
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

describe('backups', () => {
  it('is for the owner only', async () => {
    expect((await call(staff, 'GET', '/backup')).statusCode).toBe(403);
    expect((await call(staff, 'POST', '/backup/now')).statusCode).toBe(403);
  });

  it('takes today\'s copy, lists it and downloads it without passwords or sessions', async () => {
    await call(admin, 'POST', '/products', { name: 'فلتر', price: 10, cost: 5, qty: 2 });
    const made = (await call(admin, 'POST', '/backup/now')).json();
    expect(made.day).toBe(dayOf(new Date()));
    const list = (await call(admin, 'GET', '/backup')).json();
    expect(list.items[0].day).toBe(made.day);
    const file = await call(admin, 'GET', `/backup/${made.day}`);
    expect(file.headers['content-disposition']).toContain('mekanizm-backup-');
    const body = file.json();
    expect(body.tables.Product).toHaveLength(1);
    expect(body.tables).not.toHaveProperty('User');
    expect(body.tables).not.toHaveProperty('RefreshToken');
  });

  it('keeps one copy per day (the same day is replaced, not duplicated)', async () => {
    await call(admin, 'POST', '/backup/now');
    await call(admin, 'POST', '/backup/now');
    expect(await prisma.backup.count()).toBe(1);
  });

  it('checks an uploaded file and refuses anything that is not a backup', async () => {
    const snap = await takeSnapshot(prisma);
    const ok = (await call(admin, 'POST', '/backup/check', snap)).json();
    expect(ok.ok).toBe(true);
    expect(ok.tables.Product).toBe(0);
    expect((await call(admin, 'POST', '/backup/check', { hello: 1 })).statusCode).toBe(400);
    expect(describeBackup(null).ok).toBe(false);
  });

  it('answers 404 for a day with no copy', async () => {
    expect((await call(admin, 'GET', '/backup/2020-01-01')).statusCode).toBe(404);
  });
});
