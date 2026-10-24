const dateTime = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Cairo',
});

/** Timestamps arrive in UTC; the shop reads them in Cairo time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateTime.format(new Date(iso));
}

export const ROLE_LABELS = { ADMIN: 'مدير', STAFF: 'موظف' } as const;

export const AUDIT_LABELS: Record<string, string> = {
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  PASSWORD_CHANGE: 'تغيير كلمة السر',
  USER_CREATE: 'إضافة مستخدم',
  USER_UPDATE: 'تعديل مستخدم',
  USER_DEACTIVATE: 'إيقاف مستخدم',
  USER_PASSWORD_RESET: 'تغيير كلمة سر مستخدم',
  SETTING_UPDATE: 'تعديل الإعدادات',
};

export function hexToRgbChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
