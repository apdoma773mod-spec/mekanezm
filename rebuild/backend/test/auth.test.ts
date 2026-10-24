import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { PASSWORD, cookiesOf, createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN', 'المدير');
});

describe('auth', () => {
  it('logs in with Arabic-Indic digits and never returns the password hash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: '٠١٠٠٠٠٠٠٠٠١', password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.phone).toBe('01000000001');
    expect(res.body).not.toContain('passwordHash');
    const names = res.cookies.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['mk_at', 'mk_rt']));
    expect(res.cookies.every((c) => c.httpOnly)).toBe(true);
  });

  it('rejects a wrong password with the shared error shape', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: '01000000001', password: 'nope-nope' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
  });

  it('returns a validation error with details for an empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details.length).toBeGreaterThan(0);
  });

  it('blocks deactivated users', async () => {
    await prisma.user.update({ where: { phone: '01000000001' }, data: { active: false } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { login: '01000000001', password: PASSWORD },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires a session for /me', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const first = await login(app, '01000000001');
    const r1 = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: first } });
    expect(r1.statusCode).toBe(200);
    const second = cookiesOf(r1);

    // Reusing the old token right after rotation is treated as a race, not theft.
    const race = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: first } });
    expect(race.statusCode).toBe(401);
    expect(race.cookies).toHaveLength(0);
    const stillOk = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: second } });
    expect(stillOk.statusCode).toBe(200);
    const third = cookiesOf(stillOk);

    // Reuse long after rotation revokes every token in the family.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const theft = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: second } });
    expect(theft.statusCode).toBe(401);
    const afterTheft = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: third } });
    expect(afterTheft.statusCode).toBe(401);
  });

  it('logs out and invalidates the refresh token', async () => {
    const cookie = await login(app, '01000000001');
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie } });
    expect(r.statusCode).toBe(401);
    const actions = (await prisma.auditLog.findMany()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'LOGOUT']));
  });

  it('changes the password and signs out other sessions', async () => {
    const other = await login(app, '01000000001');
    const cookie = await login(app, '01000000001');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { cookie },
      payload: { currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' },
    });
    expect(res.statusCode).toBe(200);
    const otherRefresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', headers: { cookie: other } });
    expect(otherRefresh.statusCode).toBe(401);
    await expect(login(app, '01000000001', 'brand-new-pass-1')).resolves.toContain('mk_at=');
  });

  it('rejects a wrong current password on change', async () => {
    const cookie = await login(app, '01000000001');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { cookie },
      payload: { currentPassword: 'wrong-pass-1', newPassword: 'brand-new-pass-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe('currentPassword');
  });
});
