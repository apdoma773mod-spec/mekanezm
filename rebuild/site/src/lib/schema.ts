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
  /** Hidden from the site (set from /admin; the product stays in the data). */
  hidden: z.boolean().optional(),
  /** Left/right guidance (see lib/hand.ts). `off` turns the automatic detection off for this product. */
  dir: z.object({
    off: z.boolean().optional(),
    hand: z.enum(['R', 'L']).optional(),
    kind: z.enum(['bean', 'magic', 'generic', 'door', 'other', 'corner']).optional(),
    /** The owner's own GIF / image / short video, shown instead of the built-in motion. */
    media: z.string().optional(),
    pair: z.string().optional(),
    note: z.string().optional(),
  }).optional(),
  // No price on purpose: the owner never shows prices on the site (zod drops the field).
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
  /** Hand-picked reviews the owner writes in the system / admin (customer reviews come from the web_reviews table). */
  reviews: z.array(z.object({ id: str.default(''), name: str, area: str.default(''), stars: z.coerce.number().min(1).max(5).catch(5), text: str })).default([]),
  sections: z.array(sectionSchema).default([]),
  products: z.array(productSchema).default([]),
});

export type Product = z.infer<typeof productSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Site = z.infer<typeof siteSchema>;
/** code → in stock? (from the system's live stock) */
export type Stock = Record<string, boolean>;

/** Shop settings without the product list (what every page needs; small even with thousands of products). */
export type Settings = Omit<Site, 'products'> & { counts: Record<string, number> };

/** A product snapshot kept in the cart / favorites / recently viewed (so the browser never needs the full catalog). */
export type Item = { id: string; name: string; code: string; desc: string; img: string; ok: boolean };

export type ShipMethod = 'pickup' | 'delivery' | 'ship';
export type Ship = { method: ShipMethod; gov: string; area: string; address: string };
