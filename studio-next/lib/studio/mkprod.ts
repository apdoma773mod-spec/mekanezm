// @ts-nocheck
// 🔗 منتجات ميكانيزم جوه صفحة «المنتجات» في الستوديو: البحث بيجيب من السيستم (كل الأصناف بأسعارها ومخزونها وصورها
// ومواصفاتها) ومن الموقع (المنتجات المعروضة ووصفها ولينكها)، والدوسة على المنتج بتفتح كارت كامل فيه كل بياناته
// (اللي مش مكتوب في السيستم مابيظهرش)، ومنه: بوست، كابشن جاهز لكل منصة، فيديو مونتاج، صوره في الفيديو، لينك الطلب
// من الموقع + QR، رسالة واتساب، أفكار هوك، والتحذير لو المنتج خلصان. كله قراية بس من السيستم عن طريق /api/mk.
import qrcode from 'qrcode-generator';

const SITE_URL = 'https://mekanezm.vercel.app';
const LSK = 'mkz-sys';
const $ = (id) => document.getElementById(id);
const E = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ar = (t) => String(t == null ? '' : t).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const en = (t) => String(t == null ? '' : t).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const norm = (w) => String(w).replace(/[ً-ْـ.,،؟!?:؛"«»()]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const toast = (m) => { try { window.__studio && window.__studio.toast ? window.__studio.toast(m) : alert(m); } catch { } };
const money = (n) => { const v = +n; return v > 0 ? ar(v.toLocaleString('en-US')) + ' جنيه' : ''; };

const SYS = { at: '', rt: '', user: null };
const sysLoad = () => { try { Object.assign(SYS, { at: '', rt: '', user: null }, JSON.parse(localStorage.getItem(LSK) || '{}')); } catch { } };
const sysSave = () => { try { localStorage.setItem(LSK, JSON.stringify({ at: SYS.at, rt: SYS.rt, user: SYS.user })); } catch { } };
const mkImg = (u) => { u = String(u || ''); const m = u.match(/\/api\/v1\/(work\/files\/[\w.-]+)/); return m ? '/api/mk/' + m[1] : u; };

async function sysGet(path, noAuth) {
  sysLoad();
  const go = () => fetch('/api/mk/' + path, { headers: SYS.at && !noAuth ? { 'x-mk-at': SYS.at } : {}, cache: 'no-store' });
  let r = await go();
  if (r.status === 401 && !noAuth && SYS.rt) {
    const rr = await fetch('/api/mk/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rt: SYS.rt }) });
    const j = await rr.json().catch(() => ({}));
    if (rr.ok && j.at) { SYS.at = j.at; SYS.rt = j.rt || SYS.rt; sysSave(); r = await go(); } else { SYS.at = ''; SYS.rt = ''; sysSave(); }
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401) { SYS.at = ''; sysSave(); } throw Object.assign(new Error((j.error && j.error.message) || j.message || (typeof j.error === 'string' ? j.error : '') || ('السيستم ' + r.status)), { status: r.status }); }
  return j;
}

let SITE = null, INFO = null, RES = [], Q = '', BUSY = 0, ERR = '', TO = 0, CUR = null;
async function siteLoad() { if (SITE) return SITE; try { const j = await sysGet('web/public/site', true); SITE = (j && j.site && j.site.data) || {}; } catch { SITE = null; } return SITE; }
async function infoLoad() { sysLoad(); if (INFO || !SYS.at) return INFO; try { const j = await sysGet('products/info/all'); const m = {}; (j.items || j.info || (Array.isArray(j) ? j : [])).forEach((r) => { if (r && r.productId) m[r.productId] = r; }); INFO = m; } catch { } return INFO; }
const siteProds = () => ((SITE && SITE.products) || []);
const secName = (id) => { const s = ((SITE && SITE.sections) || []).find((x) => x.id === id); return s ? s.name : ''; };

/** منتج موحّد: بيانات السيستم + معلومات الصنف + بيانات الموقع (اللي موجود بس) */
function unify(sys, site) {
  const inf = sys && INFO ? INFO[sys.id] : null;
  const imgs = [].concat(
    inf && Array.isArray(inf.imgs) ? inf.imgs.map((x) => (typeof x === 'string' ? x : (x && (x.url || x.src)) || '')) : [],
    site ? (site.imgs || [site.img]) : [],
  ).filter(Boolean).map(mkImg).filter((u, i, a) => a.indexOf(u) === i).slice(0, 24);
  const packs = inf && Array.isArray(inf.packs) ? inf.packs.map((p) => (typeof p === 'string' ? p : [p.name || p.n, p.qty || p.q, p.price ? money(p.price) : ''].filter(Boolean).join(' '))).filter(Boolean) : [];
  return {
    sid: sys ? sys.id : '', siteId: site ? site.id : '',
    code: String((sys && sys.code) || (site && site.code) || ''),
    name: String((sys && sys.name) || (site && site.name) || ''),
    barcode: sys && sys.barcode || '', category: (sys && sys.category) || (site ? secName(site.sec) : ''),
    unit: sys && sys.unit || '', price: sys && +sys.price > 0 ? +sys.price : 0,
    qty: sys && sys.qty != null ? +sys.qty : null, minQty: sys && sys.minQty != null ? +sys.minQty : null,
    company: sys && sys.company || '', note: sys && sys.note || '',
    brand: inf && inf.brand || '', size: inf && inf.size || '', finish: inf && inf.finish || '', specs: inf && inf.specs || '',
    descr: (inf && inf.descr) || (site && site.desc) || '', loc: inf && inf.loc || '', packs, imgs,
    onSite: !!site, fromSys: !!sys,
  };
}
const link = (p) => (p.siteId ? SITE_URL + '/p/' + encodeURIComponent(p.siteId) : SITE_URL + '/search?q=' + encodeURIComponent(p.name));

async function search(q) {
  Q = q; ERR = ''; const qq = String(q || '').trim();
  if (qq.length < 2) { RES = []; paint(); return; }
  BUSY++; paint();
  try {
    await siteLoad(); sysLoad(); let L = [];
    const sp = siteProds();
    if (SYS.at) {
      await infoLoad();
      const j = await sysGet('products/all?q=' + encodeURIComponent(en(qq)));
      if (Q !== q) { BUSY--; return; }
      L = (j.items || []).slice(0, 80).map((s) => unify(s, sp.find((x) => x.code && String(x.code) === String(s.code))));
    }
    const n = norm(qq);
    sp.filter((x) => norm(x.name || '').includes(n) || String(x.code) === qq).forEach((x) => { if (!L.some((y) => y.code && y.code === String(x.code))) L.push(unify(null, x)); });
    RES = L;
  } catch (e) { ERR = e.status === 401 ? 'login' : String(e.message || e).slice(0, 160); }
  BUSY--; paint();
}

async function login() {
  const l = $('mkp_l'), pw = $('mkp_p'), b = $('mkp_go'); if (!l || !pw) return;
  if (!l.value.trim() || !pw.value) return toast('اكتب رقم الموبايل وكلمة السر بتاعة السيستم');
  b.disabled = true; b.textContent = '⏳';
  try {
    const r = await fetch('/api/mk/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: en(l.value.trim()), password: pw.value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.at) throw new Error(j.error || 'الدخول ماتمّش');
    SYS.at = j.at; SYS.rt = j.rt || ''; SYS.user = j.user ? { name: j.user.name || '', role: j.user.role || '' } : null; sysSave(); INFO = null; pw.value = '';
    toast('✅ الستوديو اتربط بالسيستم'); const q = $('q1'); if (q && q.value.trim()) search(q.value);
  } catch (e) { toast(String(e.message || e)); }
  b.disabled = false; b.textContent = 'ادخل'; paint();
}

function stockTxt(p) { if (p.qty == null) return ''; if (p.qty <= 0) return '✖ خلصان'; if (p.minQty != null && p.qty <= p.minQty) return '⚠️ قرّب يخلص (' + ar(p.qty) + ')'; return '✔ متاح (' + ar(p.qty) + (p.unit ? ' ' + E(p.unit) : '') + ')'; }

function paint() {
  const box = $('mkp'); if (!box) return; sysLoad();
  const head = SYS.at
    ? `<div class="mu" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">🔗 مربوط بالسيستم${SYS.user && SYS.user.name ? ' — ' + E(SYS.user.name) : ''} + الموقع<button type="button" class="b o" id="mkp_out" style="padding:2px 10px;min-height:30px;font-size:12px">خروج</button></div>`
    : `<div style="border:1px dashed var(--a2);border-radius:12px;padding:10px"><div class="mu" style="margin-bottom:6px">🔗 ادخل بحساب <b>السيستم</b> مرة واحدة عشان البحث يجيب كل الأصناف بأسعارها ومخزونها وصورها ومواصفاتها. (من غير دخول بيدوّر في منتجات الموقع بس)</div><input id="mkp_l" placeholder="رقم الموبايل أو الإيميل" autocomplete="username" dir="ltr" style="width:100%;margin-bottom:6px"><input id="mkp_p" type="password" placeholder="كلمة السر" autocomplete="current-password" style="width:100%;margin-bottom:6px"><button type="button" class="b" id="mkp_go" style="width:100%">ادخل</button></div>`;
  let body = '';
  if (BUSY) body = '<p class="mu">⏳ بدوّر في السيستم والموقع…</p>';
  else if (ERR === 'login') body = '<p class="mu">⚠️ الدخول خلص — ادخل تاني بحساب السيستم</p>';
  else if (ERR) body = '<p class="mu">⚠️ ' + E(ERR) + '</p>';
  else if (Q.trim().length >= 2) {
    body = RES.length ? `<div class="mu" style="margin:6px 0">${ar(RES.length)} منتج من السيستم والموقع — دوس على المنتج يفتح الكارت بتاعه</div>` + RES.map((p, i) => `<button type="button" class="it" data-mkp="${i}" style="display:flex;gap:10px;align-items:center;width:100%;text-align:right;background:var(--sf);border:1px solid var(--ln);border-radius:12px;padding:8px;margin-bottom:6px;color:var(--tx);cursor:pointer">${p.imgs[0] ? `<img src="${E(p.imgs[0])}" loading="lazy" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none;background:#222">` : '<span style="width:56px;height:56px;border-radius:10px;background:var(--sf2);flex:none;display:grid;place-items:center;font-size:24px">📦</span>'}<span style="flex:1;min-width:0;line-height:1.5"><b style="display:block">${E(p.name)}</b><small class="mu">${p.code ? '#' + E(p.code) + ' · ' : ''}${p.price ? money(p.price) + ' · ' : ''}${stockTxt(p) || (p.onSite ? 'من الموقع' : '')}</small></span><span style="flex:none;font-size:20px">‹</span></button>`).join('')
      : '<p class="mu">مالقيتش منتج بالاسم ده' + (SYS.at ? ' في السيستم ولا الموقع' : ' في الموقع — ادخل بحساب السيستم تدوّر في كل الأصناف') + '</p>';
  }
  box.innerHTML = `<div style="font-weight:800;margin:4px 0 6px">🔎 منتجات ميكانيزم (السيستم + الموقع)</div>${head}<div id="mkp_r" style="margin-top:8px">${body}</div>`;
}

/* ---------- الكابشن الجاهز لكل منصة (من بيانات المنتج نفسه — من غير ما يخترع حاجة) ---------- */
function brandInfo() { const s = SITE || {}; return { shop: 'ميكانيزم', phone: String(s.phone || ''), addr: String(s.address || ''), del: String(s.deliveryNote || '') }; }
const tags = (p) => { const w = ['ميكانيزم', 'اكسسوارات_مطابخ', 'دريسنج_روم']; if (p.category) w.push(p.category.replace(/\s+/g, '_')); p.name.split(/\s+/).filter((x) => x.length > 3).slice(0, 3).forEach((x) => w.push(x)); return [...new Set(w)].map((x) => '#' + x).join(' '); };
function captions(p) {
  const b = brandInfo(), pr = p.price ? money(p.price) : '', feat = [p.brand && 'الماركة: ' + p.brand, p.size && 'المقاس: ' + p.size, p.finish && 'اللون/التشطيب: ' + p.finish].filter(Boolean);
  const specs = String(p.specs || '').split(/\n|•|،|;/).map((x) => x.trim()).filter((x) => x && x.length < 80).slice(0, 4);
  const d = String(p.descr || '').replace(/\s+/g, ' ').trim(), d1 = d.length > 220 ? d.slice(0, 217) + '…' : d;
  const stock = p.qty == null ? '' : p.qty > 0 ? '✅ متاح دلوقتي' : '';
  const L = link(p);
  const fb = [`✨ ${p.name}`, d1, ...feat.map((x) => '▪️ ' + x), ...specs.map((x) => '▪️ ' + x), pr && '💰 السعر: ' + pr, stock, b.del && '🚚 ' + b.del, '🛒 اطلبه من الموقع: ' + L, b.phone && '📞 واتساب: ' + b.phone, b.addr && '📍 ' + b.addr, '', tags(p)].filter((x) => x !== '' && x != null && x !== false).join('\n');
  const ig = [`${p.name} ✨`, d1 && d1.slice(0, 140), pr && '💰 ' + pr, stock, '🛒 اللينك في البايو أو ابعتلنا رسالة', b.phone && '📞 ' + b.phone, '', tags(p)].filter(Boolean).join('\n');
  const tt = [`${p.name}${pr ? ' بـ ' + pr : ''} 🔥`, 'اطلبه دلوقتي من ميكانيزم 👇', tags(p)].join('\n');
  const wa = [`السلام عليكم 👋`, `*${p.name}*`, d1 && d1.slice(0, 160), pr && 'السعر: ' + pr, stock, 'تفاصيل وصور وطلب: ' + L, b.phone && 'للاستفسار: ' + b.phone].filter(Boolean).join('\n');
  return { fb, ig, tt, wa };
}
/* أفكار هوك وزوايا فيديو مبنية على بيانات المنتج */
function ideas(p) {
  const n = p.name.split(/\s+/).slice(0, 4).join(' '), pr = p.price ? money(p.price) : '';
  const L = [
    ['🎯 مشكلة ← حل', `«لسه بتعاني من ${p.category || 'المشكلة دي'}؟» ← وريهم ${n} وهو بيحلها في ٣ ثواني`],
    ['💰 كشف السعر', pr ? `«خمّن سعر ${n}؟» ← سيب الناس تخمّن وبعدين اظهر ${pr}` : `«خمّن سعر ${n}؟» ← اظهر السعر في الآخر`],
    ['⚖️ مقارنة', `العادي اللي بيبوظ جنب ${n} — نفس الاستعمال قدام الكاميرا`],
    ['🔧 تركيب سريع', `ركّب ${n} في أقل من دقيقة — صوّر الخطوات من فوق`],
    ['📏 المقاسات', p.size ? `قيس قدام الكاميرا: ${p.size} — مناسب لأنهي دولاب/مطبخ` : `قيس المنتج قدام الكاميرا وقول يناسب إيه`],
    ['⭐ رأي عميل', `صوّر عميل استخدم ${n} وقال رأيه في ١٠ ثواني`],
  ];
  if (p.qty != null && p.minQty != null && p.qty > 0 && p.qty <= p.minQty) L.unshift(['⏳ كمية محدودة', `«فاضل ${ar(p.qty)} بس من ${n}» — عرض حقيقي من المخزن`]);
  return L;
}
function qrPng(text) { try { const q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(text)), 'Byte'); q.make(); const n = q.getModuleCount(), px = 10, m = 4, c = document.createElement('canvas'); c.width = c.height = (n + 2 * m) * px; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + m) * px, (r + m) * px, px, px); return c.toDataURL('image/png'); } catch { return ''; } }

