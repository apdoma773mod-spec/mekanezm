import { z } from 'zod';
import { CONTACT_TYPES, PAY_METHODS } from '../enums.js';
import { normalizePhone } from '../digits.js';
import { isoDateSchema, paginationQuery } from './common.js';

/** Contacts often have landlines or partial numbers, so only digits and length are checked. */
export const contactPhoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .pipe(z.string().regex(/^\+?\d{0,15}$/, 'رقم التليفون أرقام بس'));

export const contactInput = z.object({
  type: z.enum(CONTACT_TYPES),
  name: z.string().trim().min(1, 'اكتب الاسم').max(120, 'الاسم طويل جدًا'),
  phone: contactPhoneSchema.default(''),
  address: z.string().trim().max(300).default(''),
  note: z.string().trim().max(1000).default(''),
});
export type ContactInput = z.infer<typeof contactInput>;

export const updateContactInput = contactInput
  .omit({ type: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'مفيش تعديل' });
export type UpdateContactInput = z.infer<typeof updateContactInput>;

export const listContactsQuery = paginationQuery.extend({
  type: z.enum(CONTACT_TYPES).optional(),
  withBalance: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['name', 'balance', 'recent']).default('name'),
});
export type ListContactsQuery = z.infer<typeof listContactsQuery>;

export const statementQuery = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export interface ContactDto {
  id: string;
  type: (typeof CONTACT_TYPES)[number];
  name: string;
  phone: string;
  address: string;
  note: string;
  /** Customer: what they owe us. Supplier: what we owe them. */
  balance: number;
  createdAt: string;
}

export type StatementLineKind = 'INVOICE' | 'PAYMENT' | 'RETURN' | 'OPENING';

export interface StatementLine {
  kind: StatementLineKind;
  id: string;
  date: string;
  label: string;
  /** Raises the balance (a credit invoice). */
  debit: number;
  /** Lowers the balance (a payment, a return against the balance). */
  credit: number;
  balance: number;
  method?: (typeof PAY_METHODS)[number];
}

export interface ContactStatement {
  contact: ContactDto;
  from: string | null;
  to: string | null;
  opening: number;
  closing: number;
  lines: StatementLine[];
}
