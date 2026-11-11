// @ts-nocheck
// 📤 «انشر في كل مكان»: شاشة واحدة بترفع الفيديو/الصورة مرة واحدة لمخزن الستوديو، وبعدين السيرفر بينشره على كل
// المنصات المربوطة في نفس الوقت (فيسبوك + إنستجرام + يوتيوب + تيك توك) بكابشن مناسب لكل منصة. المنصة اللي مش مربوطة
// بتظهر بزرار «اربط» مرة واحدة. بعد النشر الملف بيتمسح من المخزن. آخر ٣٠ نشر بيتحفظوا على الجهاز.
import { upload } from '@vercel/blob/client';

const $ = (id) => document.getElementById(id);
const E = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ar = (t) => String(t == null ? '' : t).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const toast = (m) => { try { window.__studio && window.__studio.toast ? window.__studio.toast(m) : alert(m); } catch { } };
const PL = [
  { k: 'facebook', n: 'فيسبوك', i: '📘', cap: 'fb', prov: 'meta' },
  { k: 'instagram', n: 'إنستجرام', i: '📸', cap: 'ig', prov: 'meta' },
  { k: 'youtube', n: 'يوتيوب', i: '▶️', cap: 'yt', prov: 'google', video: true },
  { k: 'tiktok', n: 'تيك توك', i: '🎵', cap: 'tt', prov: 'tiktok', video: true },
];
const PROVN = { meta: 'فيسبوك + إنستجرام', google: 'يوتيوب', tiktok: 'تيك توك' };
const HK = 'mkz-pubs';
let ST = null, CUR = null;

