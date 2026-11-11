'use client';
// 🛠️ لوحة تحكم ميكانيزم ستوديو (المشتركين، التجديد، التجربة المجانية، البوابة) — Next.js بدل admin.html القديم، نفس الوظايف بالظبط.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = 'https://rzvncstjattlklpdtkfn.supabase.co', KEY = 'sb_publishable_Molr1fCzsC-VbSgTFDXc5w_F1p0-Fcr';
type Row = { owner: string; name?: string; email?: string; phone?: string; status: string; trial_end?: string; paid_until?: string; created_at?: string; last_seen?: string; note?: string; blocked?: boolean };
const ST: Record<string, string> = { trial: 'تجربة', active: 'مشترك', expired: 'خلصت', blocked: 'موقوف' };
const CHIP: Record<string, string> = { trial: '#3b82f6', active: '#2fbf6b', expired: '#e0a030', blocked: '#ff6b6b' };
const dl = (r: Row) => { const t = r.status === 'active' ? r.paid_until : r.trial_end; if (!t) return 0; return Math.max(0, Math.ceil((+new Date(t) - Date.now()) / 864e5)); };
const fd = (t?: string) => (t ? new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—');
const ago = (t?: string) => { if (!t) return 'ما دخلش'; const m = Math.floor((Date.now() - +new Date(t)) / 6e4); return m < 2 ? 'دلوقتي' : m < 60 ? 'من ' + m + ' دقيقة' : m < 1440 ? 'من ' + Math.floor(m / 60) + ' ساعة' : 'من ' + Math.floor(m / 1440) + ' يوم'; };

export default function AdminApp() {
  const sbRef = useRef<SupabaseClient | null>(null);
  const [mode, setMode] = useState<'wait' | 'login' | 'app'>('wait');
  const [em, setEm] = useState(''), [pw, setPw] = useState(''), [lm, setLm] = useState('');
  const [rows, setRows] = useState<Row[]>([]), [who, setWho] = useState(''), [q, setQ] = useState('');
  const [gate, setGate] = useState(false), [td, setTd] = useState('7'), [ct, setCt] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({}), [busy, setBusy] = useState(''), [msg, setMsg] = useState('');
  const note = (m: string, ms = 2600) => { setMsg(m); window.setTimeout(() => setMsg(''), ms); };
  // 🔗 مفاتيح المنصات (مرة واحدة): بتتحفظ مشفّرة على سيرفر الستوديو، والسر مابيرجعش للشاشة تاني
  type AK = 'meta' | 'google' | 'tiktok';
  const [apps, setAppsS] = useState<Record<AK, { id: string; secret: string; has: boolean }>>({ meta: { id: '', secret: '', has: false }, google: { id: '', secret: '', has: false }, tiktok: { id: '', secret: '', has: false } });
  const [cbs, setCbs] = useState<Record<string, string>>({});
  const stok = async () => (await sbRef.current!.auth.getSession()).data.session?.access_token || '';
  const loadApps = useCallback(async () => { try { const r = await fetch('/api/social/apps-get', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tok: await stok() }) }); const j = await r.json(); if (!r.ok) return; setCbs(j.cb || {}); setAppsS((o) => { const n = { ...o }; (['meta', 'google', 'tiktok'] as AK[]).forEach((k) => { const a = j.apps?.[k]; n[k] = { id: a?.id || '', secret: '', has: !!a?.secret }; }); return n; }); } catch { /* */ } }, []);
  const saveApps = async () => { const r = await fetch('/api/social/apps-set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tok: await stok(), apps: Object.fromEntries((['meta', 'google', 'tiktok'] as AK[]).map((k) => [k, { id: apps[k].id, secret: apps[k].secret }])) }) }); const j = await r.json().catch(() => ({})); if (!r.ok) return note('فشل: ' + (j.error || r.status), 4000); note('اتحفظت مفاتيح المنصات ✅'); loadApps(); };

  const load = useCallback(async () => {
    const sb = sbRef.current; if (!sb) return;
    const r = await sb.rpc('studio_admin_list');
    if (r.error) {
      if (/not_admin/.test(r.error.message)) { setMode('login'); setLm('الحساب ده مش أدمن. ادخل بإيميل الأدمن (المسجّل في app_admins).'); await sb.auth.signOut().catch(() => {}); return; }
      note('خطأ: ' + r.error.message, 4000); return;
    }
    const data = (r.data || []) as Row[]; setRows(data); setNotes(Object.fromEntries(data.map((x) => [x.owner, x.note || '']))); setMode('app');
    const me = (await sb.auth.getUser()).data.user; setWho(me?.email || '');
    const c = await fetch(URL_ + '/rest/v1/rpc/studio_public_cfg', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' }).then((x) => x.json()).catch(() => ({}));
    setGate(!!c.gate); setTd(String(c.trial_days == null ? 7 : c.trial_days)); setCt(c.contact || '');
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    const sb = createClient(URL_, KEY, { auth: { lock: (_n: string, _t: number, fn: () => Promise<unknown>) => fn() } as never });
    sbRef.current = sb;
    const { data: sub } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN') load(); if (ev === 'SIGNED_OUT') setMode('login'); });
    sb.auth.getSession().then(({ data }) => (data.session ? load() : setMode('login')));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const login = async () => { const sb = sbRef.current!; if (!em.trim() || !pw) return setLm('اكتب الإيميل والباسورد'); setLm('ثانية…'); const r = await sb.auth.signInWithPassword({ email: em.trim(), password: pw }); if (r.error) setLm(/invalid/i.test(r.error.message) ? 'الإيميل أو الباسورد غلط' : r.error.message); };
  const mail = async () => { const sb = sbRef.current!; if (!em.trim()) return setLm('اكتب الإيميل'); const r = await sb.auth.signInWithOtp({ email: em.trim(), options: { emailRedirectTo: location.href } }); setLm(r.error ? r.error.message : 'بعتنالك رابط على الإيميل'); };
  const act = async (r: Row, a: string, v?: number) => {
    const sb = sbRef.current!, nm = r.name || r.email || '';
    let res: { error: { message: string } | null } | null = null;
    if (a === 'dc') { const n = parseInt(prompt('كام يوم تزوّد لـ ' + nm + '؟') || '', 10); if (!n || n < 1) return; a = 'd'; v = n; }
    if (a === 'b' && !confirm('توقف حساب ' + nm + '؟')) return;
    if (a === 'x' && !confirm('تلغي الاشتراك المدفوع لـ ' + nm + '؟ (هيفضل عنده التجربة لو لسه فاضلها)')) return;
    setBusy(r.owner + a);
    try {
      if (a === 'd') res = await sb.rpc('studio_admin_set', { p_owner: r.owner, p_days: v });
      else if (a === 't') res = await sb.rpc('studio_admin_trial', { p_owner: r.owner, p_days: 7 });
      else if (a === 'b') res = await sb.rpc('studio_admin_set', { p_owner: r.owner, p_blocked: true });
      else if (a === 'u') res = await sb.rpc('studio_admin_set', { p_owner: r.owner, p_blocked: false });
      else if (a === 'x') res = await sb.rpc('studio_admin_set', { p_owner: r.owner, p_days: 0 });
      else if (a === 'n') res = await sb.rpc('studio_admin_set', { p_owner: r.owner, p_note: notes[r.owner] || '' });
      if (res && res.error) throw res.error; note('تم ✅'); await load();
    } catch (e) { note('فشل: ' + ((e as Error).message || e), 4000); }
    setBusy('');
  };
  const save = async () => { const r = await sbRef.current!.rpc('studio_admin_cfg', { p_gate: gate, p_trial_days: parseInt(td, 10), p_contact: ct.trim() }); note(r.error ? 'فشل: ' + r.error.message : gate ? 'اتحفظ ✅ البوابة شغالة دلوقتي' : 'اتحفظ ✅ البوابة مقفولة', r.error ? 4000 : 2600); };

  const list = useMemo(() => { const k = q.trim().toLowerCase(); return rows.filter((r) => !k || [r.name, r.email, r.phone].join(' ').toLowerCase().includes(k)); }, [rows, q]);
  const n = (k: string) => rows.filter((r) => r.status === k).length;

  return (
    <div className="adm"><div className="w">
      <h1>🛠️ لوحة تحكم ميكانيزم ستوديو</h1>
      <div className="mu">المشتركين، التجديد، والتجربة المجانية. <a href="/" style={{ color: 'var(--g)' }}>← رجوع للستوديو</a></div>
      {mode === 'wait' && <div className="card mu">⏳ ثانية…</div>}
      {mode === 'login' && <div className="card">
        <h2>دخول الأدمن</h2>
        <label className="mu">الإيميل</label><input type="email" dir="ltr" autoComplete="username" value={em} onChange={(e) => setEm(e.target.value)} />
        <label className="mu" style={{ marginTop: 8, display: 'block' }}>الباسورد</label><input type="password" dir="ltr" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
        <div className="row" style={{ marginTop: 12 }}><button className="p" onClick={login}>دخول</button><button onClick={mail}>رابط على الإيميل</button></div>
        <div className="mu" style={{ marginTop: 8 }}>{lm}</div>
      </div>}
      {mode === 'app' && <>
        <div className="card"><div className="row"><div className="mu">{who}</div><button onClick={load}>🔄 تحديث</button><button onClick={() => sbRef.current!.auth.signOut()}>خروج</button></div></div>
        <div className="card"><div className="stats">{[['الكل', rows.length], ['تجربة', n('trial')], ['مشترك', n('active')], ['خلصت', n('expired')], ['موقوف', n('blocked')]].map(([k, v]) => <div className="stat" key={k as string}><b>{v}</b><span>{k}</span></div>)}</div></div>
        <div className="card">
          <h2>⚙️ إعدادات الاشتراك</h2>
          <label className="sw"><input type="checkbox" checked={gate} onChange={(e) => setGate(e.target.checked)} /> <span><b>تشغيل البوابة</b> — لما تشغّلها كل الناس لازم تسجّل وتدخل بالاشتراك. وهي مقفولة الستوديو شغال زي ما هو.</span></label>
          <div className="row" style={{ marginTop: 10 }}>
            <div><label className="mu">أيام التجربة المجانية</label><input type="number" min={0} max={365} inputMode="numeric" value={td} onChange={(e) => setTd(e.target.value)} /></div>
            <div><label className="mu">رقم واتساب التجديد</label><input dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={ct} onChange={(e) => setCt(e.target.value)} /></div>
          </div>
          <button className="p" style={{ marginTop: 10, width: '100%' }} onClick={save}>حفظ الإعدادات</button>
        </div>
        <div className="card">
          <h2>🔗 مفاتيح المنصات (للنشر على كل المنصات مرة واحدة)</h2>
          <div className="mu">مرة واحدة بس: بتعمل تطبيق في كل منصة وتحط هنا المفتاح والسر، وتحط «رابط الرجوع» اللي تحت في إعدادات التطبيق هناك. بعدها أي مستخدم في الستوديو يربط حسابه بدوسة. السر بيتحفظ مشفّر ومابيظهرش تاني.</div>
          {([['meta', '📘📸 فيسبوك + إنستجرام (Meta App)', 'App ID', 'App Secret'], ['google', '▶️ يوتيوب (Google Cloud OAuth)', 'Client ID', 'Client Secret'], ['tiktok', '🎵 تيك توك (TikTok for Developers)', 'Client Key', 'Client Secret']] as [AK, string, string, string][]).map(([k, t, a, b]) => (
            <div key={k} style={{ borderTop: '1px solid var(--ln)', paddingTop: 10, marginTop: 10 }}>
              <b>{t}</b> {apps[k].id ? <span className="chip" style={{ background: '#2fbf6b' }}>متسجّل</span> : <span className="chip" style={{ background: '#666' }}>لسه</span>}
              <div className="row" style={{ marginTop: 6 }}>
                <div><label className="mu">{a}</label><input dir="ltr" value={apps[k].id} onChange={(e) => setAppsS({ ...apps, [k]: { ...apps[k], id: e.target.value } })} /></div>
                <div><label className="mu">{b}{apps[k].has ? ' (متسجّل — سيبه فاضي عشان يفضل)' : ''}</label><input dir="ltr" type="password" autoComplete="off" value={apps[k].secret} onChange={(e) => setAppsS({ ...apps, [k]: { ...apps[k], secret: e.target.value } })} /></div>
              </div>
              {cbs[k] && <div className="mu" style={{ marginTop: 6 }}>رابط الرجوع (Redirect URI): <span className="em" style={{ userSelect: 'all' }}>{cbs[k]}</span> <button style={{ minHeight: 30, padding: '2px 10px' }} onClick={() => { navigator.clipboard.writeText(cbs[k]).then(() => note('اتنسخ')).catch(() => {}); }}>انسخ</button></div>}
            </div>))}
                    <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontWeight: 800 }}>📖 إزاي أعمل التطبيقات دي (مرة واحدة، تنفع من الموبايل)</summary>
            <div className="mu" style={{ lineHeight: 1.9, marginTop: 6 }}>
              <b>📘📸 فيسبوك + إنستجرام:</b> ادخل developers.facebook.com بحساب الأدمن على صفحة المحل ← My Apps ← Create App ← نوع Business ← من «Add products» ضيف <b>Facebook Login for Business</b> ← في إعداداته حط «رابط الرجوع» اللي فوق في Valid OAuth Redirect URIs ← من App settings ← Basic انسخ App ID و App Secret وحطهم هنا. لازم إنستجرام المحل يكون حساب Business ومربوط بالصفحة. طول ما التطبيق في وضع Development بيشتغل لحسابك انت (وأي حد تضيفه Tester) — ده كفاية لصفحة المحل.<br />
              <b>▶️ يوتيوب:</b> ادخل console.cloud.google.com ← مشروع جديد ← APIs &amp; Services ← Library ← فعّل <b>YouTube Data API v3</b> ← OAuth consent screen: External، وضيف إيميلك في Test users (أو دوس Publish App) ← Credentials ← Create Credentials ← OAuth client ID ← Web application ← حط «رابط الرجوع» اللي فوق في Authorized redirect URIs ← انسخ Client ID و Client Secret.<br />
              <b>🎵 تيك توك:</b> ادخل developers.tiktok.com ← Manage apps ← Connect an app ← ضيف منتج <b>Login Kit</b> و <b>Content Posting API</b> ← حط «رابط الرجوع» في Redirect URI ← انسخ Client Key و Client Secret. لحد ما تيك توك يراجع التطبيق، الفيديو بيوصلك <b>مسودة</b> في تيك توك وتنشره بدوسة من الإشعار؛ بعد الموافقة بيتنشر لوحده.<br />
              بعد الحفظ: افتح الستوديو ← أي فيديو أو بوست ← «📤 انشر في كل مكان» ← «🔗 اربط» جنب كل منصة (مرة واحدة).
            </div>
          </details>
          <button className="p" style={{ marginTop: 10, width: '100%' }} onClick={saveApps}>حفظ مفاتيح المنصات</button>
        </div>
        <div className="card">
          <h2>👥 المشتركين</h2>
          <input placeholder="ابحث بالاسم أو الإيميل أو الموبايل…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ marginTop: 6 }}>{list.length ? list.map((r) => (
            <div className="u" key={r.owner}>
              <div className="top"><b>{r.name || '(من غير اسم)'}</b><span className="chip" style={{ background: CHIP[r.status] || '#666' }}>{ST[r.status] || r.status}{r.status === 'trial' || r.status === 'active' ? ' — باقي ' + dl(r) + ' يوم' : ''}</span></div>
              <div className="em">{r.email}{r.phone ? ' • ' + r.phone : ''}</div>
              <div className="mu">سجّل {fd(r.created_at)} • آخر دخول {ago(r.last_seen)}{r.paid_until ? ' • مدفوع لحد ' + fd(r.paid_until) : ''}</div>
              <input placeholder="ملاحظة…" value={notes[r.owner] || ''} onChange={(e) => setNotes({ ...notes, [r.owner]: e.target.value })} style={{ marginTop: 6, padding: 8 }} />
              <div className="acts">
                {[30, 90, 365].map((d) => <button key={d} className="p" disabled={!!busy} onClick={() => act(r, 'd', d)}>{d === 30 ? '+30 يوم' : d === 90 ? '+90' : '+سنة'}</button>)}
                <button disabled={!!busy} onClick={() => act(r, 'dc')}>أيام تانية…</button>
                <button disabled={!!busy} onClick={() => act(r, 't')}>تجربة +7</button>
                {r.blocked ? <button disabled={!!busy} onClick={() => act(r, 'u')}>فك الإيقاف</button> : <button className="d" disabled={!!busy} onClick={() => act(r, 'b')}>إيقاف</button>}
                <button className="d" disabled={!!busy} onClick={() => act(r, 'x')}>إلغاء الاشتراك</button>
                <button disabled={!!busy} onClick={() => act(r, 'n')}>حفظ الملاحظة</button>
              </div>
            </div>)) : <div className="mu">مفيش مشتركين لسه. أول ما حد يسجّل هيظهر هنا.</div>}</div>
        </div>
      </>}
    </div>
    {msg && <div className="msg">{msg}</div>}
    <style>{`
.adm{--bg:#0b0b0e;--sf:#141418;--sf2:#1c1c22;--ln:#2c2c34;--tx:#f3efe6;--mu:#b8b3a6;--g:#f6dc8a;--bad:#ff6b6b;min-height:100vh;background:var(--bg);color:var(--tx);font:600 15px/1.7 Cairo,Tajawal,system-ui,sans-serif;padding:max(14px,env(safe-area-inset-top)) 14px 40px;box-sizing:border-box}
@media(prefers-color-scheme:light){.adm{--bg:#f4f1ea;--sf:#fff;--sf2:#f0ece2;--ln:#ddd6c6;--tx:#1d1a12;--mu:#6b6556;--g:#8a6a14}}
.adm *{box-sizing:border-box}.adm .w{max-width:760px;margin:0 auto}.adm h1{font-size:22px;margin:6px 0 2px}.adm h2{font-size:17px;margin:0 0 8px}.adm .mu{color:var(--mu);font-size:13px}
.adm .card{background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:14px;margin:12px 0}
.adm input{width:100%;padding:11px;border-radius:10px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font:600 15px Cairo,sans-serif}
.adm button{min-height:42px;padding:8px 14px;border-radius:11px;border:1px solid var(--ln);background:var(--sf2);color:var(--tx);font:700 14px Cairo,sans-serif;cursor:pointer}
.adm button.p{background:linear-gradient(135deg,#f6dc8a,#c99a3c);color:#1a1405;border:0}.adm button.d{color:var(--bad)}.adm button:disabled{opacity:.5}
.adm .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.adm .row>*{flex:1 1 auto}
.adm .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.adm .stat{background:var(--sf2);border-radius:12px;padding:10px 4px;text-align:center}.adm .stat b{display:block;font-size:20px}.adm .stat span{font-size:12px;color:var(--mu)}
.adm .chip{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;color:#fff}
.adm .u{border-top:1px solid var(--ln);padding:12px 0}.adm .u:first-child{border-top:0}.adm .u .top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}
.adm .u .em{direction:ltr;unicode-bidi:plaintext;font-size:13px;color:var(--mu);word-break:break-all}.adm .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.adm .acts button{flex:1 1 auto;min-height:38px;font-size:13px}
.adm .sw{display:flex;align-items:center;gap:10px}.adm .sw input{width:auto;transform:scale(1.5)}
.msg{position:fixed;bottom:16px;inset-inline:16px;max-width:520px;margin:auto;background:#222;color:#fff;border-radius:12px;padding:12px 16px;z-index:9;text-align:center}
`}</style>
  </div>
  );
}
