// 📤 «انشر مرة واحدة على كل المنصات» — الجزء اللي على سيرفر الستوديو (Vercel).
// - الهوية: توكن دخول الستوديو (Supabase mekanizm-app) بيتأكد منه في كل طلب.
// - مفاتيح المنصات (Meta / Google / TikTok) بيدخّلها الأدمن مرة واحدة من /admin، وتوكنات كل مستخدم بعد الربط:
//   الاتنين بيتحفظوا مشفّرين AES-256-GCM في مخزن Vercel Blob (المفتاح مشتق من BLOB_READ_WRITE_TOKEN اللي على السيرفر بس).
//   مفيش أي سر بيوصل للمتصفح، ومفيش جداول جديدة في قاعدة البيانات.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { del, list, put } from '@vercel/blob';

export const SB_URL = 'https://rzvncstjattlklpdtkfn.supabase.co';
export const SB_KEY = 'sb_publishable_Molr1fCzsC-VbSgTFDXc5w_F1p0-Fcr';
export const SITE = (process.env.STUDIO_URL || 'https://mekanezm-studio.vercel.app').replace(/\/+$/, '');
const BT = () => process.env.BLOB_READ_WRITE_TOKEN || '';
const KEY = () => createHash('sha256').update('mkz-social-v1:' + BT()).digest();
export const GV = 'v21.0';

export type Apps = { meta?: { id: string; secret: string }; google?: { id: string; secret: string }; tiktok?: { id: string; secret: string } };
export type Conn = { account_id: string; name: string; token: string; refresh?: string; expires_at?: number; extra?: Record<string, unknown> };
export type Conns = Partial<Record<'facebook' | 'instagram' | 'youtube' | 'tiktok', Conn>>;