async function tok() {
  const M = window.mkzSmart; if (M && M.token) { try { const t = await M.token(); if (t) return t; } catch { } }
  throw new Error('سجّل دخول الستوديو الأول');
}
async function api(act, body) {
  const r = await fetch('/api/social/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tok: await tok() }) });
  const j = await r.json().catch(() => ({})); if (!r.ok && !('ok' in j)) throw new Error(j.error || ('السيرفر ' + r.status)); return j;
}
async function status(force) { if (ST && !force) return ST; ST = await api('status', {}); return ST; }
const hist = () => { try { return JSON.parse(localStorage.getItem(HK) || '[]'); } catch { return []; } };
const histAdd = (x) => { try { localStorage.setItem(HK, JSON.stringify([x, ...hist()].slice(0, 30))); } catch { } };

async function connect(prov) {
  try { const j = await api('connect', { provider: prov, back: location.origin + '/?pub=1' }); if (j.url) location.href = j.url; else toast(j.error || 'مقدرتش أبدأ الربط'); }
  catch (e) { toast(String(e.message || e)); }
}
async function disconnect(prov) { if (!confirm('تفصل ' + PROVN[prov] + ' عن الستوديو؟')) return; await api('disconnect', { provider: prov }).catch(() => { }); await status(true); paint(); }

function sheet() {
  let ov = $('mkpub'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'mkpub';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = '<div id="mkpub_b" style="background:var(--bg);color:var(--tx);width:100%;max-width:640px;max-height:94vh;overflow:auto;border-radius:20px 20px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px))"></div>';
  ov.addEventListener('click', (e) => { if (e.target === ov && !CUR?.busy) close(); });
  document.body.appendChild(ov); return ov;
}
function close() { const ov = $('mkpub'); if (ov) ov.remove(); if (CUR && CUR.prev) try { URL.revokeObjectURL(CUR.prev); } catch { } CUR = null; }

function paint() {
  const b = $('mkpub_b'); if (!b || !CUR) return; const s = ST || { apps: {}, conns: {} }, c = CUR;
  const isV = c.kind === 'video';
  const rows = PL.map((p) => {
    const on = !!s.conns[p.k], app = !!s.apps[p.prov], na = p.video && !isV, res = c.res[p.k];
    const st = res ? (res.ok ? '✅ ' + E(res.msg || 'اتنشر') + (res.link ? ` — <a href="${E(res.link)}" target="_blank" rel="noopener" style="color:var(--a1)">افتح</a>` : '') : res.pending ? '⏳ ' + E(res.msg) : res.run ? '⏳ بينشر…' : '⚠️ ' + E(res.msg || 'ماتنشرش'))
      : na ? 'للفيديو بس' : on ? '✔ ' + E(s.conns[p.k].name) : app ? 'مش مربوط' : 'محتاج مفاتيح من الأدمن';
    return `<div style="display:flex;gap:8px;align-items:center;padding:8px;border:1px solid var(--ln);border-radius:12px;margin-bottom:6px">
      <input type="checkbox" data-pp="${p.k}" ${c.sel[p.k] ? 'checked' : ''} ${!on || na || c.busy ? 'disabled' : ''} style="width:22px;min-height:22px;margin:0">
      <span style="font-size:22px">${p.i}</span><span style="flex:1;line-height:1.5"><b>${p.n}</b><br><small class="mu">${st}</small></span>
      ${!on && app && !na ? `<button type="button" class="b o" data-cn="${p.prov}" style="flex:none;padding:6px 10px">🔗 اربط</button>` : ''}</div>`;
  }).join('');
  const any = PL.some((p) => c.sel[p.k]);
  b.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="flex:1;font-size:18px">📤 انشر في كل مكان مرة واحدة</b><button type="button" class="b o" data-x="close" style="flex:none;padding:6px 12px" ${c.busy ? 'disabled' : ''}>✕</button></div>
   <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">${isV ? `<video src="${c.prev}" muted playsinline style="width:84px;height:120px;object-fit:cover;border-radius:10px;background:#000"></video>` : `<img src="${c.prev}" style="width:96px;height:96px;object-fit:cover;border-radius:10px;background:#fff">`}
    <div class="mu" style="flex:1">${isV ? '🎬 فيديو' : '🖼️ صورة'} — ${ar((c.blob.size / 1048576).toFixed(1))} ميجا<br>بيترفع مرة واحدة بس، والسيرفر بيبعته لكل المنصات المختارة مع بعض.</div></div>
   ${rows}
   ${c.busy ? `<div style="margin:10px 0"><div class="mu" id="mkpub_pg">${E(c.pg || '')}</div><div style="height:8px;border-radius:8px;background:var(--sf2);overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.round((c.pct || 0) * 100)}%;background:var(--a2);transition:width .2s"></div></div></div>` : ''}
   <div style="font-weight:800;margin:12px 0 6px">✍️ الكابشن لكل منصة</div>
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${PL.filter((p) => !(p.video && !isV)).map((p) => `<button type="button" class="ch${c.tab === p.k ? ' on' : ''}" data-tab="${p.k}">${p.n}</button>`).join('')}</div>
   <textarea id="mkpub_cap" style="width:100%;min-height:140px;line-height:1.7" ${c.busy ? 'disabled' : ''}>${E(c.caps[c.tab] || '')}</textarea>
   ${isV ? `<input id="mkpub_ti" placeholder="عنوان (يوتيوب)" value="${E(c.title || '')}" style="width:100%;margin-top:6px" ${c.busy ? 'disabled' : ''}>` : ''}
   <button type="button" class="b" data-x="go" style="width:100%;min-height:56px;font-size:18px;margin-top:10px;${!any && !c.busy ? 'opacity:.45;filter:grayscale(1)' : ''}" ${!any || c.busy ? 'disabled' : ''}>${c.busy ? '⏳ بينشر…' : !any ? '🚫 مفيش منصة جاهزة ' + (isV ? 'للفيديو ده' : 'للصورة دي') : c.done ? '📤 انشر تاني' : '📤 انشر على ' + ar(PL.filter((p) => c.sel[p.k]).length) + ' منصة دلوقتي'}</button>
   ${!any && !c.busy ? `<p style="margin:8px 0 0;padding:10px;border-radius:12px;border:1px solid var(--a2);line-height:1.8">${!isV && PL.some((p) => p.video && s.conns[p.k]) ? 'ℹ️ ' + PL.filter((p) => p.video && s.conns[p.k]).map((p) => p.n).join(' و') + ' مربوط بس بياخد <b>فيديو</b> مش صورة. الصور بتتنشر على فيسبوك وإنستجرام، ودول لسه مش مربوطين.' : 'ℹ️ مفيش منصة مربوطة تنفع هنا لسه. اربط حساباتك مرة واحدة من «🔗 الحسابات المربوطة» تحت.'}<br>لحد ما الربط يكمل: استخدم «حفظ» وشارك الملف بإيدك.</p>` : ''}
   ${!PL.some((p) => s.conns[p.k]) ? '<p class="mu" style="margin:8px 0 0">اربط حساباتك مرة واحدة (زرار «🔗 اربط» جنب كل منصة)، وبعد كده كل فيديو أو بوست بدوسة واحدة.</p>' : ''}
   <details style="margin-top:12px"><summary class="mu" style="cursor:pointer">🔗 الحسابات المربوطة</summary>${Object.keys(PROVN).map((pv) => { const ks = PL.filter((p) => p.prov === pv), on = ks.some((p) => s.conns[p.k]); return `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="flex:1">${PROVN[pv]}: ${on ? ks.filter((p) => s.conns[p.k]).map((p) => E(s.conns[p.k].name)).join('، ') : '<span class="mu">مش مربوط</span>'}</span>${on ? `<button type="button" class="b o" data-dc="${pv}" style="flex:none;padding:4px 10px">افصل</button><button type="button" class="b o" data-cn="${pv}" style="flex:none;padding:4px 10px">اربط تاني</button>` : s.apps[pv] ? `<button type="button" class="b o" data-cn="${pv}" style="flex:none;padding:4px 10px">اربط</button>` : '<small class="mu">الأدمن يحط المفاتيح من لوحة التحكم</small>'}</div>`; }).join('')}</details>
   ${hist().length ? `<details style="margin-top:8px"><summary class="mu" style="cursor:pointer">🕘 آخر حاجات اتنشرت</summary>${hist().slice(0, 10).map((h) => `<div style="padding:6px 0;border-bottom:1px solid var(--ln);font-size:13px"><b>${E(h.title || (h.kind === 'video' ? 'فيديو' : 'صورة'))}</b> <small class="mu">${new Date(h.t).toLocaleString('ar-EG')}</small><br>${Object.entries(h.res).map(([k, r]) => `${(PL.find((p) => p.k === k) || {}).i || ''} ${r.ok ? (r.link ? `<a href="${E(r.link)}" target="_blank" rel="noopener" style="color:var(--a1)">اتنشر</a>` : 'اتنشر') : '⚠️'}`).join(' · ')}</div>`).join('')}</details>` : ''}`;
}

async function go() {
  const c = CUR; if (!c || c.busy) return; c.caps[c.tab] = ($('mkpub_cap') || {}).value ?? c.caps[c.tab]; if ($('mkpub_ti')) c.title = $('mkpub_ti').value;
  const plats = PL.filter((p) => c.sel[p.k]).map((p) => p.k); if (!plats.length) return;
  c.busy = true; c.done = false; c.res = {}; c.pct = 0; c.pg = '⬆️ برفع الملف مرة واحدة…'; paint();
  let url = '';
  try {
    const t = await tok(), ext = (c.blob.type.split('/')[1] || (c.kind === 'video' ? 'mp4' : 'jpg')).replace('quicktime', 'mov').replace('jpeg', 'jpg').split(';')[0];
    const r = await upload('pub/' + Date.now() + '.' + ext, c.blob, { access: 'public', handleUploadUrl: '/api/blob', clientPayload: JSON.stringify({ tok: t }), multipart: c.blob.size > 8 * 1024 * 1024, contentType: c.blob.type || (c.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      onUploadProgress: (e) => { c.pct = e.percentage / 100 * .5; c.pg = '⬆️ برفع الملف… ' + ar(Math.round(e.percentage)) + '٪'; const g = $('mkpub_pg'); if (g) g.textContent = c.pg; else paint(); } });
    url = r.url;
  } catch (e) { c.busy = false; c.pg = ''; toast('الرفع وقف: ' + String(e.message || e)); paint(); return; }
  c.pct = .55; c.pg = '📤 بنشر على ' + ar(plats.length) + ' منصة مع بعض…'; plats.forEach((k) => { c.res[k] = { run: true }; }); paint();
  const one = async (k) => {
    const p = PL.find((x) => x.k === k);
    try {
      let r = await api('publish', { platform: k, url, kind: c.kind, caption: c.caps[k] ?? c.caps[p.cap] ?? '', title: c.title || '', size: c.blob.size, type: c.blob.type || '' });
      for (let i = 0; r && r.pending && i < 30; i++) { c.res[k] = r; paint(); await new Promise((z) => setTimeout(z, 5000)); r = await api('ig-finish', { id: r.pending }); }
      c.res[k] = r || { ok: false, msg: 'مفيش رد' };
    } catch (e) { c.res[k] = { ok: false, msg: String(e.message || e) }; }
    c.pct = .55 + .45 * plats.filter((x) => c.res[x] && !c.res[x].run && !c.res[x].pending).length / plats.length; paint();
  };
  await Promise.all(plats.map(one));
  c.busy = false; c.done = true; c.pg = '';
  histAdd({ t: Date.now(), kind: c.kind, title: c.title || (c.caps.fb || '').split('\n')[0].slice(0, 60), res: c.res });
  fetch('/api/blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ del: url, tok: await tok().catch(() => '') }) }).catch(() => { });
  const ok = plats.filter((k) => c.res[k].ok).length;
  toast(ok === plats.length ? '✅ اتنشر على كل المنصات' : ok ? `✅ اتنشر على ${ar(ok)} من ${ar(plats.length)} — شوف السبب جنب الباقي` : '⚠️ ماتنشرش — شوف السبب جنب كل منصة');
  paint();
}

/** افتح شاشة النشر: { blob, kind:'video'|'image', caps:{fb,ig,yt,tt}, title } */
async function open(o) {
  if (!o || !o.blob) return toast('مفيش ملف ينتشر');
  CUR = { blob: o.blob, kind: o.kind === 'image' || /^image\//.test(o.blob.type) ? 'image' : 'video', caps: { fb: '', ig: '', yt: '', tt: '', ...(o.caps || {}) }, title: o.title || '', sel: {}, res: {}, tab: 'facebook', prev: URL.createObjectURL(o.blob) };
  CUR.caps.facebook = CUR.caps.fb; CUR.tab = 'facebook';
  PL.forEach((p) => { CUR.caps[p.k] = CUR.caps[p.cap] || CUR.caps.fb || ''; });
  sheet(); paint();
  try { await status(true); } catch (e) { toast(String(e.message || e)); }
  PL.forEach((p) => { CUR.sel[p.k] = !!(ST && ST.conns[p.k]) && !(p.video && CUR.kind !== 'video'); });
  paint();
  const b = $('mkpub_b');
  b.onclick = (e) => {
    const t = e.target.closest('[data-x],[data-cn],[data-dc],[data-tab]'); if (!t || !CUR) return;
    if (t.dataset.x === 'close') return close();
    if (t.dataset.x === 'go') return go();
    if (t.dataset.cn) return connect(t.dataset.cn);
    if (t.dataset.dc) return disconnect(t.dataset.dc);
    if (t.dataset.tab) { CUR.caps[CUR.tab] = $('mkpub_cap').value; CUR.tab = t.dataset.tab; paint(); }
  };
  b.onchange = (e) => { const c = e.target.closest('[data-pp]'); if (c && CUR) { CUR.sel[c.dataset.pp] = c.checked; paint(); } };
  b.oninput = (e) => { if (e.target.id === 'mkpub_cap' && CUR) CUR.caps[CUR.tab] = e.target.value; if (e.target.id === 'mkpub_ti' && CUR) CUR.title = e.target.value; };
}

/* أزرار «انشر في كل مكان» في تصميم البوست + رجوع الربط */
function hookPost() {
  const sva = $('sva'); if (!sva || $('mkpub_post')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'b'; b.id = 'mkpub_post'; b.textContent = '📤 انشر في كل مكان'; sva.insertAdjacentElement('afterend', b);
  b.onclick = async () => {
    const im = $('out'); if (!im || !im.src) return toast('صمّم البوست الأول');
    const blob = await (await fetch(im.src)).blob(); const cap = ($('cap') || {}).value || '';
    open({ blob, kind: 'image', caps: { fb: cap, ig: cap, tt: cap, yt: cap }, title: ($('hd') || {}).value || '' });
  };
}
export function mountPublish() {
  window.mkPublish = { open, status: () => status(true) };
  const iv = setInterval(() => { hookPost(); if ($('mkpub_post')) clearInterval(iv); }, 800); setTimeout(() => clearInterval(iv), 30000);
  const q = new URLSearchParams(location.search);
  if (q.get('social')) {
    const ok = q.get('social') === 'ok', m = q.get('msg') || '';
    setTimeout(() => toast(ok ? '✅ اتربط: ' + (q.get('got') || '').split(',').map((k) => (PL.find((p) => p.k === k) || {}).n || k).join(' + ') + ' — ارجع لآخر فيديو أو بوست ودوس «انشر في كل مكان»' : '⚠️ الربط ماتمّش: ' + m), 1500);
    history.replaceState(null, '', location.pathname);
  }
}
