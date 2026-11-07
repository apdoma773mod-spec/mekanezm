import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { cairoInstant } from '../src/modules/staff/service.js';
import { deriveDay } from '../src/modules/camera/derive.js';
import { CameraService } from '../src/modules/camera/service.js';
import { dayToDate, todayYmd } from '../src/lib/dates.js';
import { BRIDGE_SECRET, createTestApp, createUser, login, resetDb } from './helpers.js';

const { app, prisma }: { app: FastifyInstance; prisma: PrismaClient } = await createTestApp();
afterAll(() => app.close());

let admin: string;
let staff: string;
beforeEach(async () => {
  await resetDb(prisma);
  await prisma.cameraChannel.deleteMany({});
  await createUser(prisma, '01000000001', 'ADMIN');
  await createUser(prisma, '01100000001', 'STAFF');
  admin = await login(app, '01000000001');
  staff = await login(app, '01100000001');
});

const call = (cookie: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url: `/api/v1${url}`, headers: { cookie }, ...(payload !== undefined ? { payload: payload as object } : {}) });
const bridge = (method: 'GET' | 'POST', url: string, payload?: unknown, secret = BRIDGE_SECRET) =>
  app.inject({ method, url: `/api/v1/bridge/camera${url}`, headers: { 'x-bridge-secret': secret }, ...(payload !== undefined ? { payload: payload as object } : {}) });

const mkStaff = (name: string, extra: object = {}) =>
  prisma.staff.create({ data: { name, startDate: dayToDate('2026-01-01'), offDay: -1, shiftStart: '00:00', ...extra } });
/** Times inside today's Cairo day whatever the wall clock is: base + minutes (the tests pass a later "now" themselves). */
const base = () => cairoInstant(todayYmd(), '00:00');
const atMin = (m: number) => new Date(base().getTime() + m * 60_000);
const LATER = () => atMin(24 * 60 - 1);
const IMG = 'data:image/jpeg;base64,/9j/4AAQ';

describe('derivation of حضور / انصراف', () => {
  const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 1, h, m));
  it('first sighting is the in, last is the out only after the gap', () => {
    const times = [t(9), t(9, 30), t(12)];
    const early = deriveDay(times, 2, t(13));
    expect(early.inAt).toEqual(t(9));
    expect(early.outAt).toBeNull();
    expect(early.outPending).toBe(true);
    const later = deriveDay(times, 2, t(14, 1));
    expect(later.outAt).toEqual(t(12));
    expect(later.outPending).toBe(false);
  });
  it('a per-worker gap of 3 hours waits longer', () => {
    expect(deriveDay([t(9), t(12)], 3, t(14, 30)).outAt).toBeNull();
    expect(deriveDay([t(9), t(12)], 3, t(15, 1)).outAt).toEqual(t(12));
  });
  it('one sighting only gives an in, never an out', () => {
    const d = deriveDay([t(9)], 2, t(20));
    expect(d.inAt).toEqual(t(9));
    expect(d.outAt).toBeNull();
    expect(deriveDay([], 2, t(20)).inAt).toBeNull();
  });
});

