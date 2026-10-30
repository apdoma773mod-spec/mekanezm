import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createTestApp, createUser, login, resetDb } from './helpers.js';
import { _test, chk, mergeStrips } from '../src/modules/ai/scans.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let staff: string;
beforeEach(async () => {
  await resetDb(prisma);
  await createUser(prisma, '01100000001', 'STAFF', 'كريم');
  staff = await login(app, '01100000001');
});

const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1/ai/scans${url}`, headers: { cookie: staff }, ...(payload !== undefined ? { payload: payload as object } : {}) });
// a 1×1 white JPEG is enough: the AI answer is faked
const JPG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

describe('invoice photo queue', () => {
  it('strips merge without the rows repeated at the borders, and the self check sees a missing row', () => {
    const a = { items: [{ text: 'مفصلة', qty: 2, price: 10 }, { text: 'مجرى 45', qty: 1, price: 50 }] };
    const b = { items: [{ text: 'مجرى 45', qty: 1, price: 50 }, { text: 'مقبض', qty: 4, price: 5 }] };
    expect(mergeStrips([a, b]).map((x) => x.text)).toEqual(['مفصلة', 'مجرى 45', 'مقبض']);
    expect(chk(a.items, { grand_total: 90 }).ok).toBe(false);
    expect(chk(mergeStrips([a, b]), { grand_total: 90, rows: 3 }).ok).toBe(true);
  });

  it('a photo waits in the queue, is read in the background, then becomes an invoice', async () => {
    const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const answer = { supplier: 'الأمل', invoice_no: '77', items: [{ text: 'مفصلة', qty: 2, price: 10, total: 20 }] };
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ content: [{ type: 'tool_use', input: answer }] }) }));
    try {
      expect((await app.inject({ method: 'GET', url: '/api/v1/ai/scans' })).statusCode).toBe(401);
      expect((await call('POST', '/', { pages: [] })).statusCode).toBe(400);
      const s = (await call('POST', '/', { pages: [{ full: JPG, strips: [JPG, JPG] }], supplier: 'الأمل' })).json();
      expect(s.status).toBe('pending');
      expect(s.strips).toEqual([2]);
      await _test.tick(prisma, app.log);
      const done = (await call('GET', '/')).json().items[0];
      expect(done.status).toBe('done');
      expect(done.result.items[0].text).toBe('مفصلة');
      expect(done.createdBy).toBe('كريم');
      await call('POST', `/${s.id}/used`, { pno: 'SH-0001' });
      const used = (await call('GET', '/')).json().items[0];
      expect(used.status).toBe('used');
      expect(used.result.pno).toBe('SH-0001');
      await call('DELETE', `/${s.id}`);
      expect((await call('GET', '/')).json().items).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('a busy service puts it back to wait; «حاول دلوقتي» resets it', async () => {
    const saved = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 529, json: async () => ({ error: { message: 'Overloaded' } }) }));
    try {
      const s = (await call('POST', '/', { pages: [{ full: JPG }] })).json();
      // the upload starts the reader in the background; it tries 3 times on the spot (3 s + 8 s) then waits
      await vi.waitFor(async () => expect((await call('GET', '/')).json().items[0].attempts).toBe(1), { timeout: 25000, interval: 500 });
      await vi.waitFor(async () => expect((await call('GET', '/')).json().items[0].status).toBe('pending'), { timeout: 25000, interval: 500 });
      const w = (await call('GET', '/')).json().items[0];
      expect(w.status).toBe('pending');
      expect(w.attempts).toBe(1);
      expect(Date.parse(w.nextAt)).toBeGreaterThan(Date.now());
      await call('POST', `/${s.id}/retry`);
      expect((await call('GET', '/')).json().items[0].attempts).toBe(0);
    } finally {

      vi.unstubAllGlobals();
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
