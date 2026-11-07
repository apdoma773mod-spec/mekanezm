import { z } from 'zod';
import { COMPANIES, INVOICE_KINDS, INVOICE_STATUSES, PAY_METHODS } from '../enums.js';
import { contactPhoneSchema } from './contacts.js';
import { isoDateSchema, moneySchema, paginationQuery, positiveQty } from './common.js';

export const invoiceItemInput = z
  .object({
    /** Existing product; when missing, `name` is matched or created as a new product. */
    productId: z.string().max(64).optional(),
    name: z.string().trim().max(200).default(''),
    qty: positiveQty,
    price: moneySchema,
  })
  .refine((v) => v.productId || v.name, { message: 'اختار صنف أو اكتب اسمه', path: ['name'] });
export type InvoiceItemInput = z.infer<typeof invoiceItemInput>;

/** Where an online sale came from ("" = not said). */
export const ONLINE_FROM = ['', 'SITE', 'WA', 'FB', 'IG', 'OTHER'] as const;
export const ONLINE_FROM_LABELS: Record<(typeof ONLINE_FROM)[number], string> = { '': 'مش محدد', SITE: '🛒 الموقع', WA: '💬 واتساب', FB: '📘 فيسبوك', IG: '📸 انستجرام', OTHER: '📱 تاني' };

export const invoiceInput = z.object({
  kind: z.enum(INVOICE_KINDS),
  company: z.enum(COMPANIES).default('MK'),
  date: isoDateSchema.optional(),
  /** Pick an existing customer/supplier, or give a name and one is found or created. */
  contactId: z.string().max(64).optional(),
  person: z.string().trim().max(120).default(''),
  phone: contactPhoneSchema.default(''),
  address: z.string().trim().max(300).default(''),
  note: z.string().trim().max(1000).default(''),
  shipping: moneySchema.default(0),
  discount: moneySchema.default(0),
  /** Amount paid now. Defaults to the full total (cash sale). */
  paid: moneySchema.optional(),
  payMethod: z.enum(PAY_METHODS).default('CASH'),
  /** «🌐 عميل أونلاين» (sales). Left out when editing = unchanged. */
  online: z.boolean().optional(),
  /** «جه منين»: الموقع / واتساب / فيسبوك / انستجرام / تاني. */
  onlineFrom: z.enum(ONLINE_FROM).optional(),
  items: z.array(invoiceItemInput).min(1, 'الفاتورة لازم يكون فيها صنف واحد على الأقل').max(500),
});
export type InvoiceInput = z.infer<typeof invoiceInput>;

/** Editing keeps the kind, number and date; `paid` is the new total paid on the invoice. */
export const updateInvoiceInput = invoiceInput.omit({ kind: true, date: true });
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceInput>;

export const voidInvoiceInput = z.object({
  reason: z.string().trim().min(1, 'اكتب سبب الإلغاء').max(300),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceInput>;

export const listInvoicesQuery = paginationQuery.extend({
  kind: z.enum(INVOICE_KINDS).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  company: z.enum(COMPANIES).optional(),
  contactId: z.string().max(64).optional(),
  /** Exact customer/supplier name on the invoice (the old purchases screen's supplier filter). */
  person: z.string().trim().max(120).optional(),
  /** paid = nothing left to pay, credit = something still owed. */
  pay: z.enum(['all', 'paid', 'credit']).default('all'),
  unpaid: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuery>;

export interface InvoiceItemDto {
  id: string;
  productId: string | null;
  code: string | null;
  name: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
  /** Only present for admins. */
  unitCost?: number;
}

export interface InvoiceDto {
  id: string;
  kind: (typeof INVOICE_KINDS)[number];
  no: string;
  status: (typeof INVOICE_STATUSES)[number];
  company: (typeof COMPANIES)[number];
  date: string;
  contactId: string | null;
  person: string;
  phone: string;
  address: string;
  note: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paid: number;
  remaining: number;
  payMethod: (typeof PAY_METHODS)[number];
  online: boolean;
  onlineFrom: string;
  /** Only present for admins: total − cost of goods. */
  profit?: number;
  items: InvoiceItemDto[];
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceListItem = Omit<InvoiceDto, 'items' | 'profit'> & { itemCount: number; /** First line's name, as the old list showed it. */ firstItem: string; /** First three lines for the card view. */ preview: { name: string; qty: number }[] };

/** The list plus the totals of everything the search matched (not just this page), like the old count line. */
export interface InvoiceListResult {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  sums: { total: number; remaining: number };
}
