import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { isNear, isScrapText, missing, parseScrapText } from '../src/modules/scraps/match.js';
import { pingWants } from '../src/modules/scraps/service.js';
import { BRIDGE_SECRET, createTestApp, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());
beforeEach(async () => {
  await resetDb(prisma);
  await prisma.scrapWant.deleteMany();
  await prisma.scrap.deleteMany();
  await prisma.setting.deleteMany({ where: { key: 'scrap_wa_pending' } });
});

const wa = (body: string, phone = '201011112222') =>
  app.inject({ method: 'POST', url: '/api/v1/bridge/wa/submit', headers: { 'x-bridge-secret': BRIDGE_SECRET }, payload: { phone, name: 'حسن النجار', body } });
const pub = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1/web/scraps${url}`, ...(payload !== undefined ? { payload: payload as object } : {}) });
const outbox = () => prisma.outboundMessage.findMany({ orderBy: { createdAt: 'asc' } });

describe('reading a craftsman’s WhatsApp line', () => {
  it('reads board, thickness, colour, size and count (Arabic digits)', () => {
    const d = parseScrapText('فضلة ميلامين ١٨ جوزي ٧٠×٣٠ × ٢');
    expect(d).toMatchObject({ category: 'sheet', material: 'MDF مكسي (ميلامين)', thick: 18, color: 'جوزي', pieces: [{ len: 70, wid: 30, qty: 2 }] });
    expect(missing(d)).toBeNull();
  });
  it('several sizes, «في» as the times sign, thickness with its unit, a colour code', () => {
    const d = parseScrapText('فضلات MDF سمك 16 مم H1180 120 في 40 و 60x35');
    expect(d.thick).toBe(16);
    expect(d.code).toBe('H1180');
    expect(d.pieces).toEqual([{ len: 120, wid: 40, qty: 1 }, { len: 60, wid: 35, qty: 1 }]);
  });
  it('solid wood and aluminium', () => {
    expect(parseScrapText('فضلة زان 4 سم ... 90×12').category).toBe('solid');
    const a = parseScrapText('فضلة ألمونيوم قطاع دلف 250 سم × 3');
    expect(a).toMatchObject({ category: 'alu', material: 'قطاع دلف', pieces: [{ len: 250, wid: null, qty: 3 }] });
    expect(missing(a)).toBeNull();
  });
  it('asks for what is missing', () => {
    expect(missing(parseScrapText('فضلة ميلامين ابيض 70×30'))).toBe('thick');
    expect(missing(parseScrapText('فضلة ميلامين 18'))).toBe('size');
  });
  it('only messages that say «فضلة» are offcuts', () => {
    expect(isScrapText('عندي فضلة ميلامين')).toBe(true);
    expect(isScrapText('عايز أفضل سعر لمفصلات')).toBe(false);
    expect(isScrapText('تفضله يا باشا')).toBe(false);
  });
});

describe('WhatsApp → سوق الفضلة', () => {
  it('a full line is listed at once and the craftsman gets his link', async () => {
    const r = await wa('فضلة ميلامين ١٨ جوزي ٧٠×٣٠ × ٢');
    expect(r.json()).toEqual({ id: 'scrap' });
    expect(await prisma.waOrder.count()).toBe(0);
    const s = await prisma.scrap.findFirstOrThrow();
    expect(s).toMatchObject({ phone: '01011112222', name: 'حسن النجار', thick: 18, len: 70, wid: 30, qty: 2, source: 'whatsapp' });
    const [m] = await outbox();
    expect(m.toPhone).toBe('201011112222');
    expect(m.body).toContain('اتسجلت ✔');
    expect(m.body).toContain(`/scraps/mine?k=${s.id}.${s.secret}`);
  });

  it('missing thickness: one short question, the answer lists it', async () => {
    await wa('فضلة ميلامين ابيض 70×30');
    expect(await prisma.scrap.count()).toBe(0);
    expect((await outbox())[0].body).toContain('سمك');
    await wa('18');
    const s = await prisma.scrap.findFirstOrThrow();
    expect(s.thick).toBe(18);
    expect((await outbox())[1].body).toContain('اتسجلت');
  });

  it('a normal customer message is still an order', async () => {
    await wa('عايز 10 مفصلات سوفت');
    expect(await prisma.waOrder.count()).toBe(1);
    expect(await prisma.scrap.count()).toBe(0);
  });
});

describe('site API and «حد دوّر على مقاسك»', () => {
  it('lists without name/phone, reveals on contact, owner can mark sold with the secret', async () => {
    const add = await pub('POST', '', { category: 'sheet', material: 'MDF خام', thick: 18, len: 100, wid: 50, name: 'محمود', phone: '01099998888' });
    const { id, secret } = add.json();
    const list = (await pub('GET', '')).json();
    expect(list).toHaveLength(1);
    expect(list[0].phone).toBeUndefined();
    expect((await pub('POST', `/${id}/contact`)).json()).toMatchObject({ name: 'محمود', phone: '01099998888' });
    expect((await pub('POST', `/${id}/done`, { secret: 'wrongwrong', status: 'sold' })).statusCode).toBe(404);
    expect((await pub('POST', '/mine', { pairs: [{ id, secret }] })).json()[0].id).toBe(id);
    await pub('POST', `/${id}/done`, { secret, status: 'sold' });
    expect((await pub('GET', '')).json()).toHaveLength(0);
  });

  it('a search a little bigger than a piece pings its owner once, without the searcher', async () => {
    await pub('POST', '', { category: 'sheet', material: 'MDF خام', thick: 18, len: 95, wid: 50, name: 'محمود', phone: '01099998888' });
    expect((await pub('POST', '/want', { category: 'sheet', material: 'MDF خام', thick: 18, len: 100, wid: 50 })).json()).toEqual({ queued: true });
    expect(await pingWants(prisma)).toBe(1);
    const [m] = await outbox();
    expect(m.toPhone).toBe('201099998888');
    expect(m.body).toContain('في حد دوّر');
    await pub('POST', '/want', { category: 'sheet', material: 'MDF خام', thick: 18, len: 100, wid: 52 });
    expect(await pingWants(prisma)).toBe(0); // not again within a few days
  });

  it('a search that already has a real hit pings nobody; another thickness is not near', async () => {
    await pub('POST', '', { category: 'sheet', thick: 18, len: 120, wid: 60, name: 'محمود', phone: '01099998888' });
    expect((await pub('POST', '/want', { category: 'sheet', thick: 18, len: 100, wid: 50 })).json()).toEqual({ queued: false });
    expect(isNear({ category: 'sheet', material: '', thick: 16, len: 120, wid: 60, grain: false }, { category: 'sheet', material: '', thick: 18, len: 100, wid: 50 })).toBe(false);
  });
});
