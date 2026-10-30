import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { PrismaClient } from '@prisma/client';

/**
 * 💾 النسخ الاحتياطية: نسخة كل يوم (أول ما السيستم يفضل شغال) + آخر ٣١ يوم.
 * بتتاخد كل الجداول ماعدا: كلمات السر والجلسات (مايتحفظوش في ملف بره). الاسترجاع بيتم بعلم المطوّر، زي القديم.
 */
export const BACKUP_TABLES = [
  'Product', 'StockMove', 'Contact', 'Invoice', 'InvoiceItem', 'Payment', 'Return', 'Expense', 'DaybookEntry',
  'DayClosing', 'StockCount', 'Quote', 'Shipment', 'Gift', 'Staff', 'Attendance', 'StaffMove', 'StaffPoint', 'PunchCode',
  'Kit', 'Sample', 'WantedItem', 'Partner', 'PartnerMove', 'Vehicle', 'VehicleLog', 'FieldOrder', 'VanStock', 'VanMove',
  'VanClose', 'Contract', 'OutboundMessage', 'SmsIn', 'WaOrder', 'WaPhoto', 'Setting', 'Counter', 'AuditLog',
] as const;

const KEEP_DAYS = 31;

export interface Snapshot {
  format: 'mekanizm-backup';
  version: 1;
  day: string;
  madeAt: string;
  tables: Record<string, unknown[]>;
}

/** Local day as YYYY-MM-DD (the shop's day, not UTC). */
export function dayOf(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export async function takeSnapshot(db: PrismaClient): Promise<Snapshot> {
  const now = new Date();
  const tables: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLES) {
    // Prisma delegates are named after the model with a lowercase first letter.
    const delegate = (db as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[name.charAt(0).toLowerCase() + name.slice(1)];
    tables[name] = await delegate.findMany();
  }
  return { format: 'mekanizm-backup', version: 1, day: dayOf(now), madeAt: now.toISOString(), tables };
}

/** Saves today's copy (replaces today's if one was made already) and removes copies older than KEEP_DAYS. */
export async function saveToday(db: PrismaClient): Promise<{ day: string; madeAt: string }> {
  const snap = await takeSnapshot(db);
  await db.backup.upsert({
    where: { day: snap.day },
    create: { day: snap.day, data: snap as unknown as object },
    update: { data: snap as unknown as object, madeAt: new Date(snap.madeAt) },
  });
  const cutoff = dayOf(new Date(Date.now() - KEEP_DAYS * 864e5));
  await db.backup.deleteMany({ where: { day: { lt: cutoff } } });
  await copyOut(db, snap);
  return { day: snap.day, madeAt: snap.madeAt };
}

/* ---- نسخة تانية بره قاعدة البيانات (فلاشة / جوجل درايف / هارد تاني): ملف مضغوط كل يوم، آخر ٣١ يوم ---- */
export const COPY_KEY = 'backup_copy';
export interface CopyState {
  dir: string;
  lastAt?: string;
  lastFile?: string;
  lastError?: string;
}
export async function readCopy(db: PrismaClient): Promise<CopyState> {
  const row = await db.setting.findUnique({ where: { key: COPY_KEY } });
  return { dir: '', ...((row?.value as Partial<CopyState> | null) ?? {}) };
}
async function writeCopy(db: PrismaClient, v: CopyState) {
  await db.setting.upsert({ where: { key: COPY_KEY }, create: { key: COPY_KEY, value: v as never }, update: { value: v as never } });
}
const fileOf = (day: string) => `mekanizm-backup-${day}.json.gz`;

/** Writes today's snapshot into the chosen folder; a failure is remembered and shown, never thrown (the DB copy is already safe). */
export async function copyOut(db: PrismaClient, snap: Snapshot): Promise<CopyState> {
  const st = await readCopy(db);
  if (!st.dir) return st;
  try {
    await fs.mkdir(st.dir, { recursive: true });
    const name = fileOf(snap.day);
    await fs.writeFile(path.join(st.dir, name + '.tmp'), gzipSync(JSON.stringify(snap)));
    await fs.rename(path.join(st.dir, name + '.tmp'), path.join(st.dir, name));
    const cutoff = dayOf(new Date(Date.now() - KEEP_DAYS * 864e5));
    for (const f of await fs.readdir(st.dir)) {
      const m = f.match(/^mekanizm-backup-(d{4}-d{2}-d{2}).json.gz$/);
      if (m && m[1]! < cutoff) await fs.rm(path.join(st.dir, f), { force: true });
    }
    const ok = { ...st, lastAt: new Date().toISOString(), lastFile: name, lastError: '' };
    await writeCopy(db, ok);
    return ok;
  } catch (e) {
    const bad = { ...st, lastError: String((e as Error).message || e).slice(0, 200) };
    await writeCopy(db, bad);
    return bad;
  }
}

/** Is today's file already in the folder? (checked on every timer tick, so a flash drive plugged in later still gets today's copy) */
async function copyMissing(db: PrismaClient): Promise<boolean> {
  const st = await readCopy(db);
  if (!st.dir) return false;
  try {
    await fs.access(path.join(st.dir, fileOf(dayOf(new Date()))));
    return false;
  } catch {
    return true;
  }
}

/** Makes sure today has a copy; used on a timer by the server. */
export async function ensureToday(db: PrismaClient): Promise<boolean> {
  const today = dayOf(new Date());
  const have = await db.backup.findUnique({ where: { day: today } });
  if (have) {
    if (await copyMissing(db)) await copyOut(db, have.data as unknown as Snapshot);
    return false;
  }
  await saveToday(db);
  return true;
}

/** Counts per table of a backup file, to show before anyone restores it. */
export function describeBackup(data: unknown): { ok: boolean; reason?: string; day?: string; tables?: Record<string, number> } {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'مش ملف نسخة' };
  const s = data as Partial<Snapshot>;
  if (s.format !== 'mekanizm-backup' || !s.tables || typeof s.tables !== 'object') return { ok: false, reason: 'مش ملف نسخة ميكانيزم' };
  const tables: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.tables)) tables[k] = Array.isArray(v) ? v.length : 0;
  return { ok: true, day: s.day, tables };
}
