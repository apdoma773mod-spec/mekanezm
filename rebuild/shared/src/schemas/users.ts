import { z } from 'zod';
import { ROLES } from '../enums.js';
import { paginationQuery, phoneSchema } from './common.js';
import { passwordSchema } from './auth.js';

const nameSchema = z.string().trim().min(2, 'الاسم قصير جدًا').max(80, 'الاسم طويل جدًا');
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('الإيميل مش صحيح')
  .max(254);

/** Empty strings from forms mean "no email". */
const optionalEmail = z.preprocess((v) => (v === '' ? null : v), emailSchema.nullable());

export const createUserInput = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmail.optional(),
  role: z.enum(ROLES),
  password: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserInput>;

export const updateUserInput = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    email: optionalEmail,
    role: z.enum(ROLES),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'مفيش تعديل' });
export type UpdateUserInput = z.infer<typeof updateUserInput>;

export const resetPasswordInput = z.object({ newPassword: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;

export const listUsersQuery = paginationQuery.extend({
  role: z.enum(ROLES).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
