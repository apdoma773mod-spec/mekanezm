import type { ContactDto, PayMethod } from '@mk/shared';

const moneyFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 3 });

/** Same as the old system: Arabic digits followed by «ج.م». */
export const money = (n: number | null | undefined) => `${moneyFmt.format(Number(n || 0))} ج.م`;

export const qtyText = (n: number) => numFmt.format(n);

/** A YYYY-MM-DD business day shown like the old system (toLocaleDateString('ar-EG')). */
export function arDate(day: string | null | undefined): string {
  if (!day) return '';
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('ar-EG');
}

const dateTime = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Africa/Cairo',
});

/** Timestamps arrive in UTC; the shop reads them in Cairo time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateTime.format(new Date(iso));
}

export function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}

export const ROLE_LABELS = { ADMIN: 'مدير', STAFF: 'موظف' } as const;

export const PAY_LABELS: Record<PayMethod, string> = {
  CASH: 'كاش',
  INSTAPAY: 'إنستاباي',
  WALLET: 'محفظة',
  TRANSFER: 'تحويل بنكي',
};

export const CONTACT_LABELS = { CUSTOMER: 'عميل', SUPPLIER: 'مورد' } as const;

/** The old system's wording for a balance («عليه ٥٠ ج.م», «ليه رصيد…», «خالص»). */
export function balanceText(c: Pick<ContactDto, 'type' | 'balance'>): string {
  const b = c.balance;
  if (Math.abs(b) < 0.005) return 'خالص';
  if (c.type === 'CUSTOMER') return b > 0 ? `عليه ${money(b)}` : `ليه رصيد ${money(-b)}`;
  return b > 0 ? `ليه ${money(b)}` : `رصيد لينا عنده ${money(-b)}`;
}

export const balanceColor = (b: number) => (b > 0.005 ? 'var(--danger)' : b < -0.005 ? 'var(--green)' : 'inherit');

export const AUDIT_LABELS: Record<string, string> = {
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  PASSWORD_CHANGE: 'تغيير كلمة السر',
  USER_CREATE: 'إضافة مستخدم',
  USER_UPDATE: 'تعديل مستخدم',
  USER_DEACTIVATE: 'إيقاف مستخدم',
  USER_PASSWORD_RESET: 'تغيير كلمة سر مستخدم',
  SETTING_UPDATE: 'تعديل الإعدادات',
  PRODUCT_CREATE: 'إضافة صنف',
  PRODUCT_UPDATE: 'تعديل صنف',
  PRODUCT_DELETE: 'حذف صنف',
  STOCK_ADJUST: 'تعديل كمية',
  CONTACT_CREATE: 'إضافة عميل/مورد',
  CONTACT_UPDATE: 'تعديل عميل/مورد',
  CONTACT_DELETE: 'حذف عميل/مورد',
  INVOICE_CREATE: 'فاتورة جديدة',
  INVOICE_UPDATE: 'تعديل فاتورة',
  INVOICE_VOID: 'إلغاء فاتورة',
  PAYMENT_CREATE: 'دفعة',
  PAYMENT_CANCEL: 'إلغاء دفعة',
  RETURN_CREATE: 'مرتجع',
  EXPENSE_CREATE: 'مصروف',
  EXPENSE_UPDATE: 'تعديل مصروف',
  EXPENSE_DELETE: 'حذف مصروف',
};

const hx = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)) as [number, number, number];
const toHex = (a: number[]) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Same color math as the old applyTheme(), so tints match exactly. */
export const mix = (h: string, t: number) => toHex(hx(h).map((v) => v * t + 255 * (1 - t)));
export const darken = (h: string, f: number) => toHex(hx(h).map((v) => v * f));
const lum = (h: string) => {
  const [r, g, b] = hx(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const textOn = (h: string) => (lum(h) > 0.45 ? '#18343a' : '#ffffff');
export const rgba = (h: string, a: number) => {
  const [r, g, b] = hx(h);
  return `rgba(${r},${g},${b},${a})`;
};

const DEFSTACK = '-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif';
export const fontStack = (k: string) => (k === 'default' || !k ? DEFSTACK : `"${k}",${DEFSTACK}`);
