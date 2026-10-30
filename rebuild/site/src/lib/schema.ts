import { z } from 'zod';

// Shape of the shop's public content (Supabase `site_content`, row id = main).
// Everything is optional/lenient: the owner edits this from the system and old rows vary.
const str = z.preprocess(v => (v == null ? '' : String(v)), z.string());

export const productSchema = z.object({
  id: z.string(),
  name: str,
  desc: str.default(''),
  code: str.default(''),
  sec: str.default(''),
  img: str.default(''),
  imgs: z.array(z.string()).default([]),
  top: z.boolean().optional(),
  out: z.boolean().optional(),
  video: str.default(''),
  price: z.union([z.number(), z.string()]).optional(),
});

export const sectionSchema = z.object({ id: z.string(), name: str, img: str.default('') });

const shipOptSchema = z.object({ note: str.default(''), fee: str.default(''), days: str.default('') }).partial();

export const siteSchema = z.object({
  name: str.default('ميكانيزم Mechanism'),
  tagline: str.default(''),
  phone: str.default(''),
  phones: z.array(z.string()).optional(),
  address: str.default(''),
  hours: str.default(''),
  promo: str.default(''),
  hero: str.default(''),
  logo: str.default(''),
  mapUrl: str.default(''),
  policy: str.default(''),
  deliveryNote: str.default(''),
  catalog: z.boolean().optional(),
  theme: z.object({ accent: z.string().optional() }).passthrough().default({}),
  socials: z.object({ fb: str, ig: str, tt: str, yt: str }).partial().default({}),
  delivery: z.array(z.object({ area: str.default(''), fee: str.default(''), days: str.default('') })).default([]),
  shipLocal: shipOptSchema.optional(),
  shipGov: shipOptSchema.optional(),
  slides: z.array(z.string()).optional(),
  trust: z.array(z.string()).optional(),
  works: z.array(z.object({ title: str, desc: str.default(''), imgs: z.array(z.string()).default([]) })).default([]),
  sections: z.array(sectionSchema).default([]),
  products: z.array(productSchema).default([]),
});

export type Product = z.infer<typeof productSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Site = z.infer<typeof siteSchema>;
/** code → in stock? (from the system's live stock) */
export type Stock = Record<string, boolean>;

export type ShipMethod = 'pickup' | 'delivery' | 'ship';
export type Ship = { method: ShipMethod; gov: string; area: string; address: string };
