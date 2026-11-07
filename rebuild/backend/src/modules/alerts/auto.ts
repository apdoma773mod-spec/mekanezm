import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { alertConfig, ALERT_BY, n2 } from '../../lib/alerts.js';
import { addDays, dayToDate, todayYmd } from '../../lib/dates.js';
import { parse } from '../../lib/validate.js';
import { num } from '../../lib/money.js';

/**
 * 🤖 رسائل تلقائية: (١) ملخص العمال أول كل شهر — للمدير بس. (٢) تحصيل أسبوعي للعملاء اللي عليهم فلوس.
 * (٣) رسائل لعميل الأونلاين مع خطوات الشحنة. التانيين بيروحوا لعملاء، فهم مقفولين لحد ما المدير يفتحهم.
 * كلها بتتحط في طابور الواتساب (OutboundMessage) زي باقي التنبيهات.
 */
export const AUTO_KEY = 'auto_msgs';
export interface AutoConfig {
  staffMonthly: { on: boolean; last?: string };
  debtsWeekly: { on: boolean; day: number; time: string; minDays: number; minAmount: number; last?: string };
  onlineStatus: { on: boolean };
}
export const AUTO_DEFAULT: AutoConfig = {
  staffMonthly: { on: true },
  debtsWeekly: { on: false, day: 6, time: '11:00', minDays: 14, minAmount: 0 },
  onlineStatus: { on: false },
};

export async function readAuto(db: PrismaClient): Promise<AutoConfig> {
  const v = ((await db.setting.findUnique({ where: { key: AUTO_KEY } }))?.value ?? {}) as Partial<AutoConfig>;
  return {
    staffMonthly: { ...AUTO_DEFAULT.staffMonthly, ...v.staffMonthly },
    debtsWeekly: { ...AUTO_DEFAULT.debtsWeekly, ...v.debtsWeekly },
    onlineStatus: { ...AUTO_DEFAULT.onlineStatus, ...v.onlineStatus },
  };
}
const writeAuto = (db: PrismaClient, c: AutoConfig) => db.setting.upsert({ where: { key: AUTO_KEY }, create: { key: AUTO_KEY, value: c as never }, update: { value: c as never } });

const cairo = (now: Date) => ({
  hm: new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
  ymd: todayYmd(now),
});
const dayOfWeek = (ymd: string) => dayToDate(ymd).getUTCDay(); // 0 = Sunday … 6 = Saturday
const AR_M = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const phoneOf = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.startsWith('0') ? `2${d}` : d;
};
const queue = (db: PrismaClient, to: string, body: string) => db.outboundMessage.create({ data: { toPhone: to, body, byName: ALERT_BY } });

