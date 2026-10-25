import { z } from 'zod';
import { isoDateSchema, moneySchema, paginationQuery, positiveQty, qtySchema } from './common.js';

export const DAYBOOK_PAYS = ['CASH', 'INSTAPAY', 'TRANSFER', 'CREDIT'] as const;
export type DaybookPay = (typeof DAYBOOK_PAYS)[number];

const person = z.string().trim().max(120).default('');

export const daybookAddInput = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ITEM'),
    day: isoDateSchema.optional(),
    productId: z.string().max(64).optional(),
    name: z.string().trim().max(200).default(''),
    qty: positiveQty,
    price: moneySchema,
    owed: qtySchema.pipe(z.number().min(0, 'مينفعش بالسالب')).default(0),
    person,
    pay: z.enum(DAYBOOK_PAYS).default('CASH'),
    note: z.string().trim().max(300).default(''),
  }),
  z.object({
    kind: z.literal('PAY'),
    day: isoDateSchema.optional(),
    person: z.string().trim().min(1, 'اكتب اسم العميل').max(120),
    price: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')),
    pay: z.enum(['CASH', 'INSTAPAY', 'TRANSFER']).default('CASH'),
    note: z.string().trim().max(300).default(''),
  }),
]);
export type DaybookAddInput = z.infer<typeof daybookAddInput>;

export const daybookUpdateInput = z
  .object({
    qty: positiveQty,
    price: moneySchema,
    owed: qtySchema.pipe(z.number().min(0)),
    person,
    pay: z.enum(DAYBOOK_PAYS),
    note: z.string().trim().max(300),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'مفيش تعديل' });
export type DaybookUpdateInput = z.infer<typeof daybookUpdateInput>;

export const daybookSetPayInput = z.object({ pay: z.enum(DAYBOOK_PAYS) });

export const daybookPostInput = z.object({
  day: isoDateSchema,
  /** One customer's lines only (`""` = sales with no name); omitted = settle the whole day. */
  person: z.string().max(120).optional(),
});
export type DaybookPostInput = z.infer<typeof daybookPostInput>;

export const daybookDayQuery = z.object({ day: isoDateSchema.optional() });

export interface DaybookEntryDto {
  id: string;
  day: string;
  kind: 'ITEM' | 'PAY';
  productId: string | null;
  name: string;
  unit: string | null;
  qty: number;
  price: number;
  total: number;
  owed: number;
  person: string;
  pay: DaybookPay;
  note: string;
  deliveredAt: string | null;
  postedAt: string | null;
  invoice: { id: string; no: string } | null;
  createdBy: string | null;
  createdAt: string;
}

export interface DaybookDay {
  day: string;
  entries: DaybookEntryDto[];
  /** Undelivered «باقي له» lines from every day. */
  owed: DaybookEntryDto[];
}

export interface DaybookPostResult {
  invoices: { person: string; id: string; no: string }[];
}

// ---------- day summary and closing ----------

export interface DaySummary {
  day: string;
  salesCount: number;
  salesTotal: number;
  salesPaid: number;
  salesCredit: number;
  shipping: number;
  collections: number;
  purchasesTotal: number;
  purchasesPaid: number;
  supplierPayments: number;
  expenses: number;
  returnsSale: number;
  returnsPurchase: number;
  /** Money that came in by these methods today: it is not in the drawer. */
  instapay: number;
  wallet: number;
  transfer: number;
  daybookOpen: number;
  /** What the cash drawer should hold from today's movements. */
  cashExpected: number;
  topItems: { name: string; qty: number; total: number }[];
  byUser: { name: string; count: number; total: number }[];
  /** Admins only. */
  profit?: number;
}

export const closingInput = z.object({
  day: isoDateSchema,
  cashActual: moneySchema.nullable().default(null),
  note: z.string().trim().max(500).default(''),
});
export type ClosingInput = z.infer<typeof closingInput>;

export interface ClosingDto {
  id: string;
  day: string;
  data: DaySummary;
  cashExpected: number;
  cashActual: number | null;
  cashDiff: number | null;
  note: string;
  createdBy: string | null;
  createdAt: string;
}

export const listClosingsQuery = paginationQuery;

// ---------- stock count ----------

export const stockCountInput = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), counted: qtySchema.pipe(z.number().min(0, 'العدد مينفعش بالسالب')) }))
    .min(1, 'اعدّ صنف واحد على الأقل')
    .max(5000),
  note: z.string().trim().max(300).default(''),
});
export type StockCountInput = z.infer<typeof stockCountInput>;

export interface StockCountLine {
  productId: string;
  code: string;
  name: string;
  before: number;
  counted: number;
  diff: number;
  cost: number;
}

export interface StockCountDto {
  id: string;
  no: string;
  note: string;
  items: StockCountLine[];
  itemCount: number;
  shortValue: number;
  excessValue: number;
  createdBy: string | null;
  createdAt: string;
}
