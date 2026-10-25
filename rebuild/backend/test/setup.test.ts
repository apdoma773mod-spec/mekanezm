import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());
beforeEach(() => resetDb(prisma));

const owner = { name: 'عبده', phone: '٠١٠٢٣٤٥٦٧٨٩', email: '', password: 'owner-pass-123' };

describe('first-run setup', () => {
  it('reports that setup is needed on an empty system', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/setup' });
    expect(res.json()).toEqual({ needsSetup: true });
  });

  it('creates the owner as admin, signs them in, then closes for good', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/setup', payload: owner });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ phone: '01023456789', role: 'ADMIN' });
    expect(res.cookies.map((c) => c.name)).toEqual(expect.arrayContaining(['mk_at', 'mk_rt']));
    expect(await prisma.auditLog.count({ where: { action: 'USER_CREATE' } })).toBe(1);

    const status = await app.inject({ method: 'GET', url: '/api/v1/auth/setup' });
    expect(status.json()).toEqual({ needsSetup: false });

    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/setup',
      payload: { ...owner, phone: '01111111111' },
    });
    expect(again.statusCode).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });

  it('cannot be used to choose a role', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/setup', payload: { ...owner, role: 'STAFF' } });
    expect(res.json().user.role).toBe('ADMIN');
  });

  it('validates the owner details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/setup',
      payload: { name: 'ع', phone: '123', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
    const paths = res.json().error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'phone', 'password']));
  });
});