/** ملخص الشهر اللي فات لكل عامل: حضور، تأخير، سلف، ومبيعاته لو له حساب على السيستم. */
export async function staffMonthlyText(db: PrismaClient, month: string): Promise<string | null> {
  const first = `${month}-01`;
  const last = addDays(`${addMonth(month)}-01`, -1);
  const staff = await db.staff.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  if (!staff.length) return null;
  const [att, moves, sales] = await Promise.all([
    db.attendance.findMany({ where: { day: { gte: dayToDate(first), lte: dayToDate(last) } } }),
    db.staffMove.findMany({ where: { month, kind: 'advance' } }),
    db.invoice.groupBy({ by: ['createdById'], where: { kind: 'SALE', status: 'ACTIVE', date: { gte: dayToDate(first), lte: dayToDate(last) } }, _sum: { total: true }, _count: true }),
  ]);
  const lines = staff.map((s) => {
    const a = att.filter((x) => x.staffId === s.id && x.inAt);
    const late = a.filter((x) => x.lateMin > 10);
    const adv = moves.filter((m) => m.staffId === s.id).reduce((t, m) => t + num(m.amount), 0);
    const sold = s.userId ? sales.find((x) => x.createdById === s.userId) : undefined;
    return (
      `👷 ${s.name}: حضر ${a.length} يوم` +
      (late.length ? ` — اتأخر ${late.length} مرة (${late.reduce((t, x) => t + x.lateMin, 0)} دقيقة)` : ' — ولا تأخير') +
      (adv ? ` — سلف ${n2(adv)}` : '') +
      (sold ? ` — باع ${sold._count} فاتورة بـ ${n2(num(sold._sum.total))}` : '')
    );
  });
  const [y, m] = month.split('-').map(Number);
  return `📅 ملخص العمال — ${AR_M[m! - 1]} ${y}\n\n${lines.join('\n')}`;
}
function addMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`;
}

/** Called every few minutes by the server. */
export async function autoTick(db: PrismaClient, now = new Date()): Promise<void> {
  const c = await readAuto(db);
  const { hm, ymd } = cairo(now);
  let changed = false;

  // (١) first days of the month, after 9:00: last month's summary, once
  const thisMonth = ymd.slice(0, 7);
  const prev = addMonth(thisMonth) && (() => { const [y, m] = thisMonth.split('-').map(Number); return m === 1 ? `${y! - 1}-12` : `${y}-${String(m! - 1).padStart(2, '0')}`; })();
  if (c.staffMonthly.on && hm >= '09:00' && c.staffMonthly.last !== prev) {
    const text = await staffMonthlyText(db, prev);
    if (text) for (const to of (await alertConfig(db)).to) await queue(db, to, text);
    c.staffMonthly.last = prev;
    changed = true;
  }

  // (٢) every week on the chosen day/time: a reminder to customers owing money for a while
  const w = c.debtsWeekly;
  if (w.on && dayOfWeek(ymd) === w.day && hm >= w.time && w.last !== ymd) {
    const sent = await sendDebtReminders(db, w.minDays, w.minAmount);
    w.last = ymd;
    changed = true;
    if (sent) for (const to of (await alertConfig(db)).to) await queue(db, to, `💰 اتبعت تحصيل أسبوعي لـ ${sent} عميل عليهم فلوس.`);
  }
  if (changed) await writeAuto(db, c);
}

async function sendDebtReminders(db: PrismaClient, minDays: number, minAmount: number): Promise<number> {
  const tpl = ((await db.setting.findUnique({ where: { key: 'debt_template' } }))?.value as { text?: string } | undefined)?.text;
  const shop = ((await db.setting.findUnique({ where: { key: 'store' } }))?.value as { name?: string } | undefined)?.name || 'ميكانيزم';
  const cutoff = addDays(todayYmd(), -minDays);
  const owing = await db.contact.findMany({ where: { type: 'CUSTOMER', deletedAt: null, balance: { gt: Math.max(0.01, minAmount) }, phone: { not: '' } } });
  let n = 0;
  for (const c of owing) {
    // owed for at least `minDays`: the oldest open credit invoice is older than the cutoff (or the debt has no invoice = opening balance)
    const oldest = await db.invoice.findFirst({ where: { kind: 'SALE', status: 'ACTIVE', contactId: c.id, remaining: { gt: 0 } }, orderBy: { date: 'asc' }, select: { date: true } });
    if (oldest && oldest.date > dayToDate(cutoff)) continue;
    const body = (tpl || 'السلام عليكم {الاسم} 🌷\nبنفكّرك بحسابك عندنا في {المحل}: {المبلغ}{من}. لو سددت بلاش تزعل من الرسالة 🙏')
      .replace(/\{الاسم\}/g, c.name)
      .replace(/\{المحل\}/g, shop)
      .replace(/\{المبلغ\}/g, `${n2(num(c.balance))} جنيه`)
      .replace(/\{من\}/g, '');
    await queue(db, phoneOf(c.phone), body);
    n++;
  }
  return n;
}

/** (٣) A shipment of an online customer moved on: tell the customer (only when the owner switched it on). */
export async function onlineShipmentMessage(db: PrismaClient, ship: { status: string; phone: string; name: string; tracking: string; carrier: string; invoiceId: string | null }): Promise<void> {
  try {
    if (!ship.phone || !ship.invoiceId) return;
    const text: Record<string, string> = {
      handed: `طلبك اتجهّز وسلّمناه لـ${ship.carrier ? ` ${ship.carrier}` : ' شركة الشحن'} 📦${ship.tracking ? `\nرقم التتبع: ${ship.tracking}` : ''}`,
      out: 'طلبك خرج للتوصيل دلوقتي 🚚 — ياريت تبقى متاح على التليفون.',
      delivered: 'طلبك وصل ✅ شكراً لثقتك فينا، ولو فيه أي ملاحظة كلمنا.',
    };
    const t = text[ship.status];
    if (!t || !(await readAuto(db)).onlineStatus.on) return;
    const inv = await db.invoice.findUnique({ where: { id: ship.invoiceId }, select: { online: true } });
    if (!inv?.online) return;
    await queue(db, phoneOf(ship.phone), `أهلاً ${ship.name} 🌷\n${t}`);
  } catch {
    /* a message never breaks the shipment */
  }
}

export default async function autoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAdmin);
  app.get('/', async () => ({ config: await readAuto(app.prisma) }));
  app.put('/', async (request) => {
    const b = parse(
      z.object({
        staffMonthly: z.object({ on: z.boolean() }),
        debtsWeekly: z.object({ on: z.boolean(), day: z.number().int().min(0).max(6), time: z.string().regex(/^\d{2}:\d{2}$/), minDays: z.number().int().min(1).max(365), minAmount: z.number().min(0) }),
        onlineStatus: z.object({ on: z.boolean() }),
      }),
      request.body,
    );
    const cur = await readAuto(app.prisma);
    const next: AutoConfig = { staffMonthly: { ...cur.staffMonthly, ...b.staffMonthly }, debtsWeekly: { ...cur.debtsWeekly, ...b.debtsWeekly }, onlineStatus: b.onlineStatus };
    await writeAuto(app.prisma, next);
    return { config: next };
  });
  /** «ابعتلي ملخص الشهر اللي فات دلوقتي» (to the owner only). */
  app.post('/staff-summary', async () => {
    const [y, m] = todayYmd().slice(0, 7).split('-').map(Number);
    const prev = m === 1 ? `${y! - 1}-12` : `${y}-${String(m! - 1).padStart(2, '0')}`;
    const text = await staffMonthlyText(app.prisma, prev);
    if (!text) return { sent: 0 };
    const to = (await alertConfig(app.prisma)).to;
    for (const t of to) await queue(app.prisma, t, text);
    return { sent: to.length, text };
  });
}
