import { randomBytes } from 'node:crypto';
import type { Attendance, PrismaClient, Staff, StaffMove, StaffPoint } from '@prisma/client';
import {
  DEFAULT_POINTS,
  type AttendanceDto,
  type AttendanceManualInput,
  type PointsBoard,
  type PointsConfig,
  type PunchResult,
  type StaffConfig,
  type StaffDto,
  type StaffInput,
  type StaffMonth,
  type StaffMoveDto,
  type StaffMoveInput,
  type StaffPointDto,
} from '@mk/shared';
import { isAdmin, type Actor } from '../../lib/actor.js';
import { raiseAlert } from '../../lib/alerts.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { withTx } from '../../lib/tx.js';

const CFG_KEY = 'staff';
const PTS_KEY = 'staff_points';
const PUNCH_TTL_MS = 90_000;

/** Hours and minutes in Cairo for a moment. */
const cairoHm = (d: Date) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number);
  return h! * 60 + m!;
};
const hmCairo = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** A Cairo wall-clock time on a day as a UTC instant (Egypt is UTC+2 or +3 in summer). */
function cairoInstant(day: string, hhmm: string): Date {
  const guess = new Date(`${day}T${hhmm}:00Z`);
  const offset = cairoHm(guess) - toMin(hhmm);
  const fix = ((offset % 1440) + 1440) % 1440;
  return new Date(guess.getTime() - (fix > 720 ? fix - 1440 : fix) * 60_000);
}
const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: dayToDate(`${month}-01`), to: dayToDate(`${month}-${String(last).padStart(2, '0')}`), last };
};

const staffDto = (s: Staff): StaffDto => ({
  id: s.id,
  name: s.name,
  job: s.job,
  phone: s.phone,
  nid: s.nid,
  address: s.address,
  payType: s.payType as StaffDto['payType'],
  salary: num(s.salary),
  shiftStart: s.shiftStart,
  shiftEnd: s.shiftEnd,
  offDay: s.offDay,
  startDate: dateToDay(s.startDate),
  userId: s.userId,
  note: s.note,
  active: s.active,
});
const attDto = (a: Attendance): AttendanceDto => ({
  id: a.id,
  staffId: a.staffId,
  day: dateToDay(a.day),
  inAt: a.inAt?.toISOString() ?? null,
  outAt: a.outAt?.toISOString() ?? null,
  lateMin: a.lateMin,
  method: a.method === 'manual' ? 'manual' : 'qr',
  note: a.note,
});
const moveDto = (m: StaffMove): StaffMoveDto => ({
  id: m.id,
  staffId: m.staffId,
  kind: m.kind as StaffMoveDto['kind'],
  amount: num(m.amount),
  month: m.month,
  note: m.note,
  createdAt: m.createdAt.toISOString(),
});
const pointDto = (p: StaffPoint): StaffPointDto => ({
  id: p.id,
  staffId: p.staffId,
  pts: p.pts,
  why: p.why,
  month: p.month,
  redeem: p.redeem,
  byName: p.byName,
  createdAt: p.createdAt.toISOString(),
});

