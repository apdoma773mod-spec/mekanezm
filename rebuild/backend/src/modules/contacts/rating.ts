import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { notFound } from '../../lib/errors.js';
import { dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';

/**
 * ⭐ تقييم العميل حسب التزامه بالدفع. القاعدة (مكتوبة هنا عشان تتعدّل بسهولة):
 *  - مفيش بيع بالآجل عليه خالص → ٥ نجوم «بيدفع كاش»
 *  - عليه فلوس: عدد الأيام من أقدم فاتورة آجل لسه مفتوحة: ≤١٤ يوم ٥، ≤٣٠ يوم ٤، ≤٦٠ يوم ٣، ≤٩٠ يوم ٢، أكتر من كده ١
 *  - اتأخر قبل كده وسدّد: لو عنده ٣ فواتير آجل على الأقل واتقفلت كلها، ٥ نجوم حتى لو عليه فاتورة جديدة (≤٣٠ يوم)
 */
export interface Rating {
  stars: number;
  label: string;
  days: number | null;
  balance: number;
  creditInvoices: number;
  closedInvoices: number;
  isNew: boolean;
}

export async function ratingOf(db: PrismaClient, contactId: string): Promise<Rating> {
  const c = await db.contact.findFirst({ where: { id: contactId, deletedAt: null } });
  if (!c) throw notFound('العميل مش موجود');
  const credit = await db.invoice.findMany({
    where: { kind: 'SALE', status: 'ACTIVE', contactId, remaining: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  // every sale that was ever on credit (still open, or paid later) — the invoice keeps `remaining` only while open,
  // so closed ones are counted through the payments received
  const [all, pays] = await Promise.all([
    db.invoice.count({ where: { kind: 'SALE', status: 'ACTIVE', contactId } }),
    db.payment.count({ where: { contactId, direction: 'IN', cancelledAt: null } }),
  ]);
  const bal = num(c.balance);
  const open = credit.length;
  const closed = Math.min(pays, Math.max(0, all - open));
  const days = credit[0] ? Math.max(0, Math.round((dayToDate(todayYmd()).getTime() - dayToDate(dateToDay(credit[0].date)).getTime()) / 864e5)) : null;
  const base = { days, balance: bal, creditInvoices: open + closed, closedInvoices: closed, isNew: all === 0 };
  if (all === 0) return { ...base, stars: 3, label: 'عميل جديد — لسه ماعاملتوش' };
  if (bal <= 0.009 && open === 0) return { ...base, stars: 5, label: pays ? 'بيسدّد في ميعاده' : 'بيدفع كاش' };
  const d = days ?? 0;
  let stars = d <= 14 ? 5 : d <= 30 ? 4 : d <= 60 ? 3 : d <= 90 ? 2 : 1;
  if (closed >= 3 && d <= 30) stars = 5;
  const label = stars >= 5 ? 'ملتزم' : stars === 4 ? 'كويس — عليه فلوس من فترة قصيرة' : stars === 3 ? 'بيتأخر — عليه فلوس من أكتر من شهر' : stars === 2 ? 'بيتأخر كتير — من أكتر من شهرين' : 'خطر — عليه فلوس من أكتر من 3 شهور';
  return { ...base, stars, label };
}

export default async function ratingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.get('/:id', async (request) => {
    const { id } = parse(z.object({ id: z.string().max(64) }), request.params);
    return { rating: await ratingOf(app.prisma, id) };
  });
}