async function imgFiles(p, max) {
  const urls = p.imgs.slice(0, max || 20), out = [];
  await Promise.all(urls.map(async (u, k) => { try { const r = await fetch(u); if (!r.ok) return; const b = await r.blob(); if (!/^image\//.test(b.type)) return; out[k] = new File([b], (p.code || 'prod') + '-' + (k + 1) + '.' + ((b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')), { type: b.type }); } catch { } }));
  return out.filter(Boolean);
}
function toStudio(p) { return { nm: p.name, dn: p.name, bar: p.barcode || p.code, pr: p.price ? String(p.price) : '', cat: p.category || '', nt: [p.size, p.finish, p.brand].filter(Boolean).join(' • ') || (p.descr || '').slice(0, 80), img: p.imgs[0] || '', code: p.code, mk: 1 }; }
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('📋 اتنسخ'); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('📋 اتنسخ'); } catch { toast('انسخه بإيدك'); } a.remove(); } };

/* ---------- كارت المنتج الكامل ---------- */
function openCard(p) {
  CUR = p; const old = $('mkpc'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'mkpc';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center';
  const row = (k, v) => (v === '' || v == null ? '' : `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--ln)"><span class="mu" style="flex:none;min-width:92px">${k}</span><span style="flex:1">${v}</span></div>`);
  const out = p.qty != null && p.qty <= 0, cap = captions(p);
  const lk = link(p), qr = qrPng(lk);
  ov.innerHTML = `<div style="background:var(--bg);color:var(--tx);width:100%;max-width:640px;max-height:94vh;overflow:auto;border-radius:20px 20px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px))">
   <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="flex:1;font-size:18px;line-height:1.4">${E(p.name)}</b><button type="button" class="b o" data-x="close" style="flex:none;padding:6px 12px">✕</button></div>
   ${p.imgs.length ? `<div style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px">${p.imgs.map((u) => `<img src="${E(u)}" alt="" loading="lazy" style="height:220px;max-width:85%;object-fit:contain;border-radius:14px;background:#fff;scroll-snap-align:center;flex:none">`).join('')}</div><div class="mu" style="font-size:12px">${ar(p.imgs.length)} صورة — اسحب يمين وشمال</div>` : '<div class="mu">مفيش صور للمنتج ده في السيستم أو الموقع</div>'}
   ${out ? '<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,80,80,.15);border:1px solid rgba(255,80,80,.5)">⚠️ المنتج ده <b>خلصان</b> من المخزن — بلاش إعلان ممول عليه دلوقتي، أو قول «احجز قبل ما يوصل».</div>' : ''}
   <div class="p" style="margin-top:8px">
    ${row('السعر', p.price ? '<b style="font-size:18px">' + money(p.price) + '</b>' + (p.unit ? ' / ' + E(p.unit) : '') : '')}
    ${row('المخزون', stockTxt(p))}
    ${row('الكود', E(p.code))}${row('الباركود', p.barcode && p.barcode !== p.code ? E(p.barcode) : '')}
    ${row('القسم', E(p.category))}${row('الماركة', E(p.brand))}${row('المقاس', E(p.size))}${row('التشطيب', E(p.finish))}
    ${row('المواصفات', E(p.specs).replace(/\n/g, '<br>'))}${row('الوصف', E(p.descr).replace(/\n/g, '<br>'))}
    ${row('العبوات', p.packs.map(E).join('<br>'))}${row('مكانه', E(p.loc))}${row('ملاحظة', E(p.note))}
    ${row('على الموقع', p.onSite ? '✔ معروض — <a href="' + E(lk) + '" target="_blank" rel="noopener" style="color:var(--a1)">افتح صفحته</a>' : 'مش معروض — اللينك بيفتح البحث في الموقع')}
   </div>
   <div style="font-weight:800;margin:12px 0 6px">⚡ اعمل بيه إيه؟</div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <button type="button" class="b" data-x="post">🖼️ صمّم بوست</button>
    <button type="button" class="b" data-x="vid">🎬 فيديو مونتاج ذكي</button>
    <button type="button" class="b o" data-x="imgs" ${p.imgs.length ? '' : 'disabled'}>🖼️ صوره في المونتاج</button>
    <button type="button" class="b o" data-x="save">➕ ضيفه لمنتجات الستوديو</button>
    <button type="button" class="b o" data-x="link">🛒 انسخ لينك الطلب</button>
    <button type="button" class="b o" data-x="wa">💬 ابعته واتساب</button>
    <button type="button" class="b o" data-x="all">📋 انسخ كل بياناته</button>
    <button type="button" class="b o" data-x="dl" ${p.imgs.length ? '' : 'disabled'}>⬇️ نزّل صوره</button>
   </div>
   <div style="font-weight:800;margin:14px 0 6px">✍️ كابشن جاهز</div>
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${[['fb', 'فيسبوك'], ['ig', 'انستجرام'], ['tt', 'تيك توك'], ['wa', 'واتساب']].map(([k, n], i) => `<button type="button" class="ch${i ? '' : ' on'}" data-cap="${k}">${n}</button>`).join('')}</div>
   <textarea id="mkpc_cap" style="width:100%;min-height:170px;line-height:1.7">${E(cap.fb)}</textarea>
   <button type="button" class="b o" data-x="capcopy" style="width:100%;margin-top:6px">📋 انسخ الكابشن</button>
   <div style="font-weight:800;margin:14px 0 6px">💡 أفكار فيديو للمنتج ده</div>
   ${ideas(p).map(([t, d]) => `<div style="padding:8px 10px;border:1px solid var(--ln);border-radius:12px;margin-bottom:6px"><b>${t}</b><div class="mu" style="margin-top:2px">${E(d)}</div></div>`).join('')}
   ${qr ? `<div style="font-weight:800;margin:14px 0 6px">📲 QR لصفحة المنتج</div><div style="display:flex;gap:10px;align-items:center"><img src="${qr}" alt="QR" style="width:120px;height:120px;border-radius:10px;background:#fff"><div style="flex:1"><div class="mu" style="font-size:12px;word-break:break-all">${E(lk)}</div><button type="button" class="b o" data-x="qr" style="margin-top:6px">⬇️ نزّل الـ QR</button></div></div>` : ''}
  </div>`;
  document.body.appendChild(ov);
  let capK = 'fb';
  ov.onclick = async (e) => {
    if (e.target === ov) return ov.remove();
    const c = e.target.closest('[data-cap]'); if (c) { capK = c.dataset.cap; ov.querySelectorAll('[data-cap]').forEach((x) => x.classList.toggle('on', x === c)); $('mkpc_cap').value = cap[capK]; return; }
    const b = e.target.closest('[data-x]'); if (!b || b.disabled) return; const x = b.dataset.x, S = window.__studio || {};
    if (x === 'close') return ov.remove();
    if (x === 'capcopy') return copy($('mkpc_cap').value);
    if (x === 'link') return copy(lk);
    if (x === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(cap.wa), '_blank'); return; }
    if (x === 'all') return copy([p.name, p.price && 'السعر: ' + p.price + ' جنيه', p.code && 'الكود: ' + p.code, p.category && 'القسم: ' + p.category, p.brand && 'الماركة: ' + p.brand, p.size && 'المقاس: ' + p.size, p.finish && 'التشطيب: ' + p.finish, p.specs, p.descr, p.qty != null && 'المخزون: ' + p.qty, 'اللينك: ' + lk].filter(Boolean).join('\n'));
    if (x === 'qr') { const a = document.createElement('a'); a.href = qr; a.download = 'qr-' + (p.code || 'product') + '.png'; a.click(); return; }
    if (x === 'save') { if (S.addProd) { S.addProd(toStudio(p)); toast('✅ اتضاف لمنتجات الستوديو'); } return; }
    if (x === 'post') { if (!S.addProd || !S.design) return toast('الستوديو لسه بيحمّل'); const sp = S.addProd(toStudio(p)); ov.remove(); S.design(sp); return; }
    if (x === 'vid' || x === 'imgs') {
      const M = window.mkzSmart; if (!M || !M.useProduct) return toast('المونتاج لسه بيحمّل');
      b.disabled = true; const t0 = b.textContent; b.textContent = '⏳';
      try { await M.useProduct(toStudio(p), p, x === 'imgs' ? await imgFiles(p, 30) : null); ov.remove(); } catch (er) { toast(String(er.message || er)); }
      b.disabled = false; b.textContent = t0; return;
    }
    if (x === 'dl') { b.disabled = true; const fs = await imgFiles(p, 24); b.disabled = false; if (!fs.length) return toast('مقدرتش أجيب الصور'); try { if (navigator.canShare && navigator.canShare({ files: fs })) { await navigator.share({ files: fs, title: p.name }); return; } } catch { } fs.forEach((f) => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }); }
  };
}

export function mountProducts() {
  const tryMount = () => {
    const q = $('q1'); if (!q) return false; if ($('mkp')) return true;
    const box = document.createElement('div'); box.id = 'mkp'; box.className = 'p'; box.style.marginTop = '10px';
    const host = q.closest('.p'); (host && host.parentNode ? host : q).insertAdjacentElement('afterend', box);
    q.addEventListener('input', () => { clearTimeout(TO); TO = setTimeout(() => search(q.value), 380); });
    box.addEventListener('click', (e) => {
      const t = e.target; if (t.id === 'mkp_go') return login();
      if (t.id === 'mkp_out') { SYS.at = ''; SYS.rt = ''; SYS.user = null; INFO = null; sysSave(); paint(); return; }
      const r = t.closest('[data-mkp]'); if (r) { const p = RES[+r.dataset.mkp]; if (p) openCard(p); }
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'mkp_p' || e.target.id === 'mkp_l')) login(); });
    paint(); siteLoad().then(() => { if (q.value.trim()) search(q.value); });
    return true;
  };
  if (!tryMount()) { let n = 0; const iv = setInterval(() => { if (tryMount() || ++n > 60) clearInterval(iv); }, 500); }
  (window as any).__mkProd = { search, open: (i) => RES[i] && openCard(RES[i]), state: () => ({ RES, Q, ERR, site: !!SITE, on: !!SYS.at }) };
}
