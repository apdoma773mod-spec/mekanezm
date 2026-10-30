// Where the data lives today (the same Supabase project the old GitHub Pages site reads).
// The publishable key is public by design (it is in the old site's HTML too).
export const SB_URL = process.env.NEXT_PUBLIC_SB_URL ?? 'https://tkzfjeizvanfptnqvrmr.supabase.co';
export const SB_KEY = process.env.NEXT_PUBLIC_SB_KEY ?? 'sb_publishable_8QP_KfvoYOyF_bZC4-fw1w_qCkfEpvZ';

// Public address of this site, for canonical links, the sitemap and share links.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3300').replace(/\/$/, '');

// Analytics ids the old site used (empty string turns one off).
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-MY8C3L82KH';
export const FB_PIXEL = process.env.NEXT_PUBLIC_FB_PIXEL ?? '2451616262015694';

// Fallbacks when the shop data has no value.
export const DEFAULT_PHONES = ['01042383986', '01042466087'];
export const CUSTOM_WA = '201042383986';
export const CUSTOM_TEL = '01042383986';

// How long a built page may be served before it is rebuilt from fresh data (seconds). One small read a
// minute, so edits in the system show within ~1 minute even without calling /api/revalidate.
export const REVALIDATE = 60;

// Payment accounts shown in the cart/policy (env overrides; empty string hides one).
export const PAY = { instapay: process.env.NEXT_PUBLIC_INSTAPAY ?? '01010741015', wallet: process.env.NEXT_PUBLIC_WALLET ?? '01119199659' };

// Shop opening hours (Cairo time) for the «مفتوح دلوقتي» badge: 10 AM → midnight, Friday off.
export const OPENING = { open: 10, close: 24, closedDays: [5] as number[] };

// Wholesale (جملة) sign-up: how a carpenter/trader proves it. Change the numbers here.
export const TRADE = { minInvoices: 5, months: 3, reviewDays: 1 };
