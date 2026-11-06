import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  await prisma.product.create({ data: { code: 'P-1', name: 'مقبض ستانلس 128', category: 'مقابض', price: 40 } });
  await prisma.product.create({ data: { code: 'P-2', name: 'مفصلة هيدروليك', category: 'مفصلات', price: 25 } });
});

// a 1×1 JPEG: the AI answer is faked
const JPG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

async function withFake<T>(answer: unknown, run: () => Promise<T>): Promise<T> {
  const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  delete process.env.GEMINI_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'fake';
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ content: [{ type: 'tool_use', input: answer }] }) }));
  try {
    return await run();
  } finally {
    vi.unstubAllGlobals();
    if (saved.g) process.env.GEMINI_API_KEY = saved.g;
    if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
    else delete process.env.ANTHROPIC_API_KEY;
  }
}

describe('photo search + AI description', () => {
  it('match-product keeps only codes the shop has, best three, and describe-product is for the owner', async () => {
    const r = await withFake({ seen: 'مقبض معدن فضي', matches: [{ code: 'P-1', score: 88, why: 'نفس الشكل' }, { code: 'ZZZ', score: 90 }] }, () =>
      app.inject({ method: 'POST', url: '/api/v1/ai/match-product', headers: { cookie: staff }, payload: { image: `data:image/jpeg;base64,${JPG}` } }),
    );
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ seen: 'مقبض معدن فضي', matches: [{ code: 'P-1', score: 88, why: 'نفس الشكل' }] });

    const d = await withFake({ description: 'مقبض ستانلس متين.' }, () =>
      app.inject({ method: 'POST', url: '/api/v1/ai/describe-product', headers: { cookie: admin }, payload: { name: 'مقبض', cat: 'مقابض', hint: 'الماركة: X' } }),
    );
    expect(d.json()).toEqual({ description: 'مقبض ستانلس متين.' });
    const f = await app.inject({ method: 'POST', url: '/api/v1/ai/describe-product', headers: { cookie: staff }, payload: { name: 'مقبض' } });
    expect(f.statusCode).toBe(403);
  });

  it('says so when there is no AI key', async () => {
    const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await app.inject({ method: 'POST', url: '/api/v1/ai/match-product', headers: { cookie: staff }, payload: { image: JPG } });
      expect(r.statusCode).toBe(503);
      expect(r.json().error.message).toContain('مفتاح');
    } finally {
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
    }
  });
});
