import type { PrismaClient } from '@prisma/client';

/**
 * 🔔 كل حاجة الموقع بيبعتها للسيستم ليها «نوع» واحد وشاشة واحدة، من مكان واحد:
 * - العدّاد اللي فوق في السيستم (NotifyBar) بيعدّ كل نوع لوحده ويفتح شاشته.
 * - رسالة الواتساب اللي بتجيلك بتقول إيه النوع بالظبط ومعاها لينك على شاشته هو بالذات.
 * ماحدش يكتب نص تنبيه أو مسار شاشة بره الملف ده — ضيف النوع هنا بس.
 */
export type SiteEvent = 'order' | 'custom' | 'request' | 'subscribe' | 'review' | 'wait';

export const SITE_EVENTS: Record<SiteEvent, { icon: string; label: string; path: string }> = {
  order: { icon: '🛒', label: 'طلب جديد من الموقع', path: '/weborders' },
  custom: { icon: '🛠️', label: 'طلب تجهيز من الموقع', path: '/weborders#cuBody' },
  request: { icon: '📷', label: 'طلب بالصور من الموقع', path: '/weborders#rqBody' },
  subscribe: { icon: '📣', label: 'مشترك جديد في جديد الواتساب', path: '/weborders#subBody' },
  review: { icon: '⭐', label: 'رأي جديد مستني موافقتك', path: '/weborders#revBody' },
  wait: { icon: '🔔', label: 'عميل مستني منتج يتوفر', path: '/weborders#waitBody' },
};

/** «اشتراك في جديد الواتساب» بيوصل كطلب عليه علامة في أول النص (مفيش عمود نوع في الجدول). */
export const SUB_PREFIX = '📣 اشتراك';
export const isSubscription = (note: string | null | undefined) => (note ?? '').trimStart().startsWith(SUB_PREFIX);
/** النوع الصح لطلب جه من فورم «ابعت صورة/وصف». */
export const kindOfRequest = (note: string | null | undefined): SiteEvent => (isSubscription(note) ? 'subscribe' : 'request');

const NOTIFY_DEFAULT = ['201119199659', '201042383986', '201042466087'];
const ADMIN_URL = (process.env.ADMIN_URL || 'https://mekanezm-admin.vercel.app').replace(/\/$/, '');

/** نص رسالة المالك: العنوان بنوع الحدث، السطور بتاعته، ولينك شاشته. (بتتجرّب لوحدها من غير قاعدة بيانات) */
export function ownerMessage(kind: SiteEvent, lines: string[]): string {
  const e = SITE_EVENTS[kind];
  return [`${e.icon} ${e.label}`, ...lines.filter(Boolean), `👉 ${ADMIN_URL}${e.path}`].join('\n');
}

/**
 * بيحط رسالة للمالك في طابور الواتساب (من واتساب المحل). نفس إعداد طلبات الموقع: Setting `web_order_notify` ({ on, to }).
 * الفشل هنا ماينفعش يوقّع الطلب نفسه — الطلب اتحفظ في كل الأحوال.
 */
export async function pingOwner(db: PrismaClient, kind: SiteEvent, lines: string[]): Promise<void> {
  try {
    const cfg = ((await db.setting.findUnique({ where: { key: 'web_order_notify' } }))?.value ?? {}) as { on?: boolean; to?: string[] };
    if (cfg.on === false) return;
    const to = [...new Set((Array.isArray(cfg.to) && cfg.to.length ? cfg.to : NOTIFY_DEFAULT).map((x) => String(x).replace(/\D/g, '')).filter(Boolean))];
    const body = ownerMessage(kind, lines);
    for (const t of to) await db.outboundMessage.create({ data: { toPhone: t, body, byName: `🌐 ${SITE_EVENTS[kind].label}` } });
  } catch {
    /* ignore */
  }
}
