import { z } from 'zod';
import { ROLES } from '../enums.js';
import { normalizeDigits } from '../digits.js';

export const passwordSchema = z
  .string()
  .min(8, 'كلمة السر لازم تكون ٨ حروف على الأقل')
  .max(128, 'كلمة السر طويلة جدًا');

export const loginInput = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'اكتب رقم الموبايل أو الإيميل')
    .max(254)
    .transform((v) => normalizeDigits(v)),
  password: z.string().min(1, 'اكتب كلمة السر').max(128),
});
export type LoginInput = z.infer<typeof loginInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'اكتب كلمة السر الحالية').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'كلمة السر الجديدة لازم تختلف عن الحالية',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(ROLES),
  active: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
