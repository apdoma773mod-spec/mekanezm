import { z } from 'zod';
import { EG_MOBILE_RE, normalizePhone } from '../digits.js';

const optionalText = (max: number) => z.string().trim().max(max);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'اللون لازم يكون بصيغة #RRGGBB');

/** Images are stored inline (as the old system did); capped so a settings row stays small. */
const MAX_IMAGE_CHARS = 3_000_000;
const imageDataUrl = z
  .string()
  .max(MAX_IMAGE_CHARS, 'الصورة كبيرة، صغّرها شوية')
  .refine((v) => v === '' || /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v), 'الصورة مش صالحة');

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

export const FONT_CHOICES = [
  ['default', 'الخط الافتراضي (الجهاز)'],
  ['Cairo', 'القاهرة — Cairo'],
  ['Tajawal', 'تجوال — Tajawal'],
  ['Almarai', 'المراعي — Almarai'],
  ['Noto Kufi Arabic', 'نوتو كوفي'],
  ['Amiri', 'أميري (نسخ)'],
  ['Changa', 'شانجا — Changa'],
] as const;
export type FontChoice = (typeof FONT_CHOICES)[number][0];
const fontKeys = FONT_CHOICES.map((f) => f[0]) as [FontChoice, ...FontChoice[]];

/** Same options as the old system's «المظهر والتخصيص» screen. */
export const themeSettings = z.object({
  primary: hexColor,
  accent: hexColor,
  bg: hexColor,
  text: hexColor,
  font: z.enum(fontKeys),
  invFont: z.union([z.literal('same'), z.enum(fontKeys)]),
  invSync: z.boolean(),
  invHeader: hexColor,
  invAccent: hexColor,
  logo: imageDataUrl,
  logoHeader: z.boolean(),
  logoInv: z.boolean(),
  watermark: z.boolean(),
  bgImg: imageDataUrl,
  bgClarity: z.number().int().min(10).max(100),
  topGap: z.number().int().min(0).max(120),
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

export const DEFAULT_THEME: ThemeSettings = {
  primary: '#087f8c',
  accent: '#d5a928',
  bg: '#f5f7f8',
  text: '#18343a',
  font: 'default',
  invFont: 'same',
  invSync: true,
  invHeader: '#087f8c',
  invAccent: '#d5a928',
  logo: '',
  logoHeader: true,
  logoInv: true,
  watermark: false,
  bgImg: '',
  bgClarity: 35,
  topGap: 0,
};

export const DEFAULT_SETTINGS: SettingsMap = {
  store: { name: 'MEKANIZM | ميكانيزم', phones: [], address: 'الجيزة - أرض اللواء - شارع ١٠', invoiceFooter: '' },
  theme: DEFAULT_THEME,
};