/** «👷 العمالة والمرتبات» + «حضوري» + «⭐ نقاط العمال». */
export class StaffService {
  constructor(private readonly prisma: PrismaClient) {}

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    return s?.value ? ({ ...fallback, ...(s.value as object) } as T) : fallback;
  }
  private async putSetting(key: string, value: object, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key }, create: { key, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: key, ip: actor.ip });
    });
  }

  async month(month: string, actor: Actor): Promise<StaffMonth> {
    const { from, to } = monthRange(month);
    const admin = isAdmin(actor);
    const staff = await this.prisma.staff.findMany({ where: admin ? {} : { userId: actor.id }, orderBy: { createdAt: 'asc' } });
    const ids = staff.map((s) => s.id);
    const [att, moves, config, members] = await Promise.all([
      this.prisma.attendance.findMany({ where: { staffId: { in: ids }, day: { gte: from, lte: to } }, orderBy: { day: 'asc' } }),
      this.prisma.staffMove.findMany({ where: { staffId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 2000 }),
      admin ? this.setting<StaffConfig>(CFG_KEY, { absent: true, late: 0 }) : null,
      admin ? this.prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }) : null,
    ]);
    return {
      month,
      staff: staff.map(staffDto),
      attendance: att.map(attDto),
      moves: moves.map(moveDto),
      ...(config ? { config } : {}),
      ...(members ? { members } : {}),
    };
  }

  async save(id: string | null, input: StaffInput, actor: Actor): Promise<StaffDto> {
    if (input.userId) {
      const other = await this.prisma.staff.findFirst({ where: { userId: input.userId, ...(id ? { id: { not: id } } : {}) } });
      if (other) throw conflict('الحساب ده مربوط بموظف تاني', [{ path: 'userId', message: 'مربوط بموظف تاني' }]);
    }
    const data = { ...input, salary: money(input.salary), startDate: dayToDate(input.startDate ?? todayYmd()) };
    const s = await withTx(this.prisma, async (tx) => {
      if (id && !(await tx.staff.findUnique({ where: { id } }))) throw notFound('الموظف ده مش موجود');
      const row = id ? await tx.staff.update({ where: { id }, data }) : await tx.staff.create({ data });
      await writeAudit(tx, { userId: actor.id, action: 'STAFF_SAVE', entity: 'Staff', entityId: row.id, after: { name: row.name, active: row.active }, ip: actor.ip });
      return row;
    });
    return staffDto(s);
  }

  async manual(input: AttendanceManualInput, actor: Actor): Promise<AttendanceDto> {
    const s = await this.prisma.staff.findUnique({ where: { id: input.staffId } });
    if (!s) throw notFound('الموظف ده مش موجود');
    const by = await actorName(this.prisma, actor);
    const late = Math.max(0, toMin(input.inTime) - toMin(s.shiftStart));
    const data = {
      inAt: cairoInstant(input.day, input.inTime),
      outAt: input.outTime ? cairoInstant(input.day, input.outTime) : null,
      lateMin: late > 600 ? 0 : late,
      method: 'manual',
      note: input.note,
      byName: by,
    };
    const a = await withTx(this.prisma, async (tx) => {
      const row = await tx.attendance.upsert({
        where: { staffId_day: { staffId: s.id, day: dayToDate(input.day) } },
        create: { staffId: s.id, day: dayToDate(input.day), ...data },
        update: data,
      });
      await writeAudit(tx, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: s.id, after: { day: input.day, in: input.inTime, out: input.outTime ?? null }, ip: actor.ip });
      return row;
    });
    return attDto(a);
  }

  /** Advances and pay go into expenses too, so the drawer closes right (as the old mk_staff_advance / mk_staff_pay). */
  async move(staffId: string, input: StaffMoveInput, actor: Actor): Promise<StaffMoveDto> {
    const s = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!s) throw notFound('الموظف ده مش موجود');
    const by = await actorName(this.prisma, actor);
    const m = await withTx(this.prisma, async (tx) => {
      let expenseId: string | null = null;
      if (input.kind === 'advance' || input.kind === 'pay') {
        const e = await tx.expense.create({
          data: {
            category: input.kind === 'advance' ? 'سلف' : 'مرتبات',
            amount: money(input.amount),
            date: dayToDate(todayYmd()),
            note: `${input.kind === 'advance' ? 'سلفة' : 'مرتب'} ${s.name} — ${input.month}${input.note ? ` — ${input.note}` : ''}`,
            createdById: actor.id,
          },
        });
        expenseId = e.id;
      }
      const row = await tx.staffMove.create({
        data: { staffId, kind: input.kind, amount: money(input.amount), month: input.month, note: input.note, expenseId, createdById: actor.id, byName: by },
      });
      await writeAudit(tx, { userId: actor.id, action: 'STAFF_MOVE', entity: 'Staff', entityId: staffId, after: { kind: input.kind, amount: input.amount, month: input.month }, ip: actor.ip });
      return row;
    });
    return moveDto(m);
  }

  async saveConfig(cfg: StaffConfig, actor: Actor) {
    await this.putSetting(CFG_KEY, cfg, actor);
    return cfg;
  }

  /** A fresh code for the attendance screen's QR. */
  async punchCode(): Promise<{ code: string; expiresAt: string }> {
    const code = randomBytes(12).toString('hex');
    const expiresAt = new Date(Date.now() + PUNCH_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.punchCode.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      this.prisma.punchCode.create({ data: { code, expiresAt } }),
    ]);
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /** The employee scanned the shop's QR: first scan of the day is «حضور», the second «انصراف». */
  async punch(code: string, actor: Actor): Promise<PunchResult> {
    const c = await this.prisma.punchCode.findUnique({ where: { code } });
    if (!c || c.expiresAt < new Date()) throw badRequest('الكود قديم — صوّر الكود اللي على الشاشة تاني');
    const s = await this.prisma.staff.findUnique({ where: { userId: actor.id } });
    if (!s || !s.active) throw badRequest('حسابك لسه مش مربوط بملف موظف — كلم صاحب المحل.');
    const now = new Date();
    const day = dayToDate(todayYmd(now));
    return withTx(this.prisma, async (tx) => {
      const a = await tx.attendance.findUnique({ where: { staffId_day: { staffId: s.id, day } } });
      if (!a) {
        const late = Math.max(0, cairoHm(now) - toMin(s.shiftStart));
        await tx.attendance.create({ data: { staffId: s.id, day, inAt: now, lateMin: late > 600 ? 0 : late, method: 'qr', byName: s.name } });
        await writeAudit(tx, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: s.id, after: { in: now.toISOString() }, ip: actor.ip });
        const lm = late > 600 ? 0 : late;
        // 🔔 «حضور وانصراف الموظفين والتأخير»: the owner gets it on WhatsApp; late counts after 10 minutes, as the old screen says
        await raiseAlert(tx, 'staff', `👷 ${s.name} حضر الساعة ${hmCairo(now)}${lm > 10 ? ` — متأخر ${lm} دقيقة` : ''}`, actor);
        return { kind: 'in' as const, name: s.name, at: now.toISOString(), late: lm };
      }
      if (a.outAt) throw badRequest('اتسجل حضورك وانصرافك النهارده خلاص');
      await tx.attendance.update({ where: { id: a.id }, data: { outAt: now } });
      await writeAudit(tx, { userId: actor.id, action: 'ATTENDANCE_SAVE', entity: 'Staff', entityId: s.id, after: { out: now.toISOString() }, ip: actor.ip });
      await raiseAlert(tx, 'staff', `👷 ${s.name} انصرف الساعة ${hmCairo(now)}`, actor);
      return { kind: 'out' as const, name: s.name, at: now.toISOString(), late: a.lateMin };
    });
  }

  /** Who punched today, for the big attendance screen. */
  async today() {
    const rows = await this.prisma.attendance.findMany({ where: { day: dayToDate(todayYmd()) }, include: { staff: { select: { name: true } } }, orderBy: { inAt: 'asc' } });
    return rows.map((r) => ({ name: r.staff.name, inAt: r.inAt?.toISOString() ?? null, outAt: r.outAt?.toISOString() ?? null }));
  }

  // ---------- ⭐ points ----------

  async pointsConfig(): Promise<PointsConfig> {
    const s = await this.prisma.setting.findUnique({ where: { key: PTS_KEY } });
    const v = (s?.value ?? {}) as Partial<PointsConfig>;
    return { rules: { ...DEFAULT_POINTS.rules, ...(v.rules ?? {}) }, reasons: v.reasons ?? DEFAULT_POINTS.reasons, rewards: v.rewards ?? DEFAULT_POINTS.rewards };
  }

  async savePointsConfig(cfg: PointsConfig, actor: Actor) {
    await this.putSetting(PTS_KEY, cfg, actor);
    return cfg;
  }

  async board(month: string): Promise<PointsBoard> {
    const { from, to, last } = monthRange(month);
    const [config, staff, logAll] = await Promise.all([
      this.pointsConfig(),
      this.prisma.staff.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.staffPoint.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    const att = await this.prisma.attendance.findMany({ where: { staffId: { in: staff.map((s) => s.id) }, day: { gte: from, lte: to }, inAt: { not: null } } });
    const R = config.rules;
    const today = todayYmd();
    const rows = staff.map((s) => {
      const A = att.filter((a) => a.staffId === s.id);
      const on = A.filter((a) => a.lateMin <= R.lateMin).length;
      const late = A.length - on;
      const have = new Set(A.map((a) => dateToDay(a.day)));
      let abs = 0;
      let work = 0;
      for (let d = 1; d <= last; d++) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        if (iso >= today || iso < dateToDay(s.startDate)) continue;
        if (new Date(`${iso}T12:00:00Z`).getUTCDay() === s.offDay) continue;
        work++;
        if (!have.has(iso)) abs++;
      }
      const auto = on * R.ontime + late * R.late + abs * R.absent + (work >= 20 && !abs && !late ? R.fullMonth : 0);
      const mine = logAll.filter((l) => l.staffId === s.id);
      const man = mine.filter((l) => l.month === month).reduce((a, l) => a + l.pts, 0);
      const all = mine.reduce((a, l) => a + l.pts, 0);
      return { staff: staffDto(s), on, late, abs, auto, man, month: auto + man, balance: all + auto };
    });
    rows.sort((a, b) => b.month - a.month);
    return { month, config, rows, log: logAll.map(pointDto) };
  }

  async givePoints(staffId: string, input: { pts: number; why: string; redeem: boolean }, actor: Actor): Promise<StaffPointDto> {
    if (!(await this.prisma.staff.findUnique({ where: { id: staffId } }))) throw notFound('الموظف ده مش موجود');
    const by = await actorName(this.prisma, actor);
    const p = await withTx(this.prisma, async (tx) => {
      const row = await tx.staffPoint.create({
        data: { staffId, pts: input.pts, why: input.why || (input.pts > 0 ? 'مكافأة' : 'خصم'), month: todayYmd().slice(0, 7), redeem: input.redeem, createdById: actor.id, byName: by },
      });
      await writeAudit(tx, { userId: actor.id, action: 'STAFF_POINTS', entity: 'Staff', entityId: staffId, after: { pts: input.pts, why: row.why }, ip: actor.ip });
      return row;
    });
    return pointDto(p);
  }
}
