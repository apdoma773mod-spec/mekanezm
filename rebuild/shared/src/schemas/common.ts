import { z } from 'zod';
import { ERROR_CODES } from '../enums.js';
import { EG_MOBILE_RE, normalizeDigits, normalizePhone } from '../digits.js';

export const idParam = z.object({ id: z.string().min(1).max(64) });
export type IdParam = z.infer<typeof idParam>;

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => EG_MOBILE_RE.test(v), { message: 'رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01' });

/** Integer that also accepts Arabic/Hindi digits, from strings (query, form) or numbers. */
export const intFromInput = z.preprocess(
  (v) => (typeof v === 'string' ? Number(normalizeDigits(v).trim()) : v),
  z.number().int(),
);

const toNumber = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const s = normalizeDigits(v).replace(/,/g, '').trim();
  return s === '' ? undefined : Number(s);
};

/** Money amount: accepts Arabic/Hindi digits, at most 2 decimals, never negative. */
export const moneySchema = z.preprocess(
  toNumber,
  z
    .number({ invalid_type_error: 'اكتب رقم صحيح', required_error: 'اكتب المبلغ' })
    .finite('اكتب رقم صحيح')
    .min(0, 'المبلغ مينفعش يكون بالسالب')
    .max(100_000_000, 'المبلغ كبير جدًا')
    .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), 'المبلغ بحد أقصى قرشين بعد العلامة'),
);

/** Money that may be negative, e.g. an opening balance in the contact's favour. */
export const signedMoneySchema = z.preprocess(
  toNumber,
  z
    .number({ invalid_type_error: 'اكتب رقم صحيح' })
    .finite('اكتب رقم صحيح')
    .min(-100_000_000, 'المبلغ كبير جدًا')
    .max(100_000_000, 'المبلغ كبير جدًا')
    .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), 'المبلغ بحد أقصى قرشين بعد العلامة'),
);

/** Quantity: up to 3 decimals so meters and kilos work. */
export const qtySchema = z.preprocess(
  toNumber,
  z
    .number({ invalid_type_error: 'اكتب رقم صحيح', required_error: 'اكتب الكمية' })
    .finite('اكتب رقم صحيح')
    .max(10_000_000, 'الكمية كبيرة جدًا')
    .refine((n) => Math.round(n * 1000) === Number((n * 1000).toFixed(6)), 'الكمية بحد أقصى ٣ أرقام بعد العلامة'),
);

export const positiveQty = qtySchema.pipe(z.number().gt(0, 'الكمية لازم تكون أكبر من صفر'));

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ لازم يكون YYYY-MM-DD');

export const dateRangeQuery = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const paginationQuery = z.object({
  page: intFromInput.pipe(z.number().int().min(1)).default(1),
  pageSize: intFromInput.pipe(z.number().int().min(1).max(200)).default(50),
  q: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
