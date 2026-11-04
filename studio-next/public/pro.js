/* تحسينات احترافية فوق ستوديو ميكانيزم (من غير ما نلمس كود القديم): ١٠ تحسينات */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), E = (t, a = {}, h = '') => Object.assign(document.createElement(t), a, { innerHTML: h });
  const safe = f => { try { return f() } catch (e) { console.warn('pro.js', e) } };

  /* ١ و٨) CSS: لمس مريح، منع تكبير آيفون في الخانات، حلقة تركيز واضحة، احترام تقليل الحركة، منع سحب الصفحة بالغلط */
  safe(() => {
    const css = E('style', {}, `
      @media(pointer:coarse){button,[role=button],select,summary,.ch{min-height:40px}input,select,textarea{font-size:16px!important}}
      :focus-visible{outline:2px solid var(--a2,#D4A537);outline-offset:2px;border-radius:6px}
      html{-webkit-text-size-adjust:100%;overscroll-behavior-y:none}
      @media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      #pro-bar{position:fixed;inset-inline:0;top:calc(env(safe-area-inset-top,0px));z-index:99999;display:none;justify-content:center;pointer-events:none}
      #pro-bar b{pointer-events:auto;margin:8px;padding:8px 14px;border-radius:999px;background:#2a2a2e;color:#fff;font:700 13px Cairo,sans-serif;box-shadow:0 6px 24px #0008;cursor:pointer}
      #pro-bar b.bad{background:#b3261e}#pro-bar b.ok{background:#1f7a3d}
      #pro-k{position:fixed;inset:0;z-index:99998;background:#000a;display:none;align-items:flex-start;justify-content:center;padding-top:12vh}
      #pro-k div{width:min(460px,92vw);background:var(--sf,#141416);color:var(--tx,#F3EFE6);border:1px solid var(--ln,#333);border-radius:16px;padding:10px;box-shadow:0 20px 60px #000a}
      #pro-k input{width:100%;box-sizing:border-box;padding:12px;margin:0 0 6px;border-radius:10px;border:1px solid var(--ln,#333);background:var(--bg,#0B0B0C);color:inherit;font:600 16px Cairo,sans-serif}
      #pro-k button{display:block;width:100%;text-align:start;background:none;border:0;color:inherit;font:600 15px Cairo,sans-serif;padding:11px 12px;border-radius:10px;cursor:pointer}
      #pro-k button.on,#pro-k button:hover{background:var(--sf2,#222)}
      #pro-fab{position:fixed;inset-inline-start:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9999;width:42px;height:42px;border-radius:50%;border:1px solid var(--ln,#333);background:var(--sf,#141416);color:var(--tx,#F3EFE6);font-size:18px;cursor:pointer;opacity:.8}
    `);
    document.head.appendChild(css);
  });

  /* شريط الإشعارات (للأوفلاين والتحديث) */
  const bar = E('div', { id: 'pro-bar' });
  document.body.appendChild(bar);
  let barT;
  function note(txt, cls, ms, onclick) {
    bar.innerHTML = ''; const b = E('b', { className: cls || '', textContent: txt }); if (onclick) b.onclick = onclick; bar.appendChild(b); bar.style.display = 'flex';
    clearTimeout(barT); if (ms) barT = setTimeout(() => (bar.style.display = 'none'), ms);
  }

  /* ٢) مؤشر النت: أوفلاين / رجع النت */
  safe(() => {
    addEventListener('offline', () => note('📴 مفيش نت — الشغل المحلي شغال عادي', 'bad'));
    addEventListener('online', () => note('✅ النت رجع', 'ok', 2500));
    if (!navigator.onLine) note('📴 مفيش نت — الشغل المحلي شغال عادي', 'bad');
  });

  /* ٣) تنبيه تحديث: لو نزلت نسخة جديدة من الستوديو */
  safe(() => {
    if (!('serviceWorker' in navigator)) return;
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) note('🔄 فيه نسخة جديدة من الستوديو — اضغط للتحديث', '', 0, () => location.reload()); });
  });

  /* ٤) تخزين دائم: يمنع الآيفون من مسح مشاريعك لو المساحة قلّت */
  safe(() => { navigator.storage && navigator.storage.persist && navigator.storage.persist(); });

  /* ٥ و٦) أثناء التصدير (MediaRecorder): الشاشة ما تنامش + تحذير قبل قفل الصفحة */
  safe(() => {
    if (typeof MediaRecorder === 'undefined') return;
    let lock = null, rec = 0;
    const acquire = async () => { try { lock = await navigator.wakeLock.request('screen') } catch (e) {} };
    const release = () => { try { lock && lock.release() } catch (e) {} lock = null };
    const st = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function () {
      rec++; acquire();
      /* ١١) إشعار + اهتزاز لما الفيديو يخلص لو كنت قافل الصفحة، و١٢) عدّاد الفيديوهات اللي عملتها */
      try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
      const t0 = Date.now();
      this.addEventListener('stop', () => {
        try { const k = 'mkz-pro-stats', s = JSON.parse(localStorage.getItem(k) || '{"n":0,"sec":0}'); s.n++; s.sec += Math.round((Date.now() - t0) / 1000); s.last = new Date().toISOString(); localStorage.setItem(k, JSON.stringify(s)); } catch (e) {}
        try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {}
        try { if (document.hidden && window.Notification && Notification.permission === 'granted') new Notification('🎬 الفيديو خلص', { body: 'ارجع للستوديو تحفظه أو تبعته', icon: 'icon-192.png' }); } catch (e) {}
      }, { once: true });
      this.addEventListener('stop', () => { rec = Math.max(0, rec - 1); if (!rec) release(); }, { once: true });
      return st.apply(this, arguments);
    };
    document.addEventListener('visibilitychange', () => { if (rec && document.visibilityState === 'visible') acquire(); });
    addEventListener('beforeunload', e => { if (rec) { e.preventDefault(); e.returnValue = ''; } });
  });

  /* ٧) أي خطأ مفاجئ: رسالة مفهومة بدل ما الشاشة تتجمّد، ويتسجل جوه الجهاز */
  safe(() => {
    const logE = m => { try { const k = 'mkz-pro-err', a = JSON.parse(localStorage.getItem(k) || '[]'); a.unshift({ t: new Date().toISOString(), m: String(m).slice(0, 300) }); localStorage.setItem(k, JSON.stringify(a.slice(0, 30))); } catch (e) {} };
    let last = 0;
    const show = m => { logE(m); if (Date.now() - last > 4000) { last = Date.now(); note('⚠️ حصلت مشكلة صغيرة — الشغل محفوظ، جرّب تاني', 'bad', 3500); } };
    addEventListener('error', e => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) show(e.message) });
    addEventListener('unhandledrejection', e => show((e.reason && e.reason.message) || e.reason));
  });

  /* ٩) افتح على آخر قسم كنت فيه + روابط مباشرة (#vid) */
  const rail = () => document.querySelectorAll('#rail button[data-go]');
  const goTo = id => {
    const b = $('#rail button[data-go="' + id + '"]');
    if (!b) return false;
    b.click(); try { localStorage.setItem('mkz-last-view', id); history.replaceState(null, '', '#' + id) } catch (e) {}
    return true;
  };
  safe(() => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (rail().length) {
        clearInterval(iv);
        const want = location.hash.slice(1) || localStorage.getItem('mkz-last-view');
        if (want && want !== 'dash') goTo(want);
        rail().forEach(b => b.addEventListener('click', () => { try { localStorage.setItem('mkz-last-view', b.dataset.go) } catch (e) {} }));
      } else if (Date.now() - t0 > 15000) clearInterval(iv);
    }, 250);
  });

  /* ١) لوحة أوامر (Ctrl/⌘+K أو زرار 🔎): نط لأي قسم بالكتابة */
  safe(() => {
    const box = E('div', { id: 'pro-k' }, '<div><input placeholder="روح لأي قسم… (منتجات، فيديو، مظهر)" aria-label="بحث سريع"><section></section></div>');
    document.body.appendChild(box);
    const inp = $('input', box), list = $('section', box);
    const items = () => [...rail()].map(b => ({ id: b.dataset.go, t: b.textContent.trim() }));
    let sel = 0, cur = [];
    const draw = () => {
      const q = inp.value.trim(); cur = items().filter(i => !q || i.t.includes(q) || i.id.includes(q)); sel = Math.min(sel, Math.max(0, cur.length - 1));
      list.innerHTML = ''; cur.forEach((i, n) => { const b = E('button', { className: n === sel ? 'on' : '', textContent: i.t }); b.onclick = () => pick(i); list.appendChild(b); });
    };
    const open = () => { box.style.display = 'flex'; inp.value = ''; sel = 0; draw(); setTimeout(() => inp.focus(), 30); };
    const close = () => (box.style.display = 'none');
    const pick = i => { close(); goTo(i.id); };
    inp.addEventListener('input', () => { sel = 0; draw() });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, cur.length - 1); draw(); e.preventDefault() }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault() }
      else if (e.key === 'Enter' && cur[sel]) pick(cur[sel]);
    });
    box.addEventListener('click', e => { if (e.target === box) close() });
    addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open() } });
    const fab = E('button', { id: 'pro-fab', title: 'بحث سريع (Ctrl+K)', textContent: '🔎', onclick: open }); fab.setAttribute('aria-label', 'بحث سريع');
    document.body.appendChild(fab);
  });

  /* ١٣) دليل أول مرة للمونتاج الذكي + لوحة «إنجازاتي» (عدد الفيديوهات ووقت التصدير) */
  safe(() => {
    const css = E('style', {}, `
      #pro-tip{position:fixed;inset:0;z-index:99997;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px}
      #pro-tip>div{width:min(440px,100%);background:var(--sf,#141416);color:var(--tx,#F3EFE6);border:1px solid var(--ln,#333);border-radius:18px;padding:18px;font:600 15px/1.8 Cairo,sans-serif;box-shadow:0 20px 60px #000a}
      #pro-tip h3{margin:0 0 8px;font-size:19px}#pro-tip ol{margin:0;padding-inline-start:22px}#pro-tip button{margin-top:12px;width:100%;min-height:46px;border:0;border-radius:12px;background:var(--a2,#D4A537);color:#000;font:800 16px Cairo,sans-serif;cursor:pointer}
      #pro-tip .st{margin-top:10px;padding:10px;border-radius:12px;background:var(--sf2,#222);font-size:14px}`);
    document.head.appendChild(css);
    const stats = () => { try { return JSON.parse(localStorage.getItem('mkz-pro-stats') || '{"n":0,"sec":0}') } catch (e) { return { n: 0, sec: 0 } } };
    const show = () => {
      const s = stats(), mins = Math.round(s.sec / 60);
      const box = E('div', { id: 'pro-tip' }, `<div role="dialog" aria-label="إزاي تعمل مونتاج ذكي"><h3>🎬 المونتاج الذكي في ٥ خطوات</h3><ol>
        <li>ارفع الفيديو الأساسي (اتكلم عادي قدام الكاميرا).</li>
        <li>اختياري: ارفع <b>فيديوهات الإدراج</b> وقول في كلامك «هيظهرلكم فيديو تحت».</li>
        <li>اختياري: <b>موسيقى خلفية</b> (بتوطى لوحدها وانت بتتكلم) و<b>لوجو</b> المحل.</li>
        <li>اختار الطريقة ودوس <b>«✨ اعمل المونتاج الذكي هنا»</b> (مش زرار الخلفية القديم).</li>
        <li>راجع الكلام، صدّر، ودوس <b>📝 انسخ نص البوست</b> وانشر.</li></ol>
        <div class="st">📊 إنجازاتك: <b>${s.n}</b> فيديو اتصدّر${mins ? ` • ${mins} دقيقة تصدير` : ''}</div><button type="button">يلا نبدأ</button></div>`);
      box.addEventListener('click', e => { if (e.target === box || e.target.tagName === 'BUTTON') { box.remove(); try { localStorage.setItem('mkz-pro-tip', '1') } catch (e) {} } });
      document.body.appendChild(box);
    };
    window.mkzGuide = show;
    /* أول ما تفتح المونتاج الذكي لأول مرة */
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#rail button[data-go="smart"]'); if (!b) return; let seen = '1'; try { seen = localStorage.getItem('mkz-pro-tip') } catch (x) {} if (!seen) setTimeout(show, 600); });
    /* ودايمًا من زرار ❓ جنب 🔎 */
    const q = E('button', { id: 'pro-help', title: 'دليل وإنجازات', textContent: '❓', onclick: show }); q.setAttribute('aria-label', 'دليل المونتاج وإنجازاتي');
    q.style.cssText = 'position:fixed;inset-inline-start:12px;bottom:calc(134px + env(safe-area-inset-bottom,0px));z-index:9999;width:42px;height:42px;border-radius:50%;border:1px solid var(--ln,#333);background:var(--sf,#141416);color:var(--tx,#F3EFE6);font-size:18px;cursor:pointer;opacity:.8';
    document.body.appendChild(q);
  });

  /* ١٠) سرعة: اتصال مسبق بالخدمات (سوبابيز والخطوط) */
  safe(() => {
    ['https://rzvncstjattlklpdtkfn.supabase.co', 'https://tkzfjeizvanfptnqvrmr.supabase.co', 'https://fonts.gstatic.com'].forEach(h => document.head.appendChild(E('link', { rel: 'preconnect', href: h, crossOrigin: '' })));
  });
})();
