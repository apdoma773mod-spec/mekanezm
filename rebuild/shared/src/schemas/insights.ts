import { z } from 'zod';

// ---------- 💰 الديون والتذكير ----------

/** The old default reminder; {الاسم} {المحل} {المبلغ} {من} are filled in per customer. */
export const DEFAULT_DEBT_TEMPLATE =
  'السلام عليكم أستاذ {الاسم} 👋\nمعاك {المحل}.\nحابين نفكّر حضرتك إن الحساب عندنا {المبلغ}{من}.\nتقدر تدفع كاش في المحل أو إنستاباي / تحويل — وقت ما يناسبك.\nشكراً لتعاملك معانا 🙏';

export interface DebtorDto {
  id: string;
  name: string;
  phone: string;
  balance: number;
  /** Day of the oldest credit invoice still covering the balance. */
  since: string | null;
  /** Part of the balance is older than any open invoice (opening balance). */
  old: boolean;
  days: number | null;
  open: { id: string; no: string; date: string; remaining: number }[];
  lastPay: { amount: number; date: string } | null;
  reminder: { at: string; by: string; amount: number } | null;
}

export interface DebtsDto {
  debtors: DebtorDto[];
  template: string;
}

export const debtTemplateInput = z.object({ text: z.string().trim().min(1, 'اكتب الرسالة').max(2000) });

// ---------- 📦 اقتراحات الطلب ----------

export const reorderQuery = z.object({
  days: z.coerce.number().int().refine((d) => [15, 30, 45, 60].includes(d)).default(30),
});

export interface ReorderSuggestion {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  min: number;
  /** Net pieces sold per day over the last 60 days (or since the first sale). */
  daily: number;
  /** Days the stock lasts at that speed; null = no recent sales. */
  cover: number | null;
  need: number;
  supplier: string;
  supplierPhone: string;
}

// ---------- 📊 رسومات لوحة التحكم ----------

export const chartsQuery = z.object({
  top: z.coerce.number().int().refine((d) => [0, 30, 90, 365].includes(d)).default(30),
  stag: z.coerce.number().int().refine((d) => [30, 60, 90, 180].includes(d)).default(60),
});

export interface DashboardCharts {
  daily: { l: string; t: string; v: number }[];
  monthly: { l: string; t: string; v: number; sales: number; gross: number; exp: number }[];
  top: { n: string; v: number }[];
  stagnant: { n: string; v: number; q: number; u: string }[];
}
