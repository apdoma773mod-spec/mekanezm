import type { PrismaClient } from '@prisma/client';

/**
 * 📣 إعلانات واتساب للعملاء بضغطة واحدة.
 * الرسايل بتدخل صندوق الصادر (OutboundMessage) باسم «📣 إعلان:<رقم الدفعة>» والجسر اللي على جهاز المحل بيبعتها.
 * عشان رقم المحل ما يتحظرش من واتساب: الإعلانات بتتسحب واحدة واحدة بفاصل زمني (مع اختلاف بسيط) وبحد أقصى يومي،
 * أما رسايل التنبيهات والطباعة العادية فبتتسحب زي ما هي من غير أي تأخير.
 */
export const BC_PREFIX = '📣 إعلان:';
export const STOP_LINE = 'لو مش عايز توصلك رسايلنا ابعتلنا «إلغاء» وهنشيلك فوراً.';
export const OPTOUT_KEY = 'wa_optout';
export const HISTORY_KEY = 'wa_broadcasts';
export const LIMITS_KEY = 'wa_broadcast_limits';
export const DEFAULT_GAP_SEC = 25;
export const DEFAULT_DAILY = 200;
export const MAX_RECIPIENTS = 2000;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

/** كلمات الإلغاء (الرسالة كلها لازم تكون الكلمة دي بس عشان «إلغاء الطلب» ما يتفهمش غلط). */
export const OPTOUT_WORDS = ['إلغاء', 'الغاء', 'إلغاء الاشتراك', 'الغاء الاشتراك', 'إلغاء الإعلانات', 'الغاء الاعلانات', 'stop', 'unsubscribe'];
export const OPTOUT_RULE = { phrases: OPTOUT_WORDS, type: 'إلغاء إعلانات', scope: 'both', mode: 'exact', fuzzy: false, not: [] as string[], name: '', on: true };

const AR_DIGITS = /[٠-٩]/g;
const normDigits = (s: string) => s.replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

/** رقم موبايل مصري صالح بصيغة 01xxxxxxxxx، أو null. */
export function mobileOf(raw: string | null | undefined): string | null {
  let d = normDigits(String(raw ?? '')).replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(3);
  else if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}
export const last10 = (p: string) => normDigits(p).replace(/\D/g, '').slice(-10);

export function isOptoutText(text: string): boolean {
  const n = (s: string) => s.replace(/[ً-ٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/\s+/g, ' ').trim().toLowerCase();
  const t = n(text).replace(/[.!؟?،,]+$/g, '');
  return OPTOUT_WORDS.some((w) => n(w) === t);
}

export async function getOptout(db: PrismaClient): Promise<string[]> {
  const v = (await db.setting.findUnique({ where: { key: OPTOUT_KEY } }))?.value;
  return Array.isArray(v) ? (v as unknown[]).map(String) : [];
}
export async function setOptout(db: PrismaClient, list: string[]) {
  const value = [...new Set(list)];
  await db.setting.upsert({ where: { key: OPTOUT_KEY }, create: { key: OPTOUT_KEY, value }, update: { value } });
}

export interface BroadcastMeta {
  id: string;
  at: string;
  by: string;
  text: string;
  audience: string;
  total: number;
}
export async function getHistory(db: PrismaClient): Promise<BroadcastMeta[]> {
  const v = (await db.setting.findUnique({ where: { key: HISTORY_KEY } }))?.value;
  return Array.isArray(v) ? (v as unknown as BroadcastMeta[]) : [];
}

export async function getLimits(db: PrismaClient): Promise<{ gapSec: number; daily: number }> {
  const v = ((await db.setting.findUnique({ where: { key: LIMITS_KEY } }))?.value ?? {}) as { gapSec?: number; daily?: number };
  const gapSec = Number.isFinite(v.gapSec) && (v.gapSec as number) >= 5 ? (v.gapSec as number) : DEFAULT_GAP_SEC;
  const daily = Number.isFinite(v.daily) && (v.daily as number) >= 1 ? (v.daily as number) : DEFAULT_DAILY;
  return { gapSec, daily };
}

/** متوسط الوقت اللي دفعة بالعدد ده هتاخده (بالدقايق)، عشان نقوله قبل ما يبعت. */
export const etaMinutes = (n: number, gapSec: number, daily: number) => {
  const per = gapSec + 7; // الفاصل + متوسط الاختلاف العشوائي
  const days = Math.floor(Math.max(n - 1, 0) / daily);
  return Math.ceil((n * per) / 60) + days * 24 * 60;
};

/**
 * إعلان واحد (أو ولا واحد) جاهز للجسر دلوقتي: بيحترم الفاصل الزمني والحد اليومي، وبيتخطى اللي طلب إلغاء.
 * الرسالة اللي اتسحبت ومردّش الجسر عليها بتتعلّم فاشلة (مش بتتعاد) عشان العميل ما يستلمهاش مرتين.
 */
export async function nextBroadcast(db: PrismaClient) {
  const now = Date.now();
  const where = { byName: { startsWith: BC_PREFIX } };
  await db.outboundMessage.updateMany({
    where: { ...where, status: 'queued', claimedAt: { lt: new Date(now - CLAIM_TIMEOUT_MS) } },
    data: { status: 'failed', err: 'الجسر ما ردّش — اتعلّمت فاشلة بدل ما تتبعت مرتين', doneAt: new Date() },
  });
  const { gapSec, daily } = await getLimits(db);
  const [last, today] = await Promise.all([
    db.outboundMessage.findFirst({ where: { ...where, claimedAt: { not: null } }, orderBy: { claimedAt: 'desc' }, select: { claimedAt: true } }),
    db.outboundMessage.count({ where: { ...where, claimedAt: { gt: new Date(now - 24 * 3600e3) } } }),
  ]);
  if (today >= daily) return null;
  const opt = new Set(await getOptout(db));
  for (let tries = 0; tries < 25; tries++) {
    const row = await db.outboundMessage.findFirst({ where: { ...where, status: 'queued', claimedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!row) return null;
    if (opt.has(last10(row.toPhone))) {
      await db.outboundMessage.update({ where: { id: row.id }, data: { status: 'failed', err: 'العميل طلب إلغاء الإعلانات', doneAt: new Date() } });
      continue;
    }
    // الفاصل بيختلف من رسالة لرسالة (٠–١٤ ثانية زيادة) عشان الإرسال ما يبقاش بإيقاع ثابت
    const jitter = (parseInt(row.id.slice(-3), 36) % 15) * 1000;
    if (last?.claimedAt && now - last.claimedAt.getTime() < gapSec * 1000 + jitter) return null;
    const got = await db.outboundMessage.updateMany({ where: { id: row.id, status: 'queued', claimedAt: null }, data: { claimedAt: new Date() } });
    return got.count === 1 ? row : null;
  }
  return null;
}