/* ---------- تشفير ---------- */
function enc(o: unknown): Buffer { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', KEY(), iv); const b = Buffer.concat([c.update(JSON.stringify(o), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]); }
function dec<T>(buf: Buffer): T { const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), d = createDecipheriv('aes-256-gcm', KEY(), iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')); }
export function sign(s: string) { return createHmac('sha256', KEY()).update(s).digest('base64url'); }
export function signedOk(s: string, sig: string) { const a = Buffer.from(sign(s)), b = Buffer.from(sig || ''); return a.length === b.length && timingSafeEqual(a, b); }

/* ---------- تخزين مشفّر في Blob (آخر نسخة بس) ---------- */
async function readSec<T>(prefix: string, d: T): Promise<T> {
  if (!BT()) throw new Error('مخزن الملفات مش متوصل بالستوديو');
  const r = await list({ prefix, token: BT(), limit: 20 });
  const b = r.blobs.sort((x, y) => +new Date(y.uploadedAt) - +new Date(x.uploadedAt))[0];
  if (!b) return d;
  const f = await fetch(b.url, { cache: 'no-store' }); if (!f.ok) return d;
  try { return dec<T>(Buffer.from(await f.arrayBuffer())); } catch { return d; }
}
async function writeSec(prefix: string, o: unknown) {
  const old = await list({ prefix, token: BT(), limit: 50 });
  await put(prefix + Date.now() + '.bin', enc(o), { access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream', token: BT(), cacheControlMaxAge: 60 });
  if (old.blobs.length) await del(old.blobs.map((b) => b.url), { token: BT() }).catch(() => {});
}
// الاختبار المحلي بيكتب في فولدر منفصل (sec-test) عشان مايلمسش بيانات الستوديو الحقيقية
const PFX = () => (process.env.MKZ_TEST_TOKEN && !process.env.VERCEL ? 'sec-test/' : 'sec/');
export const getApps = () => readSec<Apps>(PFX() + 'apps/', {});
export const setApps = (a: Apps) => writeSec(PFX() + 'apps/', a);
export const getConns = (uid: string) => readSec<Conns>(PFX() + 'u/' + uid + '/', {});
export const setConns = (uid: string, c: Conns) => writeSec(PFX() + 'u/' + uid + '/', c);

/* ---------- الهوية ---------- */
/* اختبار محلي بس: لو MKZ_TEST_TOKEN متسجل في بيئة الجهاز (مش موجود على Vercel خالص) */
export const testTok = (tok: string) => !!process.env.MKZ_TEST_TOKEN && process.env.MKZ_TEST_TOKEN.length >= 24 && tok === process.env.MKZ_TEST_TOKEN && !process.env.VERCEL;
export async function whoami(tok: string): Promise<{ id: string; email: string } | null> {
  if (!tok) return null;
  if (testTok(tok)) return { id: 'test-local-0000', email: 'test@local' };
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + tok, apikey: SB_KEY }, cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return null; const u = await r.json().catch(() => null); return u && u.id ? { id: u.id, email: u.email || '' } : null;
}
export async function isAdmin(tok: string): Promise<boolean> {
  if (testTok(tok)) return true;
  const r = await fetch(SB_URL + '/rest/v1/rpc/app_is_admin', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return false; return (await r.json().catch(() => false)) === true;
}

/* ---------- الربط (OAuth) ---------- */
export const cbUrl = (p: string) => SITE + '/api/social/cb/' + p;
export function connectUrl(p: 'meta' | 'google' | 'tiktok', apps: Apps, state: string) {
  if (p === 'meta' && apps.meta?.id) return `https://www.facebook.com/${GV}/dialog/oauth?` + new URLSearchParams({ client_id: apps.meta.id, redirect_uri: cbUrl('meta'), state, response_type: 'code', scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management' });
  if (p === 'google' && apps.google?.id) return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: apps.google.id, redirect_uri: cbUrl('google'), state, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly' });
  if (p === 'tiktok' && apps.tiktok?.id) return 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({ client_key: apps.tiktok.id, redirect_uri: cbUrl('tiktok'), state, response_type: 'code', scope: 'user.info.basic,video.upload,video.publish' });
  return '';
}
const J = async (r: Response) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; } };
const errOf = (j: any, d: string) => (j && (j.error?.message || j.error_description || j.error?.code || (typeof j.error === 'string' ? j.error : '') || j.message)) || d;

export async function finishConnect(p: string, code: string, apps: Apps, conns: Conns): Promise<string> {
  if (p === 'meta') {
    const a = apps.meta!; const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
    let j = await J(await fetch(`https://graph.facebook.com/${GV}/oauth/access_token?` + q({ client_id: a.id, client_secret: a.secret, redirect_uri: cbUrl('meta'), code })));
    if (!j.access_token) throw new Error(errOf(j, 'فيسبوك مارجّعش مفتاح'));
    const ll = await J(await fetch(`https://graph.facebook.com/${GV}/oauth/access_token?` + q({ grant_type: 'fb_exchange_token', client_id: a.id, client_secret: a.secret, fb_exchange_token: j.access_token })));
    const ut = ll.access_token || j.access_token;
    j = await J(await fetch(`https://graph.facebook.com/${GV}/me/accounts?` + q({ fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '50', access_token: ut })));
    const pages = (j.data || []) as any[]; if (!pages.length) throw new Error('مفيش صفحة فيسبوك على الحساب ده (لازم تكون أدمن على صفحة المحل)');
    const pg = pages.find((x) => x.instagram_business_account) || pages[0];
    conns.facebook = { account_id: pg.id, name: pg.name, token: pg.access_token, extra: { pages: pages.map((x) => ({ id: x.id, name: x.name })) } };
    if (pg.instagram_business_account) conns.instagram = { account_id: pg.instagram_business_account.id, name: '@' + (pg.instagram_business_account.username || ''), token: pg.access_token };
    else delete conns.instagram;
    return pg.instagram_business_account ? 'facebook,instagram' : 'facebook';
  }
  if (p === 'google') {
    const a = apps.google!;
    const j = await J(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: a.id, client_secret: a.secret, redirect_uri: cbUrl('google'), grant_type: 'authorization_code' }) }));
    if (!j.access_token) throw new Error(errOf(j, 'جوجل مارجّعش مفتاح'));
    const ch = await J(await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + j.access_token } }));
    const c = (ch.items || [])[0]; if (!c) throw new Error('مفيش قناة يوتيوب على الحساب ده');
    conns.youtube = { account_id: c.id, name: c.snippet?.title || 'يوتيوب', token: j.access_token, refresh: j.refresh_token || conns.youtube?.refresh || '', expires_at: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
    return 'youtube';
  }
  if (p === 'tiktok') {
    const a = apps.tiktok!;
    const j = await J(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: a.id, client_secret: a.secret, code, grant_type: 'authorization_code', redirect_uri: cbUrl('tiktok') }) }));
    if (!j.access_token) throw new Error(errOf(j, 'تيك توك مارجّعش مفتاح'));
    const u = await J(await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: 'Bearer ' + j.access_token } }));
    conns.tiktok = { account_id: j.open_id || '', name: u?.data?.user?.display_name || 'تيك توك', token: j.access_token, refresh: j.refresh_token || '', expires_at: Date.now() + (j.expires_in || 86400) * 1000 - 60000 };
    return 'tiktok';
  }
  throw new Error('منصة مش معروفة');
}

