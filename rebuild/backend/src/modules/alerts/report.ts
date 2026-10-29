import type { Prisma, PrismaClient } from '@prisma/client';
import { addDays, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { ALERT_BY, alertConfig, n2 } from '../../lib/alerts.js';

const DOW = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);

/** 📊 تقرير آخر اليوم (mk_daily_report القديمة): نفس الأرقام والصياغة، بالمنطق على قاعدة البيانات الجديدة. */
export async function dailyReport(db: PrismaClient, day: string): Promise<string> {
  const date = dayToDate(day);
  const dayR = dayRange(day, day);
  const start = new Date(`${day}T00:00:00+02:00`);
  const end = new Date(start.getTime() + 86_400_000);
  const sales = await db.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', date }, include: { items: { select: { name: true, qty: true, total: true, unitCost: true, productId: true } } } });
  const sTot = sales.reduce((s, i) => s + num(i.total), 0);
  const sPaid = sales.reduce((s, i) => s + num(i.paid), 0);
  const sRem = sales.reduce((s, i) => s + num(i.remaining), 0);
  const sItems = sales.reduce((s, i) => s + i.items.reduce((a, it) => a + num(it.total), 0), 0);
  const sCost = sales.reduce((s, i) => s + i.items.reduce((a, it) => a + num(it.qty) * num(it.unitCost), 0), 0);
  const week = await db.invoice.aggregate({ where: { kind: 'SALE', status: 'ACTIVE', date: dayToDate(addDays(day, -7)) }, _sum: { total: true } });
  const wTot = num(week._sum.total);
  const pur = await db.invoice.aggregate({ where: { kind: 'PURCHASE', status: 'ACTIVE', date }, _sum: { total: true } });
  const pTot = num(pur._sum.total);
  const [payIn, payOut] = await Promise.all([
    db.payment.aggregate({ where: { direction: 'IN', cancelledAt: null, date }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { direction: 'OUT', cancelledAt: null, date }, _sum: { amount: true } }),
  ]);
  const pin = num(payIn._sum.amount);
  const pout = num(payOut._sum.amount);
  const exps = await db.expense.findMany({ where: { deletedAt: null, date: dayR }, select: { category: true, amount: true } });
  const exTot = exps.reduce((s, e) => s + num(e.amount), 0);
  const byCat = new Map<string, number>();
  exps.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + num(e.amount)));
  const exList = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, a]) => `${c} ${n2(a)} ج`).join('، ');
  const rets = await db.return.aggregate({ where: { kind: 'SALE', date }, _sum: { total: true } });
  const retTot = num(rets._sum.total);
  const voided = await db.invoice.count({ where: { status: 'VOID', voidedAt: { gte: start, lt: end } } });
  const gifts = await db.gift.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { qty: true, price: true } });
  const gVal = gifts.reduce((s, g) => s + num(g.qty) * num(g.price), 0);
  const att = await db.attendance.findMany({ where: { day: date, inAt: { not: null } }, include: { staff: { select: { name: true } } } });
  const late = att.filter((a) => a.lateMin > 10).map((a) => `${a.staff.name} ${a.lateMin}د`).join('، ');
  const topMap = new Map<string, number>();
  sales.forEach((i) => i.items.forEach((it) => topMap.set(it.name, (topMap.get(it.name) ?? 0) + num(it.qty))));
  const top = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q]) => `${n} (${n2(q)})`).join('، ');
  const low = Number((await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Product" WHERE "deletedAt" IS NULL AND qty > 0 AND qty <= "minQty"`)[0]?.n ?? 0);
  const soldIds = [...new Set(sales.flatMap((i) => i.items.map((it) => it.productId).filter((x): x is string => !!x)))];
  const outList = soldIds.length ? (await db.product.findMany({ where: { id: { in: soldIds }, deletedAt: null, qty: { lte: 0 } }, take: 8, select: { name: true } })).map((p) => p.name).join('، ') : '';
  const debt = num((await db.contact.aggregate({ where: { type: 'CUSTOMER', deletedAt: null, balance: { gt: 0 } }, _sum: { balance: true } }))._sum.balance);
  const dow = DOW[new Date(`${day}T12:00:00Z`).getUTCDay()];
  const r = [
    `📊 تقرير يوم ${day.slice(8, 10)}/${day.slice(5, 7)} — ${dow}`,
    '━━━━━━━━━━━━',
    `🛒 المبيعات: ${n2(sTot)} ج (${sales.length} فاتورة)${wTot > 0 ? ` ${sTot >= wTot ? '📈 +' : '📉 '}${n2(Math.round(((sTot - wTot) / wTot) * 100))}% عن نفس اليوم الأسبوع اللي فات` : ''}`,
    `💵 اتقبض كاش: ${n2(sPaid)} ج${sRem > 0 ? ` · آجل ${n2(sRem)} ج` : ''}`,
    `💰 المكسب التقريبي: ${n2(sItems - sCost)} ج${sItems > 0 ? ` (${n2(Math.round(((sItems - sCost) / sItems) * 100))}%)` : ''}`,
    ...(pin > 0 ? [`📥 تحصيلات من عملاء: ${n2(pin)} ج`] : []),
    ...(pTot > 0 ? [`📦 مشتريات: ${n2(pTot)} ج`] : []),
    ...(pout > 0 ? [`📤 سداد لموردين: ${n2(pout)} ج`] : []),
    ...(exTot > 0 ? [`🧾 مصروفات: ${n2(exTot)} ج${exList ? ` (${exList})` : ''}`] : []),
    ...(retTot > 0 ? [`↩️ مرتجعات: ${n2(retTot)} ج`] : []),
    `💼 صافي الدرج المتوقع: ${n2(sPaid + pin - pout - exTot - retTot)} ج`,
    ...(top ? ['━━━━━━━━━━━━', `🏆 الأكتر بيعاً: ${top}`] : []),
    ...(outList ? [`🚫 خلص النهارده: ${outList}`] : []),
    ...(low > 0 ? [`⚠️ ${low} صنف قرب يخلص`] : []),
    ...(gifts.length ? [`🎁 هدايا: ${gifts.length} (بقيمة ${n2(gVal)} ج)`] : []),
    ...(voided > 0 ? [`🗑️ فواتير اتلغت: ${voided}`] : []),
    ...(att.length > 0 || late ? [`👷 الحضور: ${att.length} موظف${late ? ` · متأخرين: ${late}` : ''}`] : []),
    ...(debt > 0 ? [`📒 فلوسك برّه عند العملاء: ${n2(debt)} ج`] : []),
    '━━━━━━━━━━━━',
    'تصبح على خير 🌙 — ميكانيزم',
  ];
  return r.join('\n');
}

export interface ReportConfig {
  on: boolean;
  time: string;
  last?: string;
}
export const REPORT_KEY = 'report';
export const readReportConfig = async (db: PrismaClient): Promise<ReportConfig> => {
  const v = ((await db.setting.findUnique({ where: { key: REPORT_KEY } }))?.value ?? {}) as Partial<ReportConfig>;
  return { on: v.on !== false, time: v.time || '23:30', ...(v.last ? { last: v.last } : {}) };
};

/** Cairo wall clock "HH:MM" and today's date, so the tick works whatever the server's timezone is. */
const cairoNow = (now: Date) => ({
  hm: new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now),
  ymd: todayYmd(now),
});

/** Called every few minutes: when the chosen time has come and today's report was not sent yet, queue it (mk_report_tick). */
export async function reportTick(db: PrismaClient, now = new Date()): Promise<string | null> {
  const c = await readReportConfig(db);
  if (!c.on) return null;
  const { hm, ymd } = cairoNow(now);
  let day: string;
  if (c.time >= '06:00') {
    if (hm >= c.time) day = ymd;
    else if (hm < '06:00') day = addDays(ymd, -1);
    else return null;
  } else if (hm >= c.time && hm < '12:00') day = addDays(ymd, -1);
  else return null;
  if (c.last === day) return null;
  const body = await dailyReport(db, day);
  const cfg = await alertConfig(db);
  for (const to of cfg.to) await db.outboundMessage.create({ data: { toPhone: to, body, byName: ALERT_BY } });
  await db.setting.upsert({ where: { key: REPORT_KEY }, create: { key: REPORT_KEY, value: { ...c, last: day } }, update: { value: { ...c, last: day } } });
  return day;
}
