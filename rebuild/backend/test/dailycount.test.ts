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
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  await createUser(prisma, '01100000001', 'STAFF', 'كريم');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
  for (let i = 1; i <= 12; i++) await call(admin, 'POST', '/products', { name: `صنف ${i}`, price: 10, cost: 6, qty: 20, minQty: 1, unit: 'قطعة' });
});

const call = (cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe('daily count', () => {
  it('10 products a day, the same ones all day; the counter does not see the system quantity, the owner does', async () => {
    const a = (await call(staff, 'GET', '/daily-count')).json();
    expect(a.items).toHaveLength(10);
    expect(a.items[0].system).toBeUndefined();
    const b = (await call(staff, 'GET', '/daily-count')).json();
    expect(b.items.map((i: { id: string }) => i.id)).toEqual(a.items.map((i: { id: string }) => i.id));
    expect((await call(admin, 'GET', '/daily-count')).json().items[0].system).toBe(20);
  });

  it('a count with a difference alerts the owner and changes nothing until the owner approves', async () => {
    const list = (await call(staff, 'GET', '/daily-count')).json().items as { id: string }[];
    const answers = list.map((p, i) => ({ productId: p.id, counted: i === 0 ? 17 : 20 }));
    expect((await call(staff, 'POST', '/daily-count', { answers: answers.slice(0, 5) })).statusCode).toBe(400);
    const r = await call(staff, 'POST', '/daily-count', { answers });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('submitted');
    const alerts = await prisma.outboundMessage.findMany({ where: { body: { contains: 'الجرد اليومي' } } });
    expect(alerts.length).toBeGreaterThan(0);
    expect((await prisma.product.findUnique({ where: { id: list[0]!.id } }))!.qty.toString()).toBe('20');
    expect((await call(staff, 'POST', '/daily-count/approve')).statusCode).toBe(403);
    const ok = await call(admin, 'POST', '/daily-count/approve');
    expect(ok.json().status).toBe('approved');
    expect((await prisma.product.findUnique({ where: { id: list[0]!.id } }))!.qty.toString()).toBe('17');
    expect((await call(staff, 'POST', '/daily-count', { answers })).statusCode).toBe(400);
  });

  it('counted products go to the back of the queue the next day', async () => {
    const list = (await call(staff, 'GET', '/daily-count')).json().items as { id: string }[];
    await call(staff, 'POST', '/daily-count', { answers: list.map((p) => ({ productId: p.id, counted: 20 })) });
    await call(admin, 'POST', '/daily-count/close');
    // tomorrow: roll the stored day back so a new list is made
    const row = await prisma.setting.findUnique({ where: { key: 'daily_count' } });
    await prisma.setting.update({ where: { key: 'daily_count' }, data: { value: { ...(row!.value as object), day: '2000-01-01' } as never } });
    const next = (await call(staff, 'GET', '/daily-count')).json().items as { id: string }[];
    const old = new Set(list.map((p) => p.id));
    expect(next.filter((p) => !old.has(p.id))).toHaveLength(2);
  });
});
