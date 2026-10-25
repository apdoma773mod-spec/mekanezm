import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
let adminId: string;

beforeEach(async () => {
  await resetDb(prisma);
  adminId = (await createUser(prisma, '01000000001', 'ADMIN', 'المدير')).id;
  await createUser(prisma, '01100000001', 'STAFF', 'موظف');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

describe('users', () => {
  it('is admin only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie: staff } });
    expect(res.statusCode).toBe(403);
  });

  it('creates, lists, searches and audits users', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { cookie: admin },
      payload: { name: 'أحمد', phone: '+20 122 000 0001', email: '', role: 'STAFF', password: 'pass-word-1' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().user).toMatchObject({ phone: '01220000001', email: null, role: 'STAFF' });

    const list = await app.inject({ method: 'GET', url: '/api/v1/users?q=أحمد', headers: { cookie: admin } });
    expect(list.json()).toMatchObject({ total: 1, page: 1 });

    const audit = await prisma.auditLog.findFirst({ where: { action: 'USER_CREATE' } });
    expect(audit?.userId).toBe(adminId);
    expect(JSON.stringify(audit?.after)).not.toContain('passwordHash');
  });

  it('rejects a duplicate phone with a conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { cookie: admin },
      payload: { name: 'تكرار', phone: '01100000001', role: 'STAFF', password: 'pass-word-1' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('keeps at least one active admin and blocks self-demotion', async () => {
    const self = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${adminId}`,
      headers: { cookie: admin },
      payload: { role: 'STAFF' },
    });
    expect(self.statusCode).toBe(400);

    const second = await createUser(prisma, '01000000002', 'ADMIN', 'مدير تاني');
    const secondCookie = await login(app, '01000000002');
    const demote = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${adminId}`,
      headers: { cookie: secondCookie },
      payload: { role: 'STAFF' },
    });
    expect(demote.statusCode).toBe(200);
    const last = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/${second.id}`,
      headers: { cookie: secondCookie },
    });
    expect(last.statusCode).toBe(400);
  });

  it('deactivation takes effect on the next request', async () => {
    const staffUser = await prisma.user.findUniqueOrThrow({ where: { phone: '01100000001' } });
    const off = await app.inject({ method: 'DELETE', url: `/api/v1/users/${staffUser.id}`, headers: { cookie: admin } });
    expect(off.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: staff } });
    expect(me.statusCode).toBe(401);
    const refresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: staff } });
    expect(refresh.statusCode).toBe(401);
  });

  it('resets a password', async () => {
    const staffUser = await prisma.user.findUniqueOrThrow({ where: { phone: '01100000001' } });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${staffUser.id}/reset-password`,
      headers: { cookie: admin },
      payload: { newPassword: 'reset-pass-99' },
    });
    expect(res.statusCode).toBe(200);
    await expect(login(app, '01100000001', 'reset-pass-99')).resolves.toContain('mk_at=');
  });
});

describe('settings', () => {
  it('returns defaults to any signed-in user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/settings', headers: { cookie: staff } });
    expect(res.statusCode).toBe(200);
    expect(res.json().settings.store.name).toContain('ميكانيزم');
    expect(res.json().settings.theme.primary).toBe('#087f8c');
  });

  it('only admins can change settings, values are validated and audited', async () => {
    const payload = { name: 'ميكانيزم أرض اللواء', phones: ['٠١٠١٢٣٤٥٦٧٨'], address: 'الجيزة', invoiceFooter: '' };
    const denied = await app.inject({ method: 'PUT', url: '/api/v1/settings/store', headers: { cookie: staff }, payload });
    expect(denied.statusCode).toBe(403);

    const bad = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/theme',
      headers: { cookie: admin },
      payload: { primary: 'red', mode: 'dark' },
    });
    expect(bad.statusCode).toBe(400);

    const unknown = await app.inject({ method: 'PUT', url: '/api/v1/settings/nope', headers: { cookie: admin }, payload });
    expect(unknown.statusCode).toBe(400);

    const ok = await app.inject({ method: 'PUT', url: '/api/v1/settings/store', headers: { cookie: admin }, payload });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().value.phones).toEqual(['01012345678']);
    expect(await prisma.auditLog.count({ where: { action: 'SETTING_UPDATE' } })).toBe(1);
  });
});

describe('audit', () => {
  it('lists entries newest first for admins only', async () => {
    const denied = await app.inject({ method: 'GET', url: '/api/v1/audit', headers: { cookie: staff } });
    expect(denied.statusCode).toBe(403);
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit?action=LOGIN', headers: { cookie: admin } });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(2);
    expect(res.json().items[0].user.name).toBeDefined();
  });
});