/* تجديد التوكن قبل ما يخلص (يوتيوب ساعة، تيك توك يوم) */
async function fresh(p: 'youtube' | 'tiktok', apps: Apps, conns: Conns, uid: string): Promise<Conn> {
  const c = conns[p]!; if (!c.expires_at || Date.now() < c.expires_at) return c;
  if (!c.refresh) throw new Error('الربط خلص — اربط ' + (p === 'youtube' ? 'يوتيوب' : 'تيك توك') + ' تاني');
  let j: any;
  if (p === 'youtube') j = await J(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: apps.google!.id, client_secret: apps.google!.secret, refresh_token: c.refresh, grant_type: 'refresh_token' }) }));
  else j = await J(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: apps.tiktok!.id, client_secret: apps.tiktok!.secret, refresh_token: c.refresh, grant_type: 'refresh_token' }) }));
  if (!j.access_token) throw new Error('الربط خلص — اربط تاني (' + errOf(j, '') + ')');
  c.token = j.access_token; if (j.refresh_token) c.refresh = j.refresh_token; c.expires_at = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
  conns[p] = c; await setConns(uid, conns); return c;
}

/* ---------- النشر ---------- */
export type Pub = { url: string; kind: 'video' | 'image'; caption: string; title: string; size: number; type: string };
export type Res = { ok: boolean; link?: string; pending?: string; msg?: string };

