// Everything the browser sends (orders, requests, reviews, tracking…). Same Supabase RPCs the old
// site calls, so the system keeps receiving them unchanged. Swap these bodies for the new backend later.
import { SB_KEY, SB_URL } from './config';
import type { Ship, Stock } from './schema';

const H = { apikey: SB_KEY, 'Content-Type': 'application/json' };

/** RPC call → { ok, data } where data is the parsed JSON (or text). Never throws on HTTP errors. */
async function rpc<T = unknown>(fn: string, body: unknown): Promise<{ ok: boolean; data: T | null; message: string }> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  let j: unknown = null;
  try { j = JSON.parse(t); } catch { /* not json */ }
  const message = (j && typeof j === 'object' && 'message' in j ? String((j as { message: unknown }).message) : '') || '';
  return { ok: r.ok, data: j as T, message: r.ok ? '' : message || t.slice(0, 200) };
}

export async function fetchStock(): Promise<Stock | null> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/site_stock`, { method: 'POST', headers: H, body: '{}', cache: 'no-store' });
    const j = await r.json();
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Stock) : null;
  } catch { return null; }
}

export async function placeOrder(name: string, phone: string, items: { code: string; qty: number }[], ship: Ship) {
  let r = await rpc<string>('place_order', { p_name: name, p_phone: phone || null, p_items: items, p_ship: ship });
  // Older database without the shipping parameter.
  if (!r.ok && /PGRST202|Could not find the function/i.test(r.message)) r = await rpc<string>('place_order', { p_name: name, p_phone: phone || null, p_items: items });
  return r;
}

const randPath = (ext: string) => `r/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

/** Upload a customer photo/drawing; returns its public URL. */
export async function uploadRequestImage(blob: Blob): Promise<string> {
  const path = randPath(blob.type === 'image/webp' ? 'webp' : 'jpg');
  const r = await fetch(`${SB_URL}/storage/v1/object/customer-requests/${path}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': blob.type, 'cache-control': 'max-age=31536000' },
    body: blob,
  });
  if (!r.ok) throw new Error('upload');
  return `${SB_URL}/storage/v1/object/public/customer-requests/${path}`;
}

export const placeRequest = (name: string, phone: string, note: string, imgs: string[]) =>
  rpc<string>('place_request', { p_name: name, p_phone: phone, p_note: note, p_imgs: imgs });

export const placeCustomOrder = (b: { kind: string; name: string; phone: string; spec: unknown; summary: string; note: string; img: string }) =>
  rpc<string>('place_custom_order', { p_kind: b.kind, p_name: b.name, p_phone: b.phone, p_spec: b.spec, p_summary: b.summary, p_note: b.note, p_img: b.img });

export type TrackedOrder = {
  ref: string; method?: string; status?: string; created_at?: string; eta?: string; invoiced?: boolean; gov?: string;
  items?: { name: string; qty: number }[];
  shipment?: { status?: string; kind?: string; carrier?: string; tracking?: string; log?: { s: string; at: string }[] } | null;
};
export type TrackedCustom = { ref: string; kind?: string; status?: string; summary?: string; img?: string; eta?: string; stages?: string[]; stage_idx?: number | null };

export async function trackOrder(ref: string, phone: string) {
  const r = await rpc<{ orders?: TrackedOrder[] }>('track_order', { p_ref: ref, p_phone: phone });
  if (!r.ok) throw new Error(r.message || 'err');
  return r.data?.orders ?? [];
}
export async function trackCustom(ref: string, phone: string) {
  try {
    const r = await rpc<{ orders?: TrackedCustom[] }>('track_custom', { p_ref: ref, p_phone: phone });
    return r.ok ? r.data?.orders ?? [] : [];
  } catch { return []; }
}

export type Review = { name: string; rating: number; body?: string };
export async function listReviews(): Promise<Review[]> {
  try {
    const r = await rpc<Review[]>('list_reviews', { p_product: null });
    return Array.isArray(r.data) ? r.data : [];
  } catch { return []; }
}
export const addReview = (name: string, rating: number, body: string) => rpc('add_review', { p_name: name, p_rating: rating, p_body: body, p_product: null });
export const addNotifyMe = (id: string, pname: string, name: string, phone: string) =>
  rpc('add_notify_me', { p_product: id, p_pname: pname, p_name: name, p_phone: phone });

/** One visit count per page per browser session (just a number in the system). */
export function bumpVisit(page: 'shop' | 'custom' | 'story') {
  try {
    const k = 'mkv_' + page;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    rpc('bump_visit', { p_page: page }).catch(() => {});
  } catch { /* storage blocked */ }
}

// ---- customer account page (private link) ----
export async function portalGet(token: string) {
  const r = await rpc<PortalData | null>('mk_portal_get', { p_token: token });
  if (!r.ok) throw new Error(r.message);
  return r.data;
}
export async function portalSend(token: string, body: string, media: { u: string; t: 'i' | 'v' }[]) {
  const r = await rpc<boolean>('mk_portal_send', { p_token: token, p_body: body, p_media: media });
  if (!r.ok) throw new Error('RPC:' + r.message);
  return !!r.data;
}
export async function portalUpload(token: string, f: File, i: number) {
  const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const p = `${token}/${Date.now()}-${i}.${ext}`;
  // Some phones send an empty or odd type: decide from the extension (the bucket only accepts these).
  const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
  const mt = MIME[ext] || (f.type && /^(image|video)\//.test(f.type) ? f.type : 'image/jpeg');
  const r = await fetch(`${SB_URL}/storage/v1/object/portal/${p}`, {
    method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': mt }, body: f,
  });
  if (!r.ok) { let t = ''; try { t = (await r.text()).slice(0, 120); } catch { /* */ } throw new Error('UP:' + r.status + (t ? ' ' + t : '')); }
  return { u: `${SB_URL}/storage/v1/object/public/portal/${p}`, t: mt.startsWith('video/') ? ('v' as const) : ('i' as const) };
}

export type PortalInvoice = { no: string; date: string; tot: number; paid: number; rem: number; recv?: string; miss?: string; got?: string; gotDate?: string; items?: { n: string; q: number; u?: string; t: number }[] };
export type PortalData = {
  name: string;
  snap?: { shop?: { name?: string; phone?: string }; at?: string; bal?: { amt: number; txt: string }; inv?: PortalInvoice[]; pays?: { date: string; note?: string; amount: number }[]; rets?: { date: string; n: string; q: number; t: number }[] };
  msgs?: { at: string; body: string; media?: unknown[] }[];
};
