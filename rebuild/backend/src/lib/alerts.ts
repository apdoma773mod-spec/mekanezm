import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * 🔔 تنبيهات فورية ضد السرقة والغلط (mk_alert القديمة): الإعدادات في Setting `alerts`،
 * والتنبيه بيتحط في طابور الواتساب (OutboundMessage) باسم «🔔 تنبيه تلقائي» والجسر بيبعته من رقم المحل.
 */
export const ALERT_BY = '🔔 تنبيه تلقائي';
export const DEFAULT_TO = ['201119199659'];

export const ALERT_TYPES = [
  ['void', '🗑️ فاتورة اتلغت'],
  ['below', '⚠️ بيع بأقل من سعر الشراء'],
  ['disc', '🏷️ خصم كبير على صنف'],
  ['adjust', '📦 تعديل رصيد صنف يدوي'],
  ['short', '💵 عجز أو زيادة في الدرج عند التقفيل'],
  ['edit', '✏️ فاتورة اتعدلت بعد ما اتسجلت'],
  ['count', '🧮 الجرد اليومي فيه فرق'],
  ['pay', '💸 دفعة أو تحصيل اتمسح'],
  ['gift', '🎁 هدية اتصرفت لصنايعي'],
  ['staff', '👷 حضور وانصراف الموظفين والتأخير'],
] as const;

export interface AlertConfig {
  on: boolean;
  to: string[];
  disc: number;
  short: number;
  skip_admin: boolean;
  types: Record<string, boolean>;
}

type Db = PrismaClient | Prisma.TransactionClient;

export const n2 = (n: number | string | Prisma.Decimal | null | undefined) => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
};

export async function alertConfig(db: Db): Promise<AlertConfig> {
  const s = await db.setting.findUnique({ where: { key: 'alerts' } });
  const v = (s?.value ?? {}) as Partial<AlertConfig>;
  return {
    on: v.on !== false,
    to: Array.isArray(v.to) && v.to.length ? v.to.map(String) : DEFAULT_TO,
    disc: Number(v.disc) || 15,
    short: Number(v.short) || 50,
    skip_admin: v.skip_admin !== false,
    types: v.types && typeof v.types === 'object' ? v.types : {},
  };
}

const cairoStamp = () => {
  const d = new Date();
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d).replace(/-/g, '/');
  return `${hm} — ${ymd}`;
};

export async function userName(db: Db, id: string | null | undefined): Promise<string> {
  if (!id) return '';
  return (await db.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? '';
}

/** Queues one WhatsApp message per number. Never throws: an alert must not stop the shop's work. */
export async function raiseAlert(db: Db, type: string, text: string, actor?: { role?: string } | null): Promise<void> {
  try {
    const c = await alertConfig(db);
    if (!c.on || c.types[type] === false) return;
    if (c.skip_admin && actor?.role === 'ADMIN') return;
    const body = `🔔 تنبيه من السيستم\n${text}\n🕒 ${cairoStamp()}`;
    for (const to of c.to) await db.outboundMessage.create({ data: { toPhone: to, body, byName: ALERT_BY } });
  } catch {
    /* ignore */
  }
}
