// 📤 مسارات النشر على كل المنصات (السيرفر بتاع الستوديو). التفاصيل في lib/social/server.ts.
import type { NextRequest } from 'next/server';
import { testTok, cbUrl, connectUrl, finishConnect, getApps, getConns, igFinish, isAdmin, publish, setApps, setConns, sign, signedOk, SITE, whoami, type Apps } from '@/lib/social/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const NAMES: Record<string, string> = { facebook: 'فيسبوك', instagram: 'إنستجرام', youtube: 'يوتيوب', tiktok: 'تيك توك' };
const PROV: Record<string, string[]> = { meta: ['facebook', 'instagram'], google: ['youtube'], tiktok: ['tiktok'] };
/* رسايل المنصات بالإنجليزي → كلام مفهوم */
function arMsg(p: string, r: { ok: boolean; msg?: string; link?: string; pending?: string }) {
  if (r.ok || r.pending || !r.msg) return r; const m = r.msg, n = NAMES[p] || p;
  if (/OAuth|access token|session has expired|invalid_grant|token.*(expired|invalid)|access_token_invalid|Error validating/i.test(m)) return { ...r, msg: 'ربط ' + n + ' خلص أو اتلغى — دوس «اربط تاني» من «الحسابات المربوطة» (' + m.slice(0, 80) + ')' };
  if (/permission|scope|not authorized|requires/i.test(m)) return { ...r, msg: n + ' محتاج صلاحية ناقصة — اربط تاني ووافق على كل الصلاحيات (' + m.slice(0, 80) + ')' };
  if (/rate|limit|too many/i.test(m)) return { ...r, msg: n + ' قال استنى شوية (حد النشر) — جرّب بعد ساعة' };
  if (/aspect|resolution|duration|too (long|short)|format|codec|unsupported/i.test(m)) return { ...r, msg: n + ' رفض شكل الفيديو (المقاس أو المدة أو الصيغة) — ' + m.slice(0, 120) };
  return r;
}
const msgOf = (e: unknown) => String((e as Error)?.message || e).slice(0, 300);

