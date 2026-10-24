import { z } from 'zod';
import { EG_MOBILE_RE, normalizePhone } from '../digits.js';

const optionalText = (max: number) => z.string().trim().max(max);

export const storeSettings = z.object({
  name: z.string().trim().min(1, 'اكتب اسم المحل').max(80),
  phones: z
    .array(
      z
        .string()
        .transform(normalizePhone)
        .refine((v) => EG_MOBILE_RE.test(v), { message: 'رقم موبايل مش صحيح' }),
    )
    .max(5),
  address: optionalText(200),
  invoiceFooter: optionalText(300),
});
export type StoreSettings = z.infer<typeof storeSettings>;

export const themeSettings = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'اللون لازم يكون بصيغة #RRGGBB'),
  mode: z.enum(['light', 'dark', 'system']),
});
export type ThemeSettings = z.infer<typeof themeSettings>;

export const settingSchemas = {
  store: storeSettings,
  theme: themeSettings,
} as const;

export type SettingKey = keyof typeof settingSchemas;
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export interface SettingsMap {
  store: StoreSettings;
  theme: ThemeSettings;
}

export const settingKeyParam = z.object({
  key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]),
});

export const DEFAULT_SETTINGS: SettingsMap = {
  store: { name: 'ميكانيزم', phones: [], address: '', invoiceFooter: '' },
  theme: { primary: '#0f766e', mode: 'system' },
};
