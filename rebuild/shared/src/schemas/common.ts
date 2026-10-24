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
