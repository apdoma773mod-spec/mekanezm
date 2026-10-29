import { z } from 'zod';
import {
  COMPANIES,
  PAY_METHODS,
  PAYMENT_DIRECTIONS,
  RETURN_KINDS,
  RETURN_SETTLEMENTS,
} from '../enums.js';
import { isoDateSchema, moneySchema, paginationQuery, positiveQty } from './common.js';

const positiveMoney = moneySchema.pipe(z.number().gt(0, 'المبلغ لازم يكون أكبر من صفر'));

// ---------- payments ----------

export const paymentInput = z.object({
  contactId: z.string().min(1, 'اختار العميل أو المورد').max(64),
  amount: positiveMoney,
  method: z.enum(PAY_METHODS).default('CASH'),
  company: z.enum(COMPANIES).default('MK'),
  date: isoDateSchema.optional(),
  note: z.string().trim().max(300).default(''),
});
export type PaymentInput = z.infer<typeof paymentInput>;

export const listPaymentsQuery = paginationQuery.extend({
  contactId: z.string().max(64).optional(),
  direction: z.enum(PAYMENT_DIRECTIONS).optional(),
  company: z.enum(COMPANIES).optional(),
  includeCancelled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuery>;

export interface PaymentDto {
  id: string;
  contact: { id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER' };
  invoice: { id: string; no: string } | null;
  direction: (typeof PAYMENT_DIRECTIONS)[number];
  amount: number;
  method: (typeof PAY_METHODS)[number];
  company: (typeof COMPANIES)[number];
  date: string;
  note: string;
  createdBy: { id: string; name: string } | null;
  cancelledAt: string | null;
  createdAt: string;
}

// ---------- returns ----------

export const returnInput = z.object({
  kind: z.enum(RETURN_KINDS),
  productId: z.string().min(1, 'اختار الصنف').max(64),
  qty: positiveQty,
  price: moneySchema,
  contactId: z.string().max(64).optional(),
  person: z.string().trim().max(120).default(''),
  invoiceId: z.string().max(64).optional(),
  settlement: z.enum(RETURN_SETTLEMENTS).default('CASH'),
  method: z.enum(PAY_METHODS).default('CASH'),
  company: z.enum(COMPANIES).default('MK'),
  note: z.string().trim().max(300).default(''),
});
export type ReturnInput = z.infer<typeof returnInput>;

export const listReturnsQuery = paginationQuery.extend({
  kind: z.enum(RETURN_KINDS).optional(),
  contactId: z.string().max(64).optional(),
  company: z.enum(COMPANIES).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListReturnsQuery = z.infer<typeof listReturnsQuery>;

export interface ReturnDto {
  id: string;
  kind: (typeof RETURN_KINDS)[number];
  product: { id: string; code: string; name: string; unit: string };
  contact: { id: string; name: string } | null;
  invoice: { id: string; no: string } | null;
  person: string;
  qty: number;
  price: number;
  total: number;
  settlement: (typeof RETURN_SETTLEMENTS)[number];
  method: (typeof PAY_METHODS)[number];
  company: (typeof COMPANIES)[number];
  date: string;
  note: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

// ---------- expenses ----------

export const expenseInput = z.object({
  category: z.string().trim().min(1, 'اختار البند').max(60).default('عام'),
  amount: positiveMoney,
  method: z.enum(PAY_METHODS).default('CASH'),
  company: z.enum(COMPANIES).default('MK'),
  date: isoDateSchema.optional(),
  note: z.string().trim().max(300).default(''),
});
export type ExpenseInput = z.infer<typeof expenseInput>;

export const updateExpenseInput = expenseInput
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'مفيش تعديل' });
export type UpdateExpenseInput = z.infer<typeof updateExpenseInput>;

export const listExpensesQuery = paginationQuery.extend({
  category: z.string().trim().max(60).optional(),
  company: z.enum(COMPANIES).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuery>;

export interface ExpenseDto {
  id: string;
  category: string;
  amount: number;
  method: (typeof PAY_METHODS)[number];
  company: (typeof COMPANIES)[number];
  date: string;
  note: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

// ---------- cash drawer ----------

export const cashQuery = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  company: z.enum(COMPANIES).optional(),
});
export type CashQuery = z.infer<typeof cashQuery>;

export type CashMoveKind =
  | 'SALE'
  | 'PURCHASE'
  | 'PAYMENT_IN'
  | 'PAYMENT_OUT'
  | 'SALE_RETURN'
  | 'PURCHASE_RETURN'
  | 'EXPENSE';

export interface CashMove {
  kind: CashMoveKind;
  id: string;
  date: string;
  at: string;
  label: string;
  method: (typeof PAY_METHODS)[number];
  /** Positive = money in, negative = money out. */
  amount: number;
  refId: string;
}

export interface CashSummary {
  from: string;
  to: string;
  byMethod: Record<(typeof PAY_METHODS)[number], { in: number; out: number; net: number }>;
  totals: { in: number; out: number; net: number };
  /** What should be in the drawer now: every money movement since the start. */
  balance: number;
  moves: CashMove[];
}

// ---------- dashboard ----------

/** The old system's all-time figures (dashboard, cash and returns screens). */
export interface Overview {
  productsCount: number;
  /** Products with nothing left, products at or under their alert level, and what we owe suppliers. */
  outCount: number;
  lowCount: number;
  suppliersOwed: number;
  /** Only for admins: quantity × cost over all products. */
  stockValue?: number;
  /** Sales minus sale returns, purchases minus purchase returns. */
  salesTotal: number;
  purchasesTotal: number;
  expensesTotal: number;
  saleReturns: number;
  purchaseReturns: number;
  cashBalance: number;
  receivables: number;
}

export interface TodaySummary {
  date: string;
  sales: { count: number; total: number; paid: number };
  purchases: { count: number; total: number };
  cashNet: number;
  expenses: number;
  lowStockCount: number;
  receivables: number;
  payables: number;
  /** Only present for admins. */
  profit?: number;
}
