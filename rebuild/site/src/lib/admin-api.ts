// Owner admin → Supabase, same protocol the old shop.html admin used:
//  1) sign in with the system's email + password (Supabase Auth),
//  2) check the account is the owner (app_state is readable by the owner only),
//  3) save with an optimistic version check (PATCH … version=eq.N) so two editors never overwrite each other.
// The session stays in memory only (a reload signs out), nothing is stored in the browser.
import { SB_KEY, SB_URL } from './config';

export type Session = { at: string; rt: string };
export type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type SiteDoc = { data: Rec; version: number };

let SES: Session | null = null;
export const signedIn = () => !!SES;
export const token = () => SES?.at ?? '';
export function logout() { SES = null; }

async function auth(grant: 'password' | 'refresh_token', body: unknown): Promise<Session> {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || j.message || `HTTP ${r.status}`);
  return { at: j.access_token, rt: j.refresh_token };
}

/** fetch with the owner's token; one silent refresh when it expired. */
async function sb(path: string, init: RequestInit = {}): Promise<Response> {
  const go = () => fetch(SB_URL + path, { ...init, cache: 'no-store', headers: { apikey: SB_KEY, ...(SES ? { Authorization: 'Bearer ' + SES.at } : {}), ...(init.headers as Record<string, string> | undefined) } });
  let r = await go();
  if (r.status === 401 && SES?.rt) {
    try { SES = await auth('refresh_token', { refresh_token: SES.rt }); r = await go(); } catch { SES = null; }
  }
  return r;
}

export async function login(email: string, password: string) {
  SES = await auth('password', { email, password });
  const r = await sb('/rest/v1/app_state?select=owner&limit=1');
  const rows = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(rows) || !rows.length) { SES = null; throw new Error('الحساب ده مش صاحب الموقع'); }
}

export async function loadDoc(): Promise<SiteDoc> {
  const r = await sb('/rest/v1/site_content?id=eq.main&select=data,version');
  const rows = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(rows) || !rows.length) throw new Error('مقدرتش أقرا بيانات الموقع');
  return { data: rows[0].data ?? {}, version: rows[0].version ?? 1 };
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/** Read the newest version, apply `edit` to a copy, save it only if nobody saved in between (else read again and retry). */
export async function saveDoc(edit: (d: Rec) => void, allow: ('products' | 'works' | 'reviews' | 'pros')[] = []): Promise<SiteDoc> {
  for (let t = 0; t < 4; t++) {
    const cur = await loadDoc();
    const d = clone(cur.data);
    edit(d);
    // Safety net: only the screen that owns products / works / reviews may add or remove them (`allow`), any other save must keep the counts.
    for (const k of ['products', 'works', 'reviews', 'pros'] as const) {
      if (!allow.includes(k) && (cur.data[k]?.length ?? 0) !== (d[k]?.length ?? 0)) throw new Error('الحفظ اتلغى: كان هيغيّر في ' + k);
    }
    const r = await sb(`/rest/v1/site_content?id=eq.main&version=eq.${cur.version}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data: d, version: cur.version + 1, updated_at: new Date().toISOString() }),
    });
    const rows = await r.json().catch(() => null);
    if (r.status === 409) continue;
    if (!r.ok) throw new Error(`تعذر الحفظ (${r.status})`);
    if (Array.isArray(rows) && rows.length) return { data: rows[0].data, version: rows[0].version };
    // no row changed: somebody saved first (try again with the newest version) or this account can't write
  }
  throw new Error('في تعديل تاني على الموقع في نفس اللحظة، أو مفيش صلاحية. حدّث الصفحة وجرّب تاني.');
}

/** Upload a photo to the public site-images bucket; returns its public URL. */
export async function uploadImage(blob: Blob): Promise<string> {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `img/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const r = await sb(`/storage/v1/object/site-images/${path}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', 'cache-control': 'max-age=31536000' }, body: blob });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch { /* */ } throw new Error(`رفع الصورة فشل (${r.status}) ${m}`); }
  return `${SB_URL}/storage/v1/object/public/site-images/${path}`;
}

/** Ask the site to refresh its pages right now (server checks the owner token). Best effort. */
export async function publishNow() {
  try { await fetch('/api/admin/revalidate', { method: 'POST', headers: { Authorization: 'Bearer ' + token() } }); } catch { /* the page refreshes by itself within a minute */ }
}
