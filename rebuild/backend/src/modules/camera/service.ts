import type { Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_CAMERA_CONFIG,
  type CameraConfig,
  type CameraOverview,
  type CameraStaffDay,
  type FacePhotoDto,
  type SightingDto,
} from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { raiseAlert } from '../../lib/alerts.js';
import { writeAudit } from '../../lib/audit.js';
import { addDays, dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { cairoHm, cairoInstant, hmCairo, toMin } from '../staff/service.js';
import { cosine, deriveDay } from './derive.js';

const CFG_KEY = 'camera';
const STATE_KEY = 'camera_state';
const MAX_FACES = 8;
/** the same worker seen again within this window is the same sighting */
const DEDUP_MS = 60_000;
const KEEP_SIGHTINGS_DAYS = 45;
const KEEP_UNKNOWN_DAYS = 7;

interface CameraState {
  /** first day the system was turned on (the two-week «اقتراح» period counts from it) */
  since?: string;
  bridgeAt?: string;
  /** who got the «لسه ما جاش» alert today */
  alerted?: { day: string; ids: string[] };
}

const sightingDto = (s: { id: string; staffId: string | null; channel: number; score: number; at: Date; snapshot?: string }, withSnap = false): SightingDto => ({
  id: s.id,
  staffId: s.staffId,
  channel: s.channel,
  score: s.score,
  at: s.at.toISOString(),
  snapshot: withSnap ? (s.snapshot ?? '') : '',
});

/** The UTC range of a Cairo business day. */
const dayBounds = (day: string) => ({ from: cairoInstant(day, '00:00'), to: cairoInstant(addDays(day, 1), '00:00') });

/** «📷 الكاميرات»: sightings, derived attendance suggestions, and the bridge's data. */
export class CameraService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---------- settings ----------

  async config(): Promise<CameraConfig> {
    const s = await this.prisma.setting.findUnique({ where: { key: CFG_KEY } });
    return { ...DEFAULT_CAMERA_CONFIG, ...((s?.value ?? {}) as Partial<CameraConfig>) };
  }

  private async state(): Promise<CameraState> {
    const s = await this.prisma.setting.findUnique({ where: { key: STATE_KEY } });
    return (s?.value ?? {}) as CameraState;
  }
  private async putState(patch: Partial<CameraState>) {
    const value = { ...(await this.state()), ...patch } as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, value }, update: { value } });
  }

  async saveConfig(cfg: CameraConfig, actor: Actor): Promise<CameraConfig> {
    const state = await this.state();
    await this.prisma.$transaction(async (tx) => {
      const value = cfg as unknown as Prisma.InputJsonValue;
      await tx.setting.upsert({ where: { key: CFG_KEY }, create: { key: CFG_KEY, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: CFG_KEY, ip: actor.ip });
    });
    if (cfg.on && !state.since) await this.putState({ since: todayYmd() });
    return cfg;
  }

  async since(): Promise<string | null> {
    return (await this.state()).since ?? null;
  }

  // ---------- faces ----------

  async photos(staffId: string): Promise<FacePhotoDto[]> {
    const rows = await this.prisma.facePhoto.findMany({ where: { staffId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({ id: r.id, staffId: r.staffId, photo: r.photo, status: r.status as FacePhotoDto['status'] }));
  }

  async addPhoto(staffId: string, photo: string, actor: Actor): Promise<FacePhotoDto> {
    if (!(await this.prisma.staff.findUnique({ where: { id: staffId } }))) throw notFound('الموظف ده مش موجود');
    if ((await this.prisma.facePhoto.count({ where: { staffId } })) >= MAX_FACES) throw badRequest(`أقصى عدد صور ${MAX_FACES} — امسح واحدة الأول`);
    const r = await this.prisma.facePhoto.create({ data: { staffId, photo } });
    await writeAudit(this.prisma, { userId: actor.id, action: 'STAFF_SAVE', entity: 'Staff', entityId: staffId, ip: actor.ip });
    return { id: r.id, staffId, photo: r.photo, status: 'pending' };
  }

  async removePhoto(id: string, actor: Actor) {
    const r = await this.prisma.facePhoto.findUnique({ where: { id } });
    if (!r) throw notFound('الصورة دي مش موجودة');
    await this.prisma.facePhoto.delete({ where: { id } });
    await writeAudit(this.prisma, { userId: actor.id, action: 'STAFF_SAVE', entity: 'Staff', entityId: r.staffId, ip: actor.ip });
  }

  // ---------- the bridge ----------

  /** Everything the bridge needs: what to watch, who to look for, which photos still need an embedding. */
  async bridgeFaces() {
    const [cfg, photos] = await Promise.all([
      this.config(),
      this.prisma.facePhoto.findMany({ where: { staff: { active: true } }, include: { staff: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      on: cfg.on,
      mode: cfg.mode,
      threshold: cfg.threshold,
      channels: cfg.channels.filter((c) => c.watch).map((c) => c.n),
      faces: photos.filter((p) => p.status === 'ready' && p.embedding.length).map((p) => ({ photoId: p.id, staffId: p.staffId, name: p.staff.name, embedding: p.embedding })),
      pending: photos.filter((p) => p.status === 'pending').map((p) => ({ photoId: p.id, photo: p.photo })),
    };
  }

  async bridgeEmbedding(photoId: string, embedding: number[] | null) {
    const p = await this.prisma.facePhoto.findUnique({ where: { id: photoId } });
    if (!p) throw notFound('الصورة دي مش موجودة');
    await this.prisma.facePhoto.update({ where: { id: photoId }, data: embedding?.length ? { embedding, status: 'ready' } : { embedding: [], status: 'noface' } });
  }

  async bridgeStatus(list: { n: number; ok: boolean; snapshot: string; note: string }[]) {
    const now = new Date();
    for (const c of list) {
      const data = { note: c.ok ? '' : c.note || 'مفيش صورة', ...(c.ok ? { lastSnapAt: now } : {}), ...(c.ok && c.snapshot ? { snapshot: c.snapshot } : {}) };
      await this.prisma.cameraChannel.upsert({ where: { channel: c.n }, create: { channel: c.n, ...data }, update: data });
    }
    await this.putState({ bridgeAt: now.toISOString() });
  }

  /** A face the bridge recognised (staffId) or could not (unknown, with its embedding to be named later). */
  async recordSeen(input: { staffId: string | null; channel: number; score: number; at?: string; snapshot: string; embedding: number[] }) {
    const at = input.at ? new Date(input.at) : new Date();
    if (input.staffId) {
      const s = await this.prisma.staff.findUnique({ where: { id: input.staffId } });
      if (!s) throw notFound('الموظف ده مش موجود');
      const dup = await this.prisma.sighting.findFirst({ where: { staffId: s.id, at: { gte: new Date(at.getTime() - DEDUP_MS), lte: new Date(at.getTime() + DEDUP_MS) } } });
      if (dup) return { ok: true, dup: true };
    }
    const row = await this.prisma.sighting.create({
      data: { staffId: input.staffId, channel: input.channel, score: input.score, at, snapshot: input.snapshot, embedding: input.staffId ? [] : input.embedding },
    });
    await this.prisma.cameraChannel.upsert({ where: { channel: input.channel }, create: { channel: input.channel, lastSeenAt: at }, update: { lastSeenAt: at } });
    let wrote = false;
    if (input.staffId) wrote = await this.writeIn(input.staffId, at, input.snapshot);
    return { ok: true, id: row.id, wrote };
  }

  /** In «تسجيل» mode, the first sighting of the day becomes a real «حضور» (same rules as the QR punch). */
  private async writeIn(staffId: string, at: Date, snapshot: string): Promise<boolean> {
    const cfg = await this.config();
    if (!cfg.on || cfg.mode !== 'write') return false;
    const s = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!s?.active) return false;
    const dayStr = todayYmd(at);
    if (dayStr !== todayYmd()) return false;
    const day = dayToDate(dayStr);
    const exists = await this.prisma.attendance.findUnique({ where: { staffId_day: { staffId, day } } });
    if (exists) return false;
    const late = Math.max(0, cairoHm(at) - toMin(s.shiftStart));
    const lm = late > 600 ? 0 : late;
    try {
      await this.prisma.attendance.create({ data: { staffId, day, inAt: at, lateMin: lm, method: 'camera', byName: 'الكاميرا', snapshot, note: '📷 بالكاميرا' } });
    } catch {
      return false; // someone punched at the same moment
    }
    await raiseAlert(this.prisma, 'staff', `👷 ${s.name} حضر الساعة ${hmCairo(at)}${lm > 10 ? ` — متأخر ${lm} دقيقة` : ''} (بالكاميرا)`, null);
    return true;
  }

  // ---------- the screen ----------

  async overview(day: string, now = new Date()): Promise<CameraOverview> {
    const { from, to } = dayBounds(day);
    const [cfg, state, chans, staff, sightings, unknown, att, marks, faces] = await Promise.all([
      this.config(),
      this.state(),
      this.prisma.cameraChannel.findMany(),
      this.prisma.staff.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.sighting.findMany({ where: { staffId: { not: null }, at: { gte: from, lt: to } }, orderBy: { at: 'asc' }, select: { id: true, staffId: true, channel: true, score: true, at: true } }),
      this.prisma.sighting.findMany({ where: { staffId: null, dismissed: false, at: { gte: new Date(Date.now() - KEEP_UNKNOWN_DAYS * 86_400_000) } }, orderBy: { at: 'desc' }, take: 40 }),
      this.prisma.attendance.findMany({ where: { day: dayToDate(day) } }),
      this.prisma.marketDay.findMany({ where: { day: dayToDate(day) } }),
      this.prisma.facePhoto.groupBy({ by: ['staffId', 'status'], _count: true }),
    ]);
    const isToday = day === todayYmd(now);
    const absentAt = cairoInstant(day, cfg.absentAfter);
    const rows: CameraStaffDay[] = staff.map((s) => {
      const mine = sightings.filter((x) => x.staffId === s.id);
      const d = deriveDay(mine.map((x) => x.at), s.gapHours, now);
      const a = att.find((x) => x.staffId === s.id) ?? null;
      const place = (s.place === 'market' || s.place === 'both' ? s.place : 'shop') as CameraStaffDay['place'];
      const market = marks.some((m) => m.staffId === s.id);
      const lateMin = d.inAt ? Math.max(0, cairoHm(d.inAt) - toMin(s.shiftStart)) : 0;
      const offToday = new Date(`${day}T12:00:00Z`).getUTCDay() === s.offDay;
      const fs = faces.filter((f) => f.staffId === s.id);
      return {
        staffId: s.id,
        name: s.name,
        place,
        gapHours: s.gapHours,
        market,
        faces: fs.reduce((n, f) => n + f._count, 0),
        facesReady: fs.filter((f) => f.status === 'ready').reduce((n, f) => n + f._count, 0),
        suggestion: { inAt: d.inAt?.toISOString() ?? null, outAt: d.outAt?.toISOString() ?? null, outPending: d.outPending, seen: d.seen },
        attendance: a ? { id: a.id, inAt: a.inAt?.toISOString() ?? null, outAt: a.outAt?.toISOString() ?? null, lateMin: a.lateMin, method: a.method, snapshot: a.snapshot } : null,
        late: place === 'shop' && lateMin > 10 && lateMin <= 600,
        notSeen: isToday && place === 'shop' && !market && !offToday && !d.seen && !a?.inAt && now >= absentAt && dayToDate(day) >= s.startDate,
      };
    });
    const known = cfg.channels.map((c) => {
      const r = chans.find((x) => x.channel === c.n);
      return { ...c, lastSnapAt: r?.lastSnapAt?.toISOString() ?? null, lastSeenAt: r?.lastSeenAt?.toISOString() ?? null, snapshot: r?.snapshot ?? '', note: r?.note ?? '' };
    });
    return {
      day,
      config: cfg,
      bridgeAt: state.bridgeAt ?? null,
      channels: known,
      staff: rows,
      sightings: sightings.map((s) => sightingDto(s)),
      unknown: unknown.map((s) => sightingDto(s, true)),
    };
  }

  async sighting(id: string) {
    const s = await this.prisma.sighting.findUnique({ where: { id } });
    if (!s) throw notFound('اللقطة دي مش موجودة');
    return sightingDto(s, true);
  }

  async deleteSighting(id: string, actor: Actor) {
    const s = await this.prisma.sighting.findUnique({ where: { id } });
    if (!s) throw notFound('اللقطة دي مش موجودة');
    await this.prisma.sighting.delete({ where: { id } });
    await writeAudit(this.prisma, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: id, ip: actor.ip });
  }

  async dismiss(id: string) {
    const s = await this.prisma.sighting.findUnique({ where: { id } });
    if (!s) throw notFound('اللقطة دي مش موجودة');
    await this.prisma.sighting.update({ where: { id }, data: { dismissed: true } });
  }

  /** The owner says «ده فلان»: the sighting becomes his, and its face joins his photos so he is recognised better. */
  async nameSighting(id: string, staffId: string, actor: Actor) {
    const s = await this.prisma.sighting.findUnique({ where: { id } });
    if (!s || s.staffId) throw notFound('اللقطة دي مش موجودة');
    if (!(await this.prisma.staff.findUnique({ where: { id: staffId } }))) throw notFound('الموظف ده مش موجود');
    const count = await this.prisma.facePhoto.count({ where: { staffId } });
    await this.prisma.$transaction(async (tx) => {
      await tx.sighting.update({ where: { id }, data: { staffId, embedding: [] } });
      if (s.embedding.length && s.snapshot && count < MAX_FACES) {
        await tx.facePhoto.create({ data: { staffId, photo: s.snapshot, embedding: s.embedding, status: 'ready' } });
      }
      // the same face seen in other unknown snapshots today
      const near = await tx.sighting.findMany({ where: { staffId: null, dismissed: false, id: { not: id }, at: { gte: new Date(s.at.getTime() - 86_400_000) } } });
      const same = near.filter((n) => n.embedding.length && cosine(n.embedding, s.embedding) >= 0.9).map((n) => n.id);
      if (same.length) await tx.sighting.updateMany({ where: { id: { in: same } }, data: { staffId, embedding: [] } });
      await writeAudit(tx, { userId: actor.id, action: 'STAFF_SAVE', entity: 'Staff', entityId: staffId, ip: actor.ip });
    });
  }

  async market(staffId: string, day: string, on: boolean, actor: Actor) {
    if (!(await this.prisma.staff.findUnique({ where: { id: staffId } }))) throw notFound('الموظف ده مش موجود');
    const key = { staffId_day: { staffId, day: dayToDate(day) } };
    if (on) await this.prisma.marketDay.upsert({ where: key, create: { staffId, day: dayToDate(day) }, update: {} });
    else await this.prisma.marketDay.deleteMany({ where: { staffId, day: dayToDate(day) } });
    await writeAudit(this.prisma, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: staffId, after: { day, on }, ip: actor.ip });
  }

  async deleteAttendance(id: string, actor: Actor) {
    const a = await this.prisma.attendance.findUnique({ where: { id } });
    if (!a) throw notFound('السجل ده مش موجود');
    await this.prisma.attendance.delete({ where: { id } });
    await writeAudit(this.prisma, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: a.staffId, after: { day: dateToDay(a.day), method: a.method }, ip: actor.ip });
  }

  // ---------- the clock: out-times, absent alerts, cleanup ----------

  /** Called every few minutes by the server. */
  async tick(now = new Date()) {
    const cfg = await this.config();
    if (!cfg.on) return { outs: 0, alerts: 0 };
    let outs = 0;
    let alerts = 0;
    const today = todayYmd(now);

    // «انصراف» in write mode: today and yesterday, only where the record has no out yet
    if (cfg.mode === 'write') {
      for (const day of [addDays(today, -1), today]) {
        const { from, to } = dayBounds(day);
        const open = await this.prisma.attendance.findMany({ where: { day: dayToDate(day), inAt: { not: null }, outAt: null }, include: { staff: true } });
        for (const a of open) {
          const times = (await this.prisma.sighting.findMany({ where: { staffId: a.staffId, at: { gte: from, lt: to } }, select: { at: true } })).map((x) => x.at);
          const d = deriveDay(times, a.staff.gapHours, now);
          if (!d.outAt || d.outAt <= a.inAt!) continue;
          await this.prisma.attendance.update({ where: { id: a.id }, data: { outAt: d.outAt } });
          await raiseAlert(this.prisma, 'staff', `👷 ${a.staff.name} انصرف الساعة ${hmCairo(d.outAt)} (بالكاميرا)`, null);
          outs++;
        }
      }
    }

    // «لسه ما جاش»: shop workers only, not on a market day, not on their day off
    if (cairoHm(now) >= toMin(cfg.absentAfter)) {
      const state = await this.state();
      const done = new Set(state.alerted?.day === today ? state.alerted.ids : []);
      const { from, to } = dayBounds(today);
      const [staff, att, marks, seen] = await Promise.all([
        this.prisma.staff.findMany({ where: { active: true, place: 'shop', startDate: { lte: dayToDate(today) } } }),
        this.prisma.attendance.findMany({ where: { day: dayToDate(today), inAt: { not: null } }, select: { staffId: true } }),
        this.prisma.marketDay.findMany({ where: { day: dayToDate(today) }, select: { staffId: true } }),
        this.prisma.sighting.findMany({ where: { staffId: { not: null }, at: { gte: from, lt: to } }, select: { staffId: true }, distinct: ['staffId'] }),
      ]);
      const here = new Set([...att.map((x) => x.staffId), ...marks.map((x) => x.staffId), ...seen.map((x) => x.staffId!)]);
      for (const s of staff) {
        if (here.has(s.id) || done.has(s.id) || new Date(`${today}T12:00:00Z`).getUTCDay() === s.offDay) continue;
        await raiseAlert(this.prisma, 'staff', `👷 ${s.name} لسه ما جاش (دلوقتي ${hmCairo(now)})`, null);
        done.add(s.id);
        alerts++;
      }
      if (alerts) await this.putState({ alerted: { day: today, ids: [...done] } });
    }

    // cleanup
    await this.prisma.sighting.deleteMany({ where: { at: { lt: new Date(now.getTime() - KEEP_SIGHTINGS_DAYS * 86_400_000) } } });
    await this.prisma.sighting.deleteMany({ where: { staffId: null, createdAt: { lt: new Date(now.getTime() - KEEP_UNKNOWN_DAYS * 86_400_000) } } });
    return { outs, alerts };
  }
}
