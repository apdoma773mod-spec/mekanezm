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
  return { day: snap.day, madeAt: snap.madeAt };
}

/** Makes sure today has a copy; used on a timer by the server. */
export async function ensureToday(db: PrismaClient): Promise<boolean> {
  const today = dayOf(new Date());
  const have = await db.backup.findUnique({ where: { day: today }, select: { day: true } });
  if (have) return false;
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
