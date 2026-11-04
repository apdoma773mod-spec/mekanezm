/* بوابة الاشتراك لـ «ميكانيزم ستوديو»: تسجيل دخول + تجربة مجانية + قفل لما الاشتراك يخلص.
   بتشتغل بس لو الأدمن شغّل «البوابة» من لوحة التحكم (admin.html) — غير كده الستوديو شغال زي ما هو.
   الحسابات والاشتراكات على مشروع mekanizm-app (جدول studio_subs) ونفس تسجيل الدخول بتاع مزامنة الستوديو. */
(function () {
  'use strict';
  const URL_ = 'https://rzvncstjattlklpdtkfn.supabase.co', KEY = 'sb_publishable_Molr1fCzsC-VbSgTFDXc5w_F1p0-Fcr';
  const $ = (s, r = document) => r.querySelector(s);
  const E = (t, a = {}, h = '') => Object.assign(document.createElement(t), a, { innerHTML: h });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) { } }, del: k => { try { localStorage.removeItem(k) } catch (e) { } } };
  let sb = null, cfg = null, ov = null, bar = null, timer = 0, checking = false;

  const css = E('style', {}, `
    #gt-ov{position:fixed;inset:0;z-index:100001;background:radial-gradient(1200px 700px at 50% -10%,#1d2540,#0b0b0e);color:#f3efe6;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:Cairo,Tajawal,sans-serif;direction:rtl}
    #gt-ov .gt-c{width:min(440px,100%);background:#141418;border:1px solid #2c2c34;border-radius:22px;padding:22px;box-shadow:0 30px 80px #000a}
    #gt-ov h1{margin:0 0 4px;font-size:25px;font-weight:900}#gt-ov .sub{color:#b8b3a6;font-size:14px;line-height:1.7;margin:0 0 14px}
    #gt-ov .badge{display:inline-block;background:#1f7a3d;color:#fff;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:800;margin-bottom:10px}
    #gt-ov label{display:block;font-size:13px;color:#b8b3a6;margin:10px 0 4px}
    #gt-ov input{width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:1px solid #34343e;background:#0b0b0e;color:#f3efe6;font:600 16px Cairo,sans-serif;direction:ltr;text-align:left}
    #gt-ov input.rtl{direction:rtl;text-align:right}
    #gt-ov button{width:100%;min-height:50px;margin-top:12px;border:0;border-radius:14px;font:800 17px Cairo,sans-serif;cursor:pointer;background:linear-gradient(135deg,#f6dc8a,#c99a3c);color:#1a1405}
    #gt-ov button.o{background:#23232b;color:#f3efe6;border:1px solid #34343e}
    #gt-ov button:disabled{opacity:.6}
    #gt-ov .tabs{display:flex;gap:8px;margin:6px 0 4px}#gt-ov .tabs button{margin:0;min-height:42px;font-size:15px}
    #gt-ov .msg{margin-top:10px;font-size:14px;line-height:1.7;min-height:20px}#gt-ov .msg.bad{color:#ff8a80}#gt-ov .msg.ok{color:#7be3a0}
    #gt-ov a.btn{display:block;text-align:center;text-decoration:none;margin-top:12px;padding:14px;border-radius:14px;background:#1f7a3d;color:#fff;font:800 17px Cairo,sans-serif}
    #gt-bar{position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);inset-inline-end:8px;z-index:99990;display:flex;gap:6px;align-items:center;background:#17171c;color:#f3efe6;border:1px solid #34343e;border-radius:999px;padding:5px 12px;font:700 12px Cairo,sans-serif;box-shadow:0 6px 20px #0008}
    #gt-bar.warn{border-color:#e0a030;color:#ffd68a}#gt-bar a,#gt-bar button{color:inherit;background:none;border:0;font:inherit;cursor:pointer;text-decoration:underline;padding:2px 4px}`);
  document.head.appendChild(css);

  const say = (m, cls) => { const el = $('#gt-msg'); if (el) { el.textContent = m || ''; el.className = 'msg ' + (cls || '') } };
  const days = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n + (n >= 11 ? ' يوم' : ' أيام');
  const errAr = m => {
    m = String(m || '');
    if (/invalid login|invalid credentials/i.test(m)) return 'الإيميل أو الباسورد غلط.';
    if (/already registered|already been registered/i.test(m)) return 'الإيميل ده مسجّل قبل كده — اضغط «دخول».';
    if (/password.*(at least|short|weak)/i.test(m)) return 'الباسورد ضعيف — اكتب ٦ حروف أو أرقام على الأقل.';
    if (/rate limit|too many|for security purposes/i.test(m)) return 'محاولات كتير — استنى دقيقة وجرّب تاني.';
    if (/email.*(invalid|valid)/i.test(m)) return 'اكتب إيميل صحيح.';
    if (/not confirmed|confirm/i.test(m)) return 'لازم تأكّد الإيميل الأول: افتح الرسالة اللي وصلتلك.';
    if (/failed to fetch|network/i.test(m)) return 'مفيش نت — اتأكد من الاتصال.';
    return m || 'حصلت مشكلة — جرّب تاني.';
  };

  async function getCfg() {
    try {
      const r = await fetch(URL_ + '/rest/v1/rpc/studio_public_cfg', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error('cfg ' + r.status);
      const j = await r.json(); ls.set('mkz-gate-cfg', JSON.stringify(j)); return j;
    } catch (e) { try { return JSON.parse(ls.get('mkz-gate-cfg') || 'null') } catch (x) { return null } }
  }
  function lib() {
    return window.supabase && window.supabase.createClient ? Promise.resolve() : new Promise((ok, no) => {
      const x = document.createElement('script'); x.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; x.onload = ok; x.onerror = () => no(new Error('failed to fetch')); document.head.appendChild(x);
    });
  }
  function overlay(html) {
    if (!ov) { ov = E('div', { id: 'gt-ov' }); document.body.appendChild(ov); }
    ov.innerHTML = '<div class="gt-c">' + html + '</div>'; ov.style.display = 'flex';
  }
  const hideOverlay = () => { if (ov) ov.style.display = 'none'; };

  function showLogin(tab) {
    tab = tab || ls.get('mkz-gate-tab') || 'new';
    const td = (cfg && cfg.trial_days) || 7;
    overlay(`<h1>🎬 ميكانيزم ستوديو</h1><p class="sub">مونتاج ذكي لفيديوهاتك: ترجمة، رسومات، موسيقى، وشكل مختلف لكل فيديو.</p>
      ${tab === 'new' && td > 0 ? `<span class="badge">🎁 ${esc(days(td))} مجانًا — من غير بطاقة</span>` : ''}
      <div class="tabs"><button class="${tab === 'new' ? '' : 'o'}" data-t="new">حساب جديد</button><button class="${tab === 'in' ? '' : 'o'}" data-t="in">دخول</button></div>
      ${tab === 'new' ? `<label>الاسم</label><input id="gt-n" class="rtl" autocomplete="name" placeholder="اسمك"><label>رقم الموبايل (واتساب)</label><input id="gt-p" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx">` : ''}
      <label>الإيميل</label><input id="gt-e" type="email" autocomplete="username" placeholder="name@example.com">
      <label>الباسورد</label><input id="gt-w" type="password" autocomplete="${tab === 'new' ? 'new-password' : 'current-password'}" placeholder="٦ حروف أو أكتر">
      <button id="gt-go">${tab === 'new' ? 'ابدأ التجربة المجانية' : 'دخول'}</button>
      <button class="o" id="gt-ml">أو ابعتلي رابط دخول على الإيميل (من غير باسورد)</button>
      <div id="gt-msg" class="msg"></div>`);
    ov.onclick = e => { const b = e.target.closest('[data-t]'); if (b) { ls.set('mkz-gate-tab', b.dataset.t); showLogin(b.dataset.t) } };
    $('#gt-go').onclick = async () => {
      const em = $('#gt-e').value.trim(), pw = $('#gt-w').value, nm = $('#gt-n') ? $('#gt-n').value.trim() : '', ph = $('#gt-p') ? $('#gt-p').value.trim() : '';
      if (!em) return say('اكتب الإيميل', 'bad'); if (pw.length < 6) return say('الباسورد ٦ حروف على الأقل', 'bad');
      if (tab === 'new' && !nm) return say('اكتب اسمك', 'bad');
      $('#gt-go').disabled = true; say('ثانية…');
      try {
        if (nm) ls.set('mkz-gate-name', nm); if (ph) ls.set('mkz-gate-phone', ph);
        if (tab === 'new') {
          const r = await sb.auth.signUp({ email: em, password: pw, options: { data: { name: nm, phone: ph, product: 'studio' }, emailRedirectTo: location.origin + '/' } });
          if (r.error) throw r.error;
          if (!r.data.session) { say('اتبعتلك رسالة تأكيد على الإيميل. افتحها وبعدين ارجع واضغط «دخول».', 'ok'); $('#gt-go').disabled = false; return; }
        } else {
          const r = await sb.auth.signInWithPassword({ email: em, password: pw }); if (r.error) throw r.error;
        }
      } catch (e) { say(errAr(e.message), 'bad'); $('#gt-go').disabled = false; }
    };
    $('#gt-ml').onclick = async () => {
      const em = $('#gt-e').value.trim(); if (!em) return say('اكتب الإيميل الأول', 'bad');
      const nm = $('#gt-n') ? $('#gt-n').value.trim() : '', ph = $('#gt-p') ? $('#gt-p').value.trim() : ''; if (nm) ls.set('mkz-gate-name', nm); if (ph) ls.set('mkz-gate-phone', ph);
      $('#gt-ml').disabled = true; say('ثانية…');
      const r = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + '/', data: { name: nm, phone: ph, product: 'studio' } } });
      $('#gt-ml').disabled = false; r.error ? say(errAr(r.error.message), 'bad') : say('بعتنالك رابط على الإيميل — افتحه من نفس الموبايل.', 'ok');
    };
  }
  function showBlocked(st, s) {
    const contact = (cfg && cfg.contact || '').replace(/[^\d+]/g, '');
    const wa = contact ? 'https://wa.me/' + contact.replace(/^\+/, '').replace(/^0/, '20') + '?text=' + encodeURIComponent('عايز أجدد اشتراك ميكانيزم ستوديو — ' + (s.email || '')) : '';
    overlay(`<h1>${st === 'blocked' ? '⛔ الحساب موقوف' : '⏰ الفترة المجانية خلصت'}</h1>
      <p class="sub">${st === 'blocked' ? 'الحساب ده موقوف. تواصل معانا لو ده بالغلط.' : 'شكرًا إنك جرّبت ميكانيزم ستوديو. عشان تكمل، جدّد اشتراكك وهنفتحلك الحساب على طول.'}</p>
      <p class="sub" style="direction:ltr;text-align:right">${esc(s.email || '')}</p>
      ${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">💬 تواصل واتساب للتجديد</a>` : '<p class="sub">تواصل مع ميكانيزم لتجديد اشتراكك.</p>'}
      <button class="o" id="gt-re">🔄 جدّدت — افحص تاني</button><button class="o" id="gt-out">خروج / حساب تاني</button><div id="gt-msg" class="msg"></div>`);
    $('#gt-re').onclick = () => check(true); $('#gt-out').onclick = signOut;
  }
  function paintBar(s) {
    if (!bar) { bar = E('div', { id: 'gt-bar' }); document.body.appendChild(bar); }
    const n = s.days_left || 0;
    bar.className = s.status === 'trial' && n <= 2 ? 'warn' : '';
    bar.innerHTML = (s.status === 'admin' ? '🛠️ أدمن <a href="admin.html">لوحة التحكم</a>' : s.status === 'active' ? '✅ اشتراكك ساري — باقي ' + esc(days(n)) : '🎁 تجربة مجانية — باقي ' + esc(days(n))) + ' <button id="gt-x" title="خروج">⏻</button>';
    $('#gt-x', bar).onclick = signOut;
  }
  async function signOut() { try { await sb.auth.signOut() } catch (e) { } if (bar) { bar.remove(); bar = null } showLogin('in'); }

  async function check(force) {
    if (checking) return; checking = true;
    try {
      const nm = ls.get('mkz-gate-name'), ph = ls.get('mkz-gate-phone');
      const r = await sb.rpc('studio_my_sub', { p_name: nm || null, p_phone: ph || null, p_src: 'web' });
      if (r.error) { if (/jwt|not_signed_in|invalid/i.test(r.error.message)) { await sb.auth.signOut().catch(() => { }); return showLogin('in'); } throw r.error; }
      const s = r.data; window.mkzSub = s;
      if (s.status === 'trial' || s.status === 'active' || s.status === 'admin') { hideOverlay(); paintBar(s); if (!timer) timer = setInterval(() => check(), 5 * 60 * 1000); }
      else { if (bar) { bar.remove(); bar = null } showBlocked(s.status, s); }
    } catch (e) {
      overlay(`<h1>🎬 ميكانيزم ستوديو</h1><p class="sub">${esc(errAr(e.message))}</p><button id="gt-rt">جرّب تاني</button>`); $('#gt-rt').onclick = () => { checking = false; check(true) };
    } finally { checking = false; }
  }

  async function init() {
    cfg = await getCfg();
    if (!cfg || !cfg.gate) return;                     /* البوابة مقفولة: الستوديو زي ما هو */
    overlay('<h1>🎬 ميكانيزم ستوديو</h1><p class="sub">ثانية…</p>');
    try { await lib(); } catch (e) { return overlay('<h1>🎬 ميكانيزم ستوديو</h1><p class="sub">مفيش نت — اتأكد من الاتصال وحدّث الصفحة.</p>'); }
    sb = window.supabase.createClient(URL_, KEY, { auth: { lock: (n, t, fn) => fn() } });
    sb.auth.onAuthStateChange((ev, ses) => { if (ev === 'SIGNED_IN' && ses) check(); else if (ev === 'SIGNED_OUT') { if (bar) { bar.remove(); bar = null } showLogin('in'); } });
    const { data } = await sb.auth.getSession();
    if (data.session) check(); else showLogin();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sb && window.mkzSub) check(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
