import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let staff: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01100000001', 'STAFF', 'كريم');
  staff = await login(app, '01100000001');
});

describe('supplier item names (invoice_aliases)', () => {
  it('anyone who buys can add names; they merge per supplier and everyone reads them', async () => {
    const post = (sup: string, map: Record<string, string>) => app.inject({ method: 'POST', url: '/api/v1/work/aliases', headers: { cookie: staff }, payload: { sup, map } });
    expect((await post('مورد', { 'مفصله 35': 'p1' })).statusCode).toBe(200);
    expect((await post('مورد', { 'مجري': 'p2' })).statusCode).toBe(200);
    expect((await post('تاني', { 'x': 'p3' })).statusCode).toBe(200);
    const r = await app.inject({ method: 'GET', url: '/api/v1/work/kv/invoice_aliases', headers: { cookie: staff } });
    expect(r.json().value).toEqual({ مورد: { 'مفصله 35': 'p1', مجري: 'p2' }, تاني: { x: 'p3' } });
    expect((await app.inject({ method: 'GET', url: '/api/v1/work/kv/points', headers: { cookie: staff } })).statusCode).toBe(403);
  });

  it("shows how much of a product is reserved to every signed-in user", async () => {
    await prisma.setting.create({ data: { key: "reservations", value: [{ pid: "p9", qty: 3, cust: "أحمد" }, { pid: "p9", qty: 2, cust: "منى" }, { pid: "x", qty: 1, cust: "ز" }] } });
    const r = await app.inject({ method: "GET", url: "/api/v1/work/reserved/p9", headers: { cookie: staff } });
    expect(r.json()).toEqual({ qty: 5, custs: ["أحمد", "منى"] });
  });
});