describe('bridge routes', () => {
  it('need the bridge secret', async () => {
    expect((await bridge('GET', '/faces', undefined, 'wrong')).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/v1/bridge/camera/faces' })).statusCode).toBe(403);
    expect((await bridge('GET', '/faces')).statusCode).toBe(200);
  });

  it('photo, then pending, then embedding from the bridge, then ready for matching', async () => {
    const s = await mkStaff('محمد');
    const add = await call(admin, 'POST', '/camera/faces', { staffId: s.id, photo: IMG });
    expect(add.statusCode).toBe(201);
    const photoId = add.json().photo.id;
    let f = (await bridge('GET', '/faces')).json();
    expect(f.pending.map((p: { photoId: string }) => p.photoId)).toEqual([photoId]);
    expect(f.faces).toHaveLength(0);
    await bridge('POST', '/embedding', { photoId, embedding: [0.1, 0.2, 0.3] });
    f = (await bridge('GET', '/faces')).json();
    expect(f.pending).toHaveLength(0);
    expect(f.faces[0]).toMatchObject({ staffId: s.id, name: 'محمد' });
    expect(f.faces[0].embedding).toHaveLength(3);
    const p2 = (await call(admin, 'POST', '/camera/faces', { staffId: s.id, photo: IMG })).json().photo.id;
    await bridge('POST', '/embedding', { photoId: p2, embedding: null });
    expect((await call(admin, 'GET', `/camera/faces/${s.id}`)).json().photos.map((p: { status: string }) => p.status)).toEqual(['ready', 'noface']);
  });

  it('staff cannot reach the admin screen', async () => {
    expect((await call(staff, 'GET', '/camera/overview')).statusCode).toBe(403);
  });

  it('keeps at most 8 photos per worker', async () => {
    const s = await mkStaff('محمد');
    for (let i = 0; i < 8; i++) expect((await call(admin, 'POST', '/camera/faces', { staffId: s.id, photo: IMG })).statusCode).toBe(201);
    expect((await call(admin, 'POST', '/camera/faces', { staffId: s.id, photo: IMG })).statusCode).toBe(400);
  });
});

describe('sightings in suggest mode', () => {
  it('stores sightings and suggests, but writes no attendance', async () => {
    const s = await mkStaff('محمد');
    await call(admin, 'PUT', '/camera/config', { on: true, mode: 'suggest', threshold: 0.6, absentAfter: '23:59', channels: [{ n: 2, label: 'برّه', role: 'in', watch: true }] });
    const seen = (when: Date) => bridge('POST', '/seen', { staffId: s.id, channel: 2, score: 0.8, at: when.toISOString(), snapshot: IMG });
    expect((await seen(atMin(60))).json().wrote).toBe(false);
    await seen(atMin(180));
    expect((await seen(atMin(180))).json().dup).toBe(true);
    const o = await new CameraService(prisma).overview(todayYmd(), LATER());
    const row = o.staff.find((r) => r.staffId === s.id)!;
    expect(row.suggestion.seen).toBe(2);
    expect(row.suggestion.inAt).toBe(atMin(60).toISOString());
    expect(row.suggestion.outAt).toBe(atMin(180).toISOString());
    expect(row.attendance).toBeNull();
    expect(await prisma.attendance.count()).toBe(0);
    await new CameraService(prisma).tick(LATER());
    expect(await prisma.attendance.count()).toBe(0);
  });
});

describe('real writing mode', () => {
  const on = (mode: 'suggest' | 'write') =>
    call(admin, 'PUT', '/camera/config', { on: true, mode, threshold: 0.6, absentAfter: '23:59', channels: [{ n: 2, label: 'برّه', role: 'in', watch: true }] });

  it('writes the in from the first sighting and the out after the gap, keeps the snapshot, can be deleted', async () => {
    const s = await mkStaff('محمد');
    await on('write');
    const r = await bridge('POST', '/seen', { staffId: s.id, channel: 2, score: 0.8, at: atMin(60).toISOString(), snapshot: IMG });
    expect(r.json().wrote).toBe(true);
    const a = await prisma.attendance.findFirstOrThrow({ where: { staffId: s.id } });
    expect(a.method).toBe('camera');
    expect(a.snapshot).toBe(IMG);
    expect(a.outAt).toBeNull();
    await bridge('POST', '/seen', { staffId: s.id, channel: 2, score: 0.8, at: atMin(180).toISOString(), snapshot: IMG });
    expect((await prisma.attendance.findFirstOrThrow({ where: { staffId: s.id } })).inAt).toEqual(a.inAt);
    expect((await new CameraService(prisma).tick(LATER())).outs).toBe(1);
    expect((await prisma.attendance.findFirstOrThrow({ where: { staffId: s.id } })).outAt).not.toBeNull();
    expect((await call(admin, 'DELETE', `/camera/attendance/${a.id}`)).statusCode).toBe(200);
    await new CameraService(prisma).tick(LATER());
    expect(await prisma.attendance.count()).toBe(0);
  });

  it('does not overwrite a QR or manual out', async () => {
    const s = await mkStaff('محمد');
    await on('write');
    await prisma.attendance.create({ data: { staffId: s.id, day: dayToDate(todayYmd()), inAt: atMin(30), outAt: atMin(1000), method: 'qr' } });
    await prisma.sighting.createMany({ data: [{ staffId: s.id, channel: 2, at: atMin(45) }, { staffId: s.id, channel: 2, at: atMin(300) }] });
    await new CameraService(prisma).tick(LATER());
    expect((await prisma.attendance.findFirstOrThrow()).outAt).toEqual(atMin(1000));
  });
});

describe('late alert and the market', () => {
  const cfg = { on: true, mode: 'suggest', threshold: 0.6, absentAfter: '00:00', channels: [] };
  const sent = async () => (await prisma.outboundMessage.findMany({ where: { byName: '🔔 تنبيه تلقائي' } })).map((m) => m.body);

  it('alerts once for a shop worker who was not seen, never for market or both workers or a market day', async () => {
    await mkStaff('بالمحل', { place: 'shop' });
    await mkStaff('بالسوق', { place: 'market' });
    await mkStaff('الاتنين', { place: 'both' });
    const marked = await mkStaff('في السوق النهارده', { place: 'shop' });
    await call(admin, 'PUT', '/camera/config', cfg);
    expect((await call(admin, 'POST', '/camera/market', { staffId: marked.id })).statusCode).toBe(200);
    const svc = new CameraService(prisma);
    expect((await svc.tick()).alerts).toBe(1);
    expect((await svc.tick()).alerts).toBe(0);
    const bodies = await sent();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain('بالمحل');
    expect(bodies[0]).toContain('لسه ما جاش');
    const o = (await call(admin, 'GET', '/camera/overview')).json();
    expect(o.staff.find((r: { name: string }) => r.name === 'بالمحل').notSeen).toBe(true);
    expect(o.staff.find((r: { name: string }) => r.name === 'بالسوق').notSeen).toBe(false);
    expect(o.staff.find((r: { name: string }) => r.name === 'في السوق النهارده').market).toBe(true);
    await call(admin, 'POST', '/camera/market', { staffId: marked.id, on: false });
    expect(await prisma.marketDay.count()).toBe(0);
  });

  it('a worker seen on camera is not reported absent', async () => {
    const s = await mkStaff('محمد');
    await call(admin, 'PUT', '/camera/config', cfg);
    await prisma.sighting.create({ data: { staffId: s.id, channel: 2, at: new Date() } });
    expect((await new CameraService(prisma).tick()).alerts).toBe(0);
  });

  it('nothing happens while the cameras are off', async () => {
    await mkStaff('محمد');
    expect((await new CameraService(prisma).tick()).alerts).toBe(0);
  });
});

describe('unknown faces', () => {
  it('an unknown face can be named: it becomes that worker sighting and a new photo', async () => {
    const s = await mkStaff('محمد');
    await bridge('POST', '/seen', { staffId: null, channel: 8, score: 0.3, snapshot: IMG, embedding: [1, 0, 0] });
    await bridge('POST', '/seen', { staffId: null, channel: 8, score: 0.3, snapshot: IMG, embedding: [0.99, 0.01, 0] });
    await bridge('POST', '/seen', { staffId: null, channel: 8, score: 0.3, snapshot: IMG, embedding: [0, 1, 0] });
    let o = (await call(admin, 'GET', '/camera/overview')).json();
    expect(o.unknown).toHaveLength(3);
    expect(o.unknown[0].snapshot).toBe(IMG);
    const first = (await prisma.sighting.findMany({ where: { staffId: null } })).find((x) => x.embedding[0] === 1)!;
    expect((await call(admin, 'POST', `/camera/sightings/${first.id}/name`, { staffId: s.id })).statusCode).toBe(200);
    o = (await call(admin, 'GET', '/camera/overview')).json();
    expect(o.unknown).toHaveLength(1);
    expect(await prisma.sighting.count({ where: { staffId: s.id } })).toBe(2);
    expect((await prisma.facePhoto.findFirstOrThrow({ where: { staffId: s.id } })).status).toBe('ready');
    await call(admin, 'POST', `/camera/sightings/${o.unknown[0].id}/dismiss`);
    expect((await call(admin, 'GET', '/camera/overview')).json().unknown).toHaveLength(0);
  });
});

describe('staff file fields', () => {
  it('saves gapHours and place', async () => {
    const r = await call(admin, 'POST', '/staff', { name: 'سعيد', gapHours: 3, place: 'both', startDate: '2026-01-01' });
    expect(r.statusCode).toBe(201);
    expect(r.json().staff).toMatchObject({ gapHours: 3, place: 'both' });
  });
});