export async function publish(p: string, x: Pub, apps: Apps, conns: Conns, uid: string): Promise<Res> {
  const cap = String(x.caption || '').slice(0, 2200);
  if (p === 'facebook') {
    const c = conns.facebook!; const body = new URLSearchParams({ access_token: c.token });
    let j: any;
    if (x.kind === 'video') { body.set('file_url', x.url); body.set('description', cap); if (x.title) body.set('title', x.title.slice(0, 250)); j = await J(await fetch(`https://graph-video.facebook.com/${GV}/${c.account_id}/videos`, { method: 'POST', body })); }
    else { body.set('url', x.url); body.set('caption', cap); j = await J(await fetch(`https://graph.facebook.com/${GV}/${c.account_id}/photos`, { method: 'POST', body })); }
    if (!j.id && !j.post_id) return { ok: false, msg: errOf(j, 'فيسبوك رفض') };
    return { ok: true, link: 'https://www.facebook.com/' + (j.post_id || j.id), msg: x.kind === 'video' ? 'اتنشر (فيسبوك بيجهّز الفيديو دقيقة)' : 'اتنشر' };
  }
  if (p === 'instagram') {
    const c = conns.instagram!; const body = new URLSearchParams({ access_token: c.token, caption: cap });
    if (x.kind === 'video') { body.set('media_type', 'REELS'); body.set('video_url', x.url); body.set('share_to_feed', 'true'); } else body.set('image_url', x.url);
    const j = await J(await fetch(`https://graph.facebook.com/${GV}/${c.account_id}/media`, { method: 'POST', body }));
    if (!j.id) return { ok: false, msg: errOf(j, 'إنستجرام رفض') };
    return igFinish(j.id, conns, 70000);
  }
  if (p === 'youtube') {
    if (x.kind !== 'video') return { ok: false, msg: 'يوتيوب للفيديو بس' };
    const c = await fresh('youtube', apps, conns, uid);
    const title = (x.title || cap.split('\n')[0] || 'ميكانيزم').replace(/[<>]/g, '').slice(0, 90) + (/#shorts/i.test(cap) ? '' : ' #Shorts');
    const tags = [...new Set((cap.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.slice(1)))].slice(0, 15);
    const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': x.type || 'video/mp4', 'X-Upload-Content-Length': String(x.size) },
      body: JSON.stringify({ snippet: { title: title.slice(0, 100), description: cap.slice(0, 4900), tags, categoryId: '26', defaultLanguage: 'ar' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } }),
    });
    const loc = init.headers.get('location'); if (!init.ok || !loc) return { ok: false, msg: errOf(await J(init), 'يوتيوب رفض') };
    const src = await fetch(x.url); if (!src.ok || !src.body) return { ok: false, msg: 'مقدرتش أقرا الفيديو من المخزن' };
    const up = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': x.type || 'video/mp4', 'Content-Length': String(x.size) }, body: src.body, duplex: 'half' } as RequestInit);
    const j = await J(up); if (!up.ok || !j.id) return { ok: false, msg: errOf(j, 'الرفع على يوتيوب وقف') };
    return { ok: true, link: 'https://youtube.com/shorts/' + j.id, msg: 'اتنشر' };
  }
  if (p === 'tiktok') {
    if (x.kind !== 'video') return { ok: false, msg: 'صور تيك توك مش مدعومة لسه — الفيديو بس' };
    const c = await fresh('tiktok', apps, conns, uid);
    const MB = 1024 * 1024, chunk = x.size <= 64 * MB ? x.size : 20 * MB, total = Math.max(1, Math.floor(x.size / chunk));
    const src = { source: 'FILE_UPLOAD', video_size: x.size, chunk_size: chunk, total_chunk_count: total };
    const H = { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json; charset=UTF-8' };
    let draft = false;
    let j = await J(await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: H, body: JSON.stringify({ post_info: { title: cap.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE', disable_comment: false, disable_duet: false, disable_stitch: false }, source_info: src }) }));
    if (!j?.data?.upload_url) {
      // التطبيق لسه ماتراجعش من تيك توك: بيترفع مسودة في تيك توك ويتنشر بدوسة من الأبلكيشن
      draft = true;
      j = await J(await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', { method: 'POST', headers: H, body: JSON.stringify({ source_info: src }) }));
      if (!j?.data?.upload_url) return { ok: false, msg: errOf(j, 'تيك توك رفض') };
    }
    const up = j.data.upload_url as string;
    for (let i = 0; i < total; i++) {
      const a = i * chunk, b = i === total - 1 ? x.size - 1 : a + chunk - 1;
      const part = await fetch(x.url, { headers: { Range: `bytes=${a}-${b}` } }); if (!part.ok) return { ok: false, msg: 'مقدرتش أقرا الفيديو من المخزن' };
      const buf = Buffer.from(await part.arrayBuffer());
      const r = await fetch(up, { method: 'PUT', headers: { 'Content-Type': x.type || 'video/mp4', 'Content-Length': String(buf.length), 'Content-Range': `bytes ${a}-${b}/${x.size}` }, body: buf });
      if (!r.ok && r.status !== 206) return { ok: false, msg: 'الرفع على تيك توك وقف (' + r.status + ')' };
    }
    return { ok: true, msg: draft ? 'وصل تيك توك كمسودة — افتح تيك توك من الإشعار ودوس «نشر» (لحد ما تيك توك يوافق على التطبيق)' : 'اترفع — تيك توك بيجهّزه وهيظهر على حسابك خلال دقايق' };
  }
  return { ok: false, msg: 'منصة مش معروفة' };
}

/* إنستجرام بيجهّز الفيديو الأول وبعدين ينشر: لو لسه بيجهّز بنرجّع pending والشاشة بتسأل تاني */
export async function igFinish(id: string, conns: Conns, waitMs: number): Promise<Res> {
  const c = conns.instagram!; const t0 = Date.now();
  while (true) {
    const s = await J(await fetch(`https://graph.facebook.com/${GV}/${id}?fields=status_code,status&access_token=${encodeURIComponent(c.token)}`));
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') return { ok: false, msg: 'إنستجرام ماقدرش يجهّز الفيديو: ' + (s.status || s.status_code) };
    if (s.status_code === 'FINISHED' || s.status_code === 'PUBLISHED' || !s.status_code) break;
    if (Date.now() - t0 > waitMs) return { ok: false, pending: id, msg: 'إنستجرام لسه بيجهّز الفيديو…' };
    await new Promise((r) => setTimeout(r, 4000));
  }
  const j = await J(await fetch(`https://graph.facebook.com/${GV}/${c.account_id}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: id, access_token: c.token }) }));
  if (!j.id) return { ok: false, msg: errOf(j, 'إنستجرام رفض النشر') };
  const pl = await J(await fetch(`https://graph.facebook.com/${GV}/${j.id}?fields=permalink&access_token=${encodeURIComponent(c.token)}`));
  return { ok: true, link: pl.permalink || 'https://www.instagram.com/', msg: 'اتنشر' };
}
