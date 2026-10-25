const SHOP_TZ = 'Africa/Cairo';
const DAY_MS = 24 * 60 * 60 * 1000;

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's business day in the shop's time zone, as YYYY-MM-DD. */
export function todayYmd(now = new Date()): string {
  return ymd.format(now);
}

/** A YYYY-MM-DD business day as the Date Prisma stores in a `@db.Date` column. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return dateToDay(new Date(dayToDate(day).getTime() + n * DAY_MS));
}

/** Inclusive day range filter for `@db.Date` columns; either end may be open. */
export function dayRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  return {
    ...(from ? { gte: dayToDate(from) } : {}),
    ...(to ? { lte: dayToDate(to) } : {}),
  };
}
