// اختبار بوابة الاشتراك + لوحة الأدمن بسيرفر مزيّف (من غير ما نعمل حسابات حقيقية أو نلمس Supabase)
// node tests/e2e-gate.cjs <فولدر مطلق للصور> [رابط الستوديو]
const { spawn } = require('child_process');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = (process.argv[3] || 'http://localhost:3204').replace(/\/$/, '');
const PORT = 9400 + Math.floor(Math.random() * 500);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + OUT + '/prof', '--window-size=430,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ };
(async () => {
  let tabs;
  for (let i = 0; i < 90; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch (e) { } await sleep(500); }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Page.javascriptDialogOpening') { ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); return } if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text)) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result.result.value };
  await send('Runtime.enable'); await send('Page.enable');
  // سيرفر مزيّف: بيقرأ السيناريو من localStorage.__mock
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const of=window.fetch.bind(window);window.fetch=async(u,o)=>{const s=String(u&&u.url||u);if(!s.includes('rzvncstjattlklpdtkfn.supabase.co'))return of(u,o);
    const M=JSON.parse(localStorage.getItem('__mock')||'{}'),js=(x,st)=>new Response(JSON.stringify(x),{status:st||200,headers:{'content-type':'application/json'}});let body={};try{body=JSON.parse(o&&o.body||'{}')}catch(e){}
    const calls=JSON.parse(localStorage.getItem('__calls')||'[]');const rec=n=>{calls.push([n,body]);localStorage.setItem('__calls',JSON.stringify(calls))};
    const exp=Math.floor(Date.now()/1000)+3600,mkjwt=()=>{const b=x=>btoa(x).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');return b('{"alg":"HS256","typ":"JWT"}')+'.'+b(JSON.stringify({sub:'u1',aud:'authenticated',role:'authenticated',exp}))+'.sig'};
    const sess=em=>({access_token:mkjwt(),token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'r',user:{id:'u1',aud:'authenticated',role:'authenticated',email:em||'t@t.t',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}});
    if(s.includes('/rpc/studio_public_cfg'))return js(M.cfg||{gate:false,trial_days:7,contact:''});
    if(s.includes('/auth/v1/token'))return js(sess(body.email));
    if(s.includes('/auth/v1/signup')){rec('signup');return js(M.confirm?{id:'u1',email:body.email,identities:[{}]}:sess(body.email))}
    if(s.includes('/auth/v1/otp')){rec('otp');return js({})}
    if(s.includes('/auth/v1/logout'))return new Response(null,{status:204});
    if(s.includes('/auth/v1/user'))return js(sess().user);
    if(s.includes('/rpc/studio_my_sub')){rec('my_sub');return M.subErr?js({message:M.subErr},400):js(M.sub||{status:'trial',days_left:7,email:'t@t.t'})}
    if(s.includes('/rpc/studio_admin_list'))return M.notAdmin?js({message:'not_admin'},400):js(M.list||[]);
    if(s.includes('/rpc/studio_admin_set')){rec('admin_set');return js({})}
    if(s.includes('/rpc/studio_admin_trial')){rec('admin_trial');return js(null)}
    if(s.includes('/rpc/studio_admin_cfg')){rec('admin_cfg');return js(Object.assign({},M.cfg,{gate:body.p_gate}))}
    if(s.includes('/rest/v1/studio_kv'))return js([]);
    return js({})}})();` });
  const scenario = async (m, path = '/') => {
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await send('Page.navigate', { url: BASE + path }); await sleep(300);
    await ev("localStorage.setItem('__mock'," + JSON.stringify(JSON.stringify(m)) + ")");
    await send('Page.navigate', { url: BASE + path }); await sleep(1500);
    const gateOn = !!(m.cfg && m.cfg.gate) && path === '/';
    const probe = "(()=>{const o=document.getElementById('gt-ov'),b=document.getElementById('gt-bar');const shown=o&&getComputedStyle(o).display!=='none';return JSON.stringify({bar:!!b,shown:!!shown,loading:!!shown&&/ثانية…/.test(o.innerText)&&o.querySelectorAll('button').length===0})})()";
    for (let i = 0; i < 45; i++) {
      if (!gateOn && i >= 4) break;
      let j = {}; try { j = JSON.parse(await ev(probe)) } catch (e) { }
      if (j.bar || (j.shown && !j.loading)) break;
      await sleep(700);
    }
    if (path !== '/') await sleep(2500);
    await sleep(500);
  };
  const shot = async nm => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${nm}.png`, Buffer.from(r.result.data, 'base64')) };
  const vis = sel => ev(`(()=>{const e=document.querySelector('${sel}');return !!e&&getComputedStyle(e).display!=='none'})()`);
  const txt = sel => ev(`(document.querySelector('${sel}')||{}).innerText||''`);

  // ١) البوابة مقفولة: الستوديو شغال زي ما هو
  await ev(`localStorage.clear()`);
  await scenario({ cfg: { gate: false, trial_days: 7, contact: '' } });
  ok(!(await vis('#gt-ov')) && !(await vis('#gt-bar')), 'البوابة مقفولة → مفيش شاشة دخول ولا شريط');
  // ٢) البوابة شغالة وماحدش داخل: شاشة التسجيل
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '01012345678' } });
  ok(await vis('#gt-ov'), 'البوابة شغالة → شاشة تسجيل الدخول ظاهرة'); ok(/٧ أيام|7 أيام/.test(await txt('#gt-ov')) || /مجانًا/.test(await txt('#gt-ov')), 'مكتوب إن فيه تجربة مجانية');
  await shot('gate-1-signup');
  // ٣) تسجيل حساب جديد: الاسم + الموبايل + إيميل + باسورد ← تجربة
  await ev(`(()=>{const v=(i,x)=>{const e=document.getElementById(i);e.value=x;e.dispatchEvent(new Event('input',{bubbles:true}))};v('gt-n','أحمد');v('gt-p','01099998888');v('gt-e','new@user.com');v('gt-w','secret12');document.getElementById('gt-go').click()})()`);
  await sleep(3500);
  ok(!(await vis('#gt-ov')), 'بعد التسجيل → الشاشة اتقفلت'); const bar = await txt('#gt-bar'); ok(/تجربة مجانية/.test(bar) && /7|٧|أيام/.test(bar), 'الشريط: «' + bar.replace(/\n/g, ' ') + '»');
  const calls = JSON.parse(await ev(`localStorage.getItem('__calls')||'[]'`)); ok(calls.some(c => c[0] === 'my_sub' && c[1].p_name === 'أحمد' && c[1].p_phone === '01099998888'), 'الاسم والموبايل اتبعتوا مع أول دخول'); ok(calls.some(c => c[0] === 'signup' && c[1].data && c[1].data.product === 'studio'), 'التسجيل اتعلّم product=studio');
  await shot('gate-2-trial-bar');
  // ٤) باقي يومين: لون تحذير
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '01012345678' }, sub: { status: 'trial', days_left: 2, email: 'new@user.com' } });
  console.log('  bar4:',JSON.stringify(await txt('#gt-bar')),await vis('#gt-ov'));ok(/يومين/.test(await txt('#gt-bar')) && (await ev(`document.getElementById('gt-bar').className`)) === 'warn', 'باقي يومين → شريط تحذير');
  // ٥) مشترك
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '' }, sub: { status: 'active', days_left: 23, email: 'new@user.com' } });
  console.log('  bar5:',JSON.stringify(await txt('#gt-bar')),await vis('#gt-ov'),await txt('#gt-ov'));ok(/اشتراكك ساري/.test(await txt('#gt-bar')), 'مشترك → «اشتراكك ساري»');
  // ٦) انتهت التجربة
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '01012345678' }, sub: { status: 'expired', days_left: 0, email: 'new@user.com' } });
  ok(await vis('#gt-ov') && /خلصت/.test(await txt('#gt-ov')), 'التجربة خلصت → الشاشة مقفولة'); ok((await ev(`(document.querySelector('#gt-ov a.btn')||{}).href||''`)).includes('wa.me/201012345678'), 'زرار واتساب للتجديد برقم المحل');
  await shot('gate-3-expired');
  // ٧) موقوف
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '' }, sub: { status: 'blocked', days_left: 0, email: 'bad@user.com' } });
  ok(await vis('#gt-ov') && /موقوف/.test(await txt('#gt-ov')), 'موقوف → الشاشة مقفولة'); await shot('gate-4-blocked');
  // ٨) أدمن: بيدخل ويشوف اللوحة
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '' }, sub: { status: 'admin', days_left: 0, email: 'boss@x.com' } });
  ok(/لوحة التحكم/.test(await txt('#gt-bar')), 'الأدمن يشوف رابط لوحة التحكم');
  // ٩) لوحة الأدمن
  const now = Date.now(), day = 864e5, iso = t => new Date(t).toISOString();
  const list = [
    { owner: 'a1', email: 'ali@x.com', name: 'علي محمد', phone: '01011112222', created_at: iso(now - 2 * day), trial_end: iso(now + 5 * day), paid_until: null, blocked: false, note: '', last_seen: iso(now - 3600e3), status: 'trial' },
    { owner: 'a2', email: 'sara@x.com', name: 'سارة', phone: '01233334444', created_at: iso(now - 40 * day), trial_end: iso(now - 33 * day), paid_until: iso(now + 20 * day), blocked: false, note: 'دفعت كاش', last_seen: iso(now - 600e3), status: 'active' },
    { owner: 'a3', email: 'omar@x.com', name: 'عمر', phone: '', created_at: iso(now - 12 * day), trial_end: iso(now - 5 * day), paid_until: null, blocked: false, note: '', last_seen: iso(now - 9 * day), status: 'expired' },
    { owner: 'a4', email: 'spam@x.com', name: '', phone: '', created_at: iso(now - 1 * day), trial_end: iso(now + 6 * day), paid_until: null, blocked: true, note: 'مشبوه', last_seen: null, status: 'blocked' }];
  await ev(`localStorage.removeItem('__calls')`);
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '01012345678' }, list }, '/admin');
  ok(await vis('#app'), 'لوحة الأدمن اتفتحت على /admin'); ok((await ev(`document.querySelectorAll('#list .u').length`)) === 4, 'ظهرت ٤ مشتركين'); ok(/4|٤/.test(await txt('#stats')), 'الإحصائيات ظاهرة');
  await shot('admin-1-list');
  await ev(`document.querySelector('[data-id=a1] [data-a=d][data-v="30"]').click()`); await sleep(1200);
  ok(JSON.parse(await ev(`localStorage.getItem('__calls')||'[]'`)).some(c => c[0] === 'admin_set' && c[1].p_owner === 'a1' && c[1].p_days === 30), 'زرار +30 يوم بيبعت studio_admin_set(a1, 30)');
  await ev(`document.querySelector('[data-id=a3] [data-a=t]').click()`); await sleep(900);
  ok(JSON.parse(await ev(`localStorage.getItem('__calls')||'[]'`)).some(c => c[0] === 'admin_trial' && c[1].p_owner === 'a3' && c[1].p_days === 7), 'تجربة +7 بتبعت studio_admin_trial');
  await ev(`document.querySelector('[data-id=a4] [data-a=u]').click()`); await sleep(900);
  ok(JSON.parse(await ev(`localStorage.getItem('__calls')||'[]'`)).some(c => c[0] === 'admin_set' && c[1].p_owner === 'a4' && c[1].p_blocked === false), 'فك الإيقاف بيشتغل');
  await ev(`(()=>{const g=document.getElementById('gate');g.checked=false;document.getElementById('td').value='14';document.getElementById('sv').click()})()`); await sleep(900);
  ok(JSON.parse(await ev(`localStorage.getItem('__calls')||'[]'`)).some(c => c[0] === 'admin_cfg' && c[1].p_trial_days === 14), 'حفظ الإعدادات (١٤ يوم تجربة)');
  await ev(`(()=>{const q=document.getElementById('q');q.value='sara';q.dispatchEvent(new Event('input'))})()`); ok((await ev(`document.querySelectorAll('#list .u').length`)) === 1, 'البحث بيفلتر');
  // ١٠) حد مش أدمن يفتح لوحة الأدمن
  await scenario({ cfg: { gate: true, trial_days: 7, contact: '' }, notAdmin: true }, '/admin');
  ok(await vis('#login') && /مش أدمن/.test(await txt('#lm')), 'حساب مش أدمن ← «الحساب ده مش أدمن»');
  const exc = logs.filter(l => !/ResizeObserver/.test(l)); ok(exc.length === 0, 'مفيش أخطاء جافاسكريبت ' + JSON.stringify(exc.slice(0, 3)));
  console.log(fails ? 'FAILED: ' + fails : 'ALL PASSED');
  ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); chrome.kill(); process.exit(1) });
