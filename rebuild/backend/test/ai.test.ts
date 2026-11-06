import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let staff: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01000000001', 'ADMIN', 'عبده');
  await createUser(prisma, '01100000001', 'STAFF', 'كريم');
  staff = await login(app, '01100000001');
});

describe('invoice photo reader', () => {
  it('needs a login, a picture and an AI key', async () => {
    const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect((await app.inject({ method: 'POST', url: '/api/v1/ai/read-image', payload: { image: 'abc' } })).statusCode).toBe(401);
      const r = await app.inject({ method: 'POST', url: '/api/v1/ai/read-image', headers: { cookie: staff }, payload: { image: 'abc' } });
      expect(r.statusCode).toBe(503);
      expect(r.json().error.message).toContain('مفتاح');
    } finally {
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
    }
  });
});
