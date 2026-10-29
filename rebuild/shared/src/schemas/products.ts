import { z } from 'zod';
import { COMPANIES, STOCK_REASONS } from '../enums.js';
import { normalizeDigits } from '../digits.js';
import { moneySchema, paginationQuery, qtySchema } from './common.js';

const text = (max: number) => z.string().trim().max(max);

const codeSchema = z
  .string()
  .transform((v) => normalizeDigits(v).trim().toUpperCase())
  .pipe(z.string().max(40, 'الكود طويل جدًا').regex(/^[A-Z0-9\-_.]*$/, 'الكود حروف إنجليزي وأرقام بس'));

const barcodeSchema = z
  .string()
  .transform((v) => normalizeDigits(v).trim())
  .pipe(z.string().max(64, 'الباركود طويل جدًا'));

export const productInput = z.object({
  /** Empty = generate the next free code (P0001, P0002, …). */
  code: codeSchema.optional(),
  name: z.string().trim().min(1, 'اكتب اسم الصنف').max(200, 'الاسم طويل جدًا'),
  barcode: barcodeSchema.optional(),
  category: text(80).default(''),
  unit: z.string().trim().min(1, 'اكتب الوحدة').max(30).default('قطعة'),
  price: moneySchema.default(0),
  cost: moneySchema.default(0),
  minQty: qtySchema.pipe(z.number().min(0, 'الحد الأدنى مينفعش يكون بالسالب')).default(0),
  /** Opening stock, only used when the product is created. */
  qty: qtySchema.default(0),
  company: z.enum(COMPANIES).default('MK'),
  note: text(500).default(''),
});
export type ProductInput = z.infer<typeof productInput>;

export const updateProductInput = productInput
  .omit({ qty: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'مفيش تعديل' });
export type UpdateProductInput = z.infer<typeof updateProductInput>;

export const adjustStockInput = z.object({
  /** The quantity actually on the shelf after counting. */
  newQty: qtySchema,
  note: z.string().trim().min(1, 'اكتب سبب التعديل').max(300),
});
export type AdjustStockInput = z.infer<typeof adjustStockInput>;

export const listProductsQuery = paginationQuery.extend({
  category: z.string().trim().max(80).optional(),
  company: z.enum(COMPANIES).optional(),
  /** low = still in stock but at or under the alert level; out = nothing left. */
  stock: z.enum(['all', 'low', 'out']).default('all'),
  sort: z.enum(['name', 'code', 'qty', 'updated']).default('name'),
});
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

export const lookupProductQuery = z.object({
  code: z
    .string()
    .transform((v) => normalizeDigits(v).trim())
    .pipe(z.string().min(1).max(64)),
});

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  category: string;
  unit: string;
  price: number;
  /** Only present for admins. */
  cost?: number;
  /** Only present for admins: the cost is an estimate. */
  costEst?: boolean;
  qty: number;
  minQty: number;
  company: (typeof COMPANIES)[number];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMoveDto {
  id: string;
  qtyChange: number;
  qtyAfter: number;
  reason: (typeof STOCK_REASONS)[number];
  refType: string | null;
  refId: string | null;
  refLabel: string | null;
  note: string;
  user: { id: string; name: string } | null;
  createdAt: string;
}
