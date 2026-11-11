// 🔗 جسر «قراية بس» بين الستوديو وسيستم ميكانيزم (mekanizm-api) وموقع ميكانيزم.
// - الدخول بحساب السيستم (موبايل/إيميل + كلمة السر) بيتعمل من الشاشة: الجسر بيبعته للسيستم ويرجّع التوكن للمتصفح
//   (السيستم بيحطه في كوكي mk_at/mk_rt على دومينه، فالجسر بيقراه ويرجّعه، ومابيحفظش أي حاجة عنده).
// - بعد كده كل طلب GET بيعدّي بالتوكن على قايمة مسموحة بس (منتجات، تفاصيلها، الأقسام، صور الملفات، بيانات الموقع العامة).
// - مفيش ولا طلب تعديل بيعدّي: الستوديو بيقرا من السيستم ومابيغيّرش فيه حاجة.
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
const API = (process.env.MK_API_URL || 'https://mekanizm-api.vercel.app').replace(/\/+$/, '') + '/api/v1';

// المسارات المسموح بقرايتها (GET بس)
const ALLOW: RegExp[] = [
  /^products\/all$/,
  /^products\/categories$/,
  /^products\/lookup$/,
  /^products\/info\/all$/,
  /^products\/[\w-]{1,64}$/,
  /^products\/[\w-]{1,64}\/info$/,
  /^work\/files\/[\w.-]{1,120}$/,
  /^web\/public\/site$/,
  /^web\/public\/stock$/,
  /^auth\/me$/,
];

const cookieOf = (sc: string[], name: string) => {
  for (const c of sc) { const m = c.match(new RegExp('^' + name + '=([^;]*)')); if (m && m[1]) return decodeURIComponent(m[1]); }
  return '';
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const setCookies = (r: Response): string[] => {
  const h = r.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const one = r.headers.get('set-cookie');
  return one ? one.split(/,(?=\s*mk_)/) : [];
};
const errMsg = (j: any, d: string) => (j && typeof j.error === 'object' && j.error ? j.error.message : '') || (j && j.message) || (j && typeof j.error === 'string' ? j.error : '') || d;
async function backendJson(r: Response) { const t = await r.text(); try { return JSON.parse(t); } catch { return { message: t.slice(0, 200) }; } }

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = (await ctx.params).path.join('/');
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  try {
    if (p === 'login') {
      const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: String(body.login || ''), password: String(body.password || '') }), cache: 'no-store' });
      const j = await backendJson(r);
      if (!r.ok) return json({ error: errMsg(j, 'الدخول ماتمّش') }, r.status);
      const sc = setCookies(r), at = cookieOf(sc, 'mk_at'), rt = cookieOf(sc, 'mk_rt');
      if (!at) return json({ error: 'السيستم مارجّعش جلسة' }, 502);
      return json({ at, rt, user: j.user || null });
    }
    if (p === 'refresh') {
      const rt = String(body.rt || '');
      if (!rt) return json({ error: 'الجلسة خلصت، سجّل دخول تاني' }, 401);
      const r = await fetch(API + '/auth/refresh', { method: 'POST', headers: { cookie: 'mk_rt=' + encodeURIComponent(rt), 'content-type': 'application/json' }, body: '{}', cache: 'no-store' });
      const j = await backendJson(r);
      if (!r.ok) return json({ error: errMsg(j, 'الجلسة خلصت، سجّل دخول تاني') }, r.status);
      const sc = setCookies(r);
      return json({ at: cookieOf(sc, 'mk_at'), rt: cookieOf(sc, 'mk_rt') || rt, user: j.user || null });
    }
    return json({ error: 'مش مسموح' }, 404);
  } catch (e) {
    return json({ error: 'السيستم مش بيرد: ' + String((e as Error).message || e).slice(0, 120) }, 502);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const p = (await ctx.params).path.join('/');
  if (!ALLOW.some((re) => re.test(p))) return json({ error: 'مش مسموح' }, 404);
  const at = req.headers.get('x-mk-at') || '';
  const qs = req.nextUrl.search || '';
  try {
    const r = await fetch(API + '/' + p + qs, { headers: at ? { cookie: 'mk_at=' + encodeURIComponent(at), authorization: 'Bearer ' + at } : {}, cache: 'no-store' });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    if (/^image\/|octet-stream/.test(ct) || p.startsWith('work/files/')) {
      const buf = await r.arrayBuffer();
      return new Response(buf, { status: r.status, headers: { 'content-type': ct, 'cache-control': r.ok ? 'private, max-age=86400' : 'no-store' } });
    }
    const t = await r.text();
    return new Response(t, { status: r.status, headers: { 'content-type': ct, 'cache-control': 'no-store' } });
  } catch (e) {
    return json({ error: 'السيستم مش بيرد: ' + String((e as Error).message || e).slice(0, 120) }, 502);
  }
}