export async function POST(req: NextRequest, ctx: { params: Promise<{ a: string[] }> }) {
  const act = (await ctx.params).a.join('/');
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const tok = String(b.tok || '');
  try {
    const u = await whoami(tok);
    if (!u) return json({ error: 'سجّل دخول الستوديو الأول' }, 401);

    if (act === 'status') {
      const [apps, conns] = await Promise.all([getApps(), getConns(u.id)]);
      return json({
        apps: { meta: !!apps.meta?.id, google: !!apps.google?.id, tiktok: !!apps.tiktok?.id },
        conns: Object.fromEntries(Object.entries(conns).map(([k, c]) => [k, { name: c!.name }])),
      });
    }
    if (act === 'apps-get' || act === 'apps-set') {
      if (!(await isAdmin(tok))) return json({ error: 'للأدمن بس' }, 403);
      const apps = await getApps();
      if (act === 'apps-set') {
        const n: Apps = { ...apps };
        for (const k of ['meta', 'google', 'tiktok'] as const) {
          const x = b.apps?.[k]; if (!x) continue;
          const id = String(x.id || '').trim(), secret = String(x.secret || '').trim();
          if (!id) { delete n[k]; continue; }
          n[k] = { id, secret: secret || apps[k]?.secret || '' };          // السر الفاضي = سيب القديم
        }
        await setApps(n);
        return json({ ok: true, apps: { meta: !!n.meta?.id, google: !!n.google?.id, tiktok: !!n.tiktok?.id } });
      }
      return json({ apps: { meta: apps.meta ? { id: apps.meta.id, secret: !!apps.meta.secret } : null, google: apps.google ? { id: apps.google.id, secret: !!apps.google.secret } : null, tiktok: apps.tiktok ? { id: apps.tiktok.id, secret: !!apps.tiktok.secret } : null }, cb: { meta: cbUrl('meta'), google: cbUrl('google'), tiktok: cbUrl('tiktok') }, site: SITE });
    }
    if (act === 'connect') {
      const p = String(b.provider || '') as 'meta' | 'google' | 'tiktok'; if (!PROV[p]) return json({ error: 'منصة مش معروفة' }, 400);
      const apps = await getApps(); const back = String(b.back || SITE + '/').startsWith(SITE) ? String(b.back || SITE + '/') : SITE + '/';
      const st = Buffer.from(JSON.stringify({ u: u.id, p, back, t: Date.now() })).toString('base64url'), state = st + '.' + sign(st);
      const url = connectUrl(p, apps, state);
      if (!url) return json({ error: 'مفاتيح ' + (p === 'meta' ? 'فيسبوك/إنستجرام' : p === 'google' ? 'يوتيوب' : 'تيك توك') + ' لسه ماتحطّتش في لوحة التحكم (مرة واحدة من الأدمن)' }, 400);
      return json({ url });
    }
    if (act === 'disconnect') {
      const conns = await getConns(u.id); for (const k of PROV[String(b.provider)] || [String(b.platform)]) delete (conns as any)[k];
      await setConns(u.id, conns); return json({ ok: true });
    }
    if (act === 'publish') {
      const p = String(b.platform || ''); if (!NAMES[p]) return json({ error: 'منصة مش معروفة' }, 400);
      const url = String(b.url || ''); if (!/^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//.test(url)) return json({ error: 'الملف لازم يكون مرفوع على مخزن الستوديو' }, 400);
      const [apps, conns] = await Promise.all([getApps(), getConns(u.id)]);
      if (!(conns as any)[p]) return json({ ok: false, msg: NAMES[p] + ' مش مربوط' });
      const r = await publish(p, { url, kind: b.kind === 'image' ? 'image' : 'video', caption: String(b.caption || ''), title: String(b.title || ''), size: Number(b.size) || 0, type: String(b.type || '') }, apps, conns, u.id);
      return json(arMsg(p, r));
    }
    if (act === 'test-conns' && testTok(tok)) { await setConns(u.id, b.conns || {}); return json({ ok: true }); }
    if (act === 'ig-finish') {
      const conns = await getConns(u.id); if (!conns.instagram) return json({ ok: false, msg: 'إنستجرام مش مربوط' });
      return json(arMsg('instagram', await igFinish(String(b.id || ''), conns, 50000)));
    }
    return json({ error: 'مش معروف' }, 404);
  } catch (e) {
    return json({ ok: false, error: msgOf(e), msg: msgOf(e) }, 500);
  }
}

/* رجوع المنصة بعد الموافقة: /api/social/cb/<meta|google|tiktok>?code&state */
export async function GET(req: NextRequest, ctx: { params: Promise<{ a: string[] }> }) {
  const [cb, p] = (await ctx.params).a;
  const back = (q: string, base = SITE + '/') => Response.redirect(base + (base.includes('?') ? '&' : '?') + q, 302);
  if (cb !== 'cb' || !PROV[p]) return json({ error: 'مش معروف' }, 404);
  const sp = req.nextUrl.searchParams, state = sp.get('state') || '', [st, sig] = state.split('.');
  if (!st || !signedOk(st, sig)) return back('social=err&msg=' + encodeURIComponent('الرابط ده مش سليم — ابدأ الربط تاني'));
  let s: { u: string; p: string; back: string; t: number };
  try { s = JSON.parse(Buffer.from(st, 'base64url').toString('utf8')); } catch { return back('social=err'); }
  if (s.p !== p || Date.now() - s.t > 30 * 60000) return back('social=err&msg=' + encodeURIComponent('الربط اتأخر — ابدأ تاني'), s.back);
  const err = sp.get('error_description') || sp.get('error') || sp.get('error_message');
  if (err || !sp.get('code')) return back('social=err&msg=' + encodeURIComponent(err || 'المنصة مارجّعتش موافقة'), s.back);
  try {
    const [apps, conns] = await Promise.all([getApps(), getConns(s.u)]);
    const got = await finishConnect(p, sp.get('code')!, apps, conns);
    await setConns(s.u, conns);
    return back('social=ok&got=' + encodeURIComponent(got), s.back);
  } catch (e) {
    return back('social=err&msg=' + encodeURIComponent(msgOf(e)), s.back);
  }
}
