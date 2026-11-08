// شاشة «🧩 القوالب»: ٤ خطوات واحدة واحدة (صورك ← القالب ← الكلام ← جاهز) وزرار ثابت تحت — مريحة على الآيفون.
import { loadFiles, freeItem, MAX_ITEMS, type Item } from './media';
import { STYLES, PALS, CATS, ASPECTS, MOODS, styleById, palById, timeline, arN, TOTAL_TEMPLATES, type Style } from './styles';
import { frame, poster, posterCount, stopVideos, clearCaches, type Proj, type Texts } from './render';
import { makeMusic, decodeMusic } from './music';
import { officialLogo } from './logo';

const $ = (id: string) => document.getElementById(id) as any;
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const toast = (m: string) => { const t = $('toast'); if (!t) return alert(m); t.textContent = m; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3200); };

const KITCHEN = ['الرفع والقياس', 'تكسير وتجهيز المكان', 'السباكة والكهرباء', 'تركيب الوحدات السفلية', 'تركيب الوحدات العلوية', 'الرخامة', 'الإكسسوارات والإضاءة', 'التسليم ✅'];
interface Saved { style: string; pal: string; aspect: string; speed: number; mood: string; logoOn: boolean; T: Texts; cat: string }
const brand = () => { try { const v = (window as any).__KV && (window as any).__KV.get('brand'); return v ? JSON.parse(v) : {}; } catch { return {}; } };
function load(): Saved {
  const b = brand(), d: Saved = { style: 'showcase', pal: '', aspect: '916', speed: 1, mood: '', logoOn: true, cat: 'all', T: { title: '', sub: '', price: '', old: '', cta: 'اطلب دلوقتي', phone: b.phone || '', shop: b.shop || 'ميكانيزم', addr: b.addr || '', stages: [], badge: '', date: false } };
  try { const s = JSON.parse(localStorage.getItem('mkz-tpl') || '{}'); return Object.assign(d, s, { T: Object.assign(d.T, s.T || {}) }); } catch { return d; }
}
let S = load(); const save = () => { try { localStorage.setItem('mkz-tpl', JSON.stringify(S)); } catch { } };
let ITEMS: Item[] = [], STEP = 1, LOGO: HTMLCanvasElement | null = null, USERMUS: AudioBuffer | null = null, USERMUSN = '', SEL = -1, BUSY = false;
let RAF = 0, PLAY = false, T0 = 0, TOFF = 0, PCTX: AudioContext | null = null, PSRC: AudioBufferSourceNode | null = null;
const MUSCACHE = new Map<string, AudioBuffer | null>();

const st = (): Style => styleById(S.style), pal = () => palById(S.pal || st().pal), asp = () => ASPECTS.find(a => a[0] === S.aspect) || ASPECTS[0];
const mood = () => (S.mood || st().music) as any, bpm = () => USERMUS ? 0 : (MOODS.find(m => m[0] === mood()) || MOODS[0])[2];
function proj(scale: number, live: boolean, styleOverride?: Style): Proj {
  const s = styleOverride || st(), [, , W0, H0] = asp(), W = Math.round(W0 * scale / 2) * 2, H = Math.round(H0 * scale / 2) * 2;
  const tl = timeline(s, { count: Math.max(1, ITEMS.length), speed: S.speed, bpm: s.kind === 'video' ? bpm() : 0, intro: true, outro: true });
  return { items: ITEMS, st: s, pal: styleOverride ? palById(S.pal || s.pal) : pal(), T: S.T, W, H, logo: LOGO, logoOn: S.logoOn, segs: tl.segs, dur: tl.dur, live };
}

/* ───── الواجهة ───── */
const CSS = `#v-tpl{padding-bottom:8px}#v-tpl .tp-steps{display:flex;gap:6px;margin:6px 0 12px;position:sticky;top:env(safe-area-inset-top,0px);z-index:4;background:var(--bg);padding:6px 0}
#v-tpl .tp-steps button{flex:1;border:1px solid var(--ln);background:var(--sf);color:var(--mu);border-radius:12px;padding:8px 2px;font:800 12px var(--f);cursor:pointer;line-height:1.3}
#v-tpl .tp-steps button.on{background:var(--g);color:#0B0B0C;border-color:transparent}#v-tpl .tp-steps button.ok{color:var(--a2);border-color:var(--a2)}
#v-tpl .tp-pg{display:none}#v-tpl .tp-pg.on{display:block;animation:tpin .18s ease-out}@keyframes tpin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#v-tpl .tp-up{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;min-height:130px;border:2px dashed var(--a2);border-radius:20px;background:color-mix(in srgb,var(--a2) 8%,var(--sf));color:var(--tx);font:900 19px var(--f);cursor:pointer;text-align:center}
#v-tpl .tp-up small{font:600 12px var(--f);color:var(--mu)}
#v-tpl .tp-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}@media(min-width:700px){#v-tpl .tp-g{grid-template-columns:repeat(6,1fr)}}
#v-tpl .tp-th{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;border:2px solid transparent;background:var(--sf2);padding:0;cursor:pointer}
#v-tpl .tp-th img{width:100%;height:100%;object-fit:cover;display:block}#v-tpl .tp-th.sel{border-color:var(--a2)}
#v-tpl .tp-th .n{position:absolute;top:5px;right:5px;background:rgba(0,0,0,.7);color:#fff;font:900 12px var(--f);border-radius:10px;padding:1px 7px}
#v-tpl .tp-th .v{position:absolute;bottom:5px;left:5px;font-size:16px}#v-tpl .tp-th .c{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.8));color:#fff;font:700 11px var(--f);padding:12px 4px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v-tpl .tp-row{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}#v-tpl .tp-row::-webkit-scrollbar{display:none}#v-tpl .tp-row .ch{flex:none;margin:0;white-space:nowrap}
#v-tpl .tp-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:700px){#v-tpl .tp-cards{grid-template-columns:repeat(4,1fr)}}
#v-tpl .tp-card{border:2px solid var(--ln);border-radius:16px;background:var(--sf);padding:6px;cursor:pointer;text-align:right;color:var(--tx);font-family:var(--f)}
#v-tpl .tp-card.on{border-color:var(--a2);box-shadow:0 0 0 2px var(--a2) inset}#v-tpl .tp-card canvas{width:100%;display:block;border-radius:10px;background:#000}
#v-tpl .tp-card b{display:block;font-size:14px;margin:6px 2px 0}#v-tpl .tp-card span{display:block;font-size:11px;color:var(--mu);margin:0 2px;line-height:1.35;height:2.7em;overflow:hidden}
#v-tpl .tp-card.dim{opacity:.45}
#v-tpl .tp-pv{position:sticky;top:calc(env(safe-area-inset-top,0px) + 54px);z-index:3;background:var(--bg);padding:4px 0 8px;display:flex;gap:10px;align-items:center;justify-content:center}
#v-tpl .tp-pv canvas{max-width:46%;max-height:30vh;border-radius:12px;background:#000;box-shadow:0 8px 30px rgba(0,0,0,.4);flex:none}#v-tpl .tp-pv .side{flex:1;min-width:0;max-width:240px}
#v-tpl .tp-big{text-align:center}#v-tpl #tp_big{max-width:100%;max-height:50vh;border-radius:14px;background:#000;box-shadow:0 8px 30px rgba(0,0,0,.4)}
#v-tpl .tp-sw{display:grid;grid-template-columns:repeat(6,30px);gap:7px;justify-content:center;margin-top:8px}#v-tpl .tp-sw button{width:30px;height:30px;border-radius:50%;border:2px solid var(--ln);cursor:pointer;padding:0}#v-tpl .tp-sw button.on{border-color:#fff;box-shadow:0 0 0 2px var(--a2)}
#v-tpl .tp-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px}#v-tpl .tp-seg button{border:1px solid var(--ln);background:var(--sf);color:var(--mu);border-radius:10px;padding:5px 9px;font:700 12px var(--f);cursor:pointer}#v-tpl .tp-seg button.on{background:var(--g);color:#111;border-color:transparent}
#v-tpl .tp-bar{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:4;display:flex;gap:8px;margin-top:14px;padding:8px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--ln);border-radius:18px}
@media(max-width:820px){#v-tpl .tp-bar{bottom:calc(72px + env(safe-area-inset-bottom,0px))}}
#v-tpl .tp-bar .b{margin:0;min-height:54px;font-size:17px}#v-tpl .tp-bar #tp_next{flex:1}
#v-tpl .tp-sheet{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--sf);border-top:1px solid var(--a2);border-radius:20px 20px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.5);display:none}
#v-tpl .tp-sheet.on{display:block;animation:tpup .18s ease-out}@keyframes tpup{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#v-tpl .tp-sheet .r{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#v-tpl .tp-sheet .b{margin:0;min-height:50px}
#v-tpl .tp-res video,#v-tpl .tp-res img{width:100%;max-height:60vh;object-fit:contain;border-radius:12px;background:#000;display:block;margin-bottom:8px}
#v-tpl .tp-imgs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#v-tpl .tp-imgs img{height:auto;max-height:none;margin:0}`;

function markup() {
  return `<h1>🧩 القوالب</h1><p class="mu" style="margin:0">ارفع صورك ← اختار قالب ← خد فيديو أو صور جاهزة بلوجو ميكانيزم. <b style="color:var(--a2)">${arN(STYLES.length)} قالب × ${arN(PALS.length)} لون = ${arN(TOTAL_TEMPLATES)} شكل</b></p>
  <div class="tp-steps" id="tp_steps">${['① صورك', '② القالب', '③ الكلام', '④ جاهز'].map((x, i) => `<button type="button" data-s="${i + 1}">${x}</button>`).join('')}</div>
  <div class="tp-pg" data-p="1">
    <label class="tp-up">📷 اختار صور أو فيديوهات<small>صور الآيفون (HEIC) وأي صيغة — لحد ${arN(MAX_ITEMS)} ملف</small><input type="file" id="tp_f" accept="image/*,video/*,.heic,.heif,.mov,.mp4" multiple hidden></label>
    <div id="tp_pg" class="mu" style="text-align:center;margin-top:6px"></div>
    <div class="tp-row" id="tp_tools" style="margin-top:8px"><button type="button" class="ch" data-t="date">🗓️ رتّب بتاريخ التصوير</button><button type="button" class="ch" data-t="rev">🔁 اعكس الترتيب</button><button type="button" class="ch" data-t="clr">🧹 امسح الكل</button></div>
    <div class="tp-g" id="tp_g"></div>
    <p class="mu" style="margin-top:10px;line-height:1.8">💡 دوس على أي صورة: تقدّمها أو تأخرها أو تكتب عليها كلمة.<br>↔️ قبل وبعد: ارفع الصور أزواج (قبل ثم بعد).<br>🧭 رحلة مطبخ: دوس «رتّب بتاريخ التصوير» والصور هتترتب من أول يوم لآخر يوم.</p>
  </div>
  <div class="tp-pg" data-p="2">
    <div class="tp-pv"><canvas id="tp_mini"></canvas><div class="side"><div class="mu" style="margin-bottom:4px">المقاس</div><div class="tp-seg" id="tp_as"></div><div class="mu" style="margin:8px 0 0">اللون</div><div class="tp-sw" id="tp_sw"></div></div></div>
    <div class="tp-row" id="tp_cat"></div>
    <div class="tp-cards" id="tp_cards"></div>
  </div>
  <div class="tp-pg" data-p="3"><div class="p">
    <label>العنوان<input id="tp_t_title" placeholder="مثلاً: مطبخ ألمنيوم مودرن"></label>
    <label>سطر تحته (اختياري)<input id="tp_t_sub" placeholder="تصميم وتنفيذ ميكانيزم"></label>
    <div class="r2"><label>السعر (اختياري)<input id="tp_t_price" inputmode="numeric" placeholder="٣٥٠"></label><label>السعر قبل الخصم<input id="tp_t_old" inputmode="numeric"></label></div>
    <div id="tp_badgew"><label>جملة العرض<input id="tp_t_badge" placeholder="عرض لفترة محدودة"></label></div>
    <div id="tp_stw"><label>أسماء المراحل (كل سطر مرحلة بالترتيب)<textarea id="tp_t_stages" style="min-height:120px" placeholder="الرفع والقياس&#10;التكسير&#10;التركيب&#10;التسليم"></textarea></label><button type="button" class="b o" id="tp_kit">🍳 حط مراحل مطبخ جاهزة</button></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="tp_t_date"> 📅 اكتب تاريخ تصوير كل صورة</label>
    <div class="r2"><label>زرار الدعوة<input id="tp_t_cta"></label><label>التليفون<input id="tp_t_phone" inputmode="tel"></label></div>
    <div class="r2"><label>اسم المحل<input id="tp_t_shop"></label><label>العنوان<input id="tp_t_addr"></label></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="tp_logo"> لوجو ميكانيزم الرسمي على كل صورة</label>
  </div><div class="p" id="tp_vidopt"><h2>🎵 الموسيقى والسرعة</h2><div class="tp-row" id="tp_mood"></div>
    <label class="b o" style="width:100%;margin:6px 0">🎵 موسيقى من عندي<input type="file" id="tp_mf" accept="audio/*,.mp3,.m4a,.aac,.wav" hidden></label><div id="tp_mi" class="mu"></div>
    <label style="margin-top:8px">السرعة <b id="tp_dur"></b><input type="range" id="tp_sp" min="0.6" max="1.6" step="0.05"></label></div></div>
  <div class="tp-pg" data-p="4">
    <div class="tp-big"><canvas id="tp_big"></canvas></div>
    <div id="tp_play" style="display:flex;gap:8px;align-items:center;margin:6px 0"><button type="button" class="b" id="tp_pl" style="flex:none;min-width:64px;margin:0">▶️</button><input type="range" id="tp_seek" min="0" max="1000" value="0" style="flex:1"><span id="tp_tm" class="mu" style="flex:none"></span></div>
    <button type="button" class="b" id="tp_exv" style="width:100%;min-height:62px;font-size:19px">🎬 صدّر الفيديو MP4</button>
    <button type="button" class="b o" id="tp_exi" style="width:100%;min-height:52px">🖼️ صدّر صور (كاروسيل لإنستجرام)</button>
    <div id="tp_msg" class="mu" style="text-align:center;margin:6px 0"></div><div class="tp-res" id="tp_res"></div>
  </div>
  <div class="tp-bar"><button type="button" class="b o" id="tp_back">→ رجوع</button><button type="button" class="b" id="tp_next">التالي ←</button></div>
  <div class="tp-sheet" id="tp_sheet"></div>`;
}

function paintSteps() {
  document.querySelectorAll('#tp_steps [data-s]').forEach((b: any) => { const s = +b.dataset.s; b.classList.toggle('on', s === STEP); b.classList.toggle('ok', s < STEP); });
  document.querySelectorAll('#v-tpl .tp-pg').forEach((p: any) => p.classList.toggle('on', +p.dataset.p === STEP));
  $('tp_back').style.visibility = STEP > 1 ? 'visible' : 'hidden';
  $('tp_next').style.display = STEP < 4 ? '' : 'none';
  $('tp_next').textContent = STEP === 1 ? (ITEMS.length ? 'اختار القالب ←' : 'ارفع صور الأول') : STEP === 2 ? 'الكلام ←' : 'جهّز ←';
  $('tp_next').disabled = STEP === 1 && !ITEMS.length;
}
function goStep(n: number) {
  if (n > 1 && !ITEMS.length) { toast('ارفع صورة واحدة على الأقل'); n = 1; }
  STEP = n; stopPlay(); paintSteps(); scrollTo(0, 0);
  if (n === 2) { paintStyles(); startLoop('tp_mini', .36); }
  if (n === 3) paintTexts();
  if (n === 4) paintFinal();
}

/* ───── ١) الصور ───── */
function paintItems() {
  $('tp_g').innerHTML = ITEMS.map((it, i) => `<button type="button" class="tp-th${SEL === i ? ' sel' : ''}" data-i="${i}"><img src="${it.thumb}" alt=""><span class="n">${arN(i + 1)}</span>${it.kind === 'vid' ? '<span class="v">🎬</span>' : ''}${it.cap ? `<span class="c">${esc(it.cap)}</span>` : ''}</button>`).join('');
  const nv = ITEMS.filter(i => i.kind === 'vid').length; $('tp_pg').textContent = ITEMS.length ? `${arN(ITEMS.length - nv)} صورة${nv ? ' • ' + arN(nv) + ' فيديو' : ''}` : '';
  paintSteps();
}
function sheet(i: number) {
  SEL = i; paintItems(); const it = ITEMS[i], el = $('tp_sheet');
  el.innerHTML = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><img src="${it.thumb}" style="width:56px;height:56px;object-fit:cover;border-radius:10px"><b style="flex:1">رقم ${arN(i + 1)} من ${arN(ITEMS.length)}</b><button type="button" class="b o" data-a="x" style="margin:0;min-height:40px">✕</button></div>
   <label style="margin-bottom:8px">✍️ كلمة على الصورة دي (اسم المنتج أو المرحلة)<input id="tp_cap" value="${esc(it.cap)}" placeholder="مثلاً: جزيرة رخام"></label>
   <div class="r"><button type="button" class="b o" data-a="up">⬆️ قدّم</button><button type="button" class="b o" data-a="dn">⬇️ أخّر</button><button type="button" class="b o" data-a="first">⭐ خليها الأولى</button><button type="button" class="b o" data-a="last">🏁 خليها الأخيرة</button><button type="button" class="b o" data-a="dup">📄 كرّرها</button><button type="button" class="b o" data-a="del" style="color:#ff6b6b;border-color:#ff6b6b">🗑️ شيلها</button></div>`;
  el.classList.add('on');
  $('tp_cap').oninput = (e: any) => { it.cap = e.target.value.slice(0, 60); paintItems(); };
  el.onclick = (e: any) => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, mv = (to: number) => { const [x] = ITEMS.splice(SEL, 1); ITEMS.splice(to, 0, x); SEL = to; };
    if (a === 'x') { el.classList.remove('on'); SEL = -1; paintItems(); return; }
    if (a === 'up' && SEL > 0) mv(SEL - 1); if (a === 'dn' && SEL < ITEMS.length - 1) mv(SEL + 1); if (a === 'first') mv(0); if (a === 'last') mv(ITEMS.length - 1);
    if (a === 'dup' && ITEMS.length < MAX_ITEMS) { ITEMS.splice(SEL + 1, 0, { ...ITEMS[SEL], id: ITEMS[SEL].id + 'd' + Date.now() }); }
    if (a === 'del') { const [x] = ITEMS.splice(SEL, 1); if (!ITEMS.some(y => y.src === x.src)) freeItem(x); el.classList.remove('on'); SEL = -1; paintItems(); return; }
    sheet(SEL);
  };
}
async function addFiles(fs: File[]) {
  if (BUSY) return; const room = MAX_ITEMS - ITEMS.length; if (room <= 0) return toast('وصلت للحد (' + arN(MAX_ITEMS) + ')');
  if (fs.length > room) { toast('هضيف أول ' + arN(room) + ' بس (الحد ' + arN(MAX_ITEMS) + ')'); fs = fs.slice(0, room); }
  BUSY = true; $('tp_pg').textContent = '⏳ بجهّز الصور… ٠ من ' + arN(fs.length);
  const r = await loadFiles(fs, (d, t) => { $('tp_pg').textContent = '⏳ بجهّز الصور… ' + arN(d) + ' من ' + arN(t); });
  ITEMS.push(...r.items); BUSY = false; clearCaches(); paintItems(); THUMBKEY = '';
  if (r.errors.length) { $('tp_pg').innerHTML = r.errors.map(x => '⚠️ ' + esc(x)).join('<br>'); }
}

/* ───── ٢) القالب ───── */
let THUMBKEY = '', THUMBJOB = 0;
function paintStyles() {
  $('tp_cat').innerHTML = CATS.map(([k, n]) => `<button type="button" class="ch${S.cat === k ? ' on' : ''}" data-c="${k}">${n}</button>`).join('');
  $('tp_sw').innerHTML = PALS.map(p => `<button type="button" title="${p.n}" data-p="${p.id}" class="${pal().id === p.id ? 'on' : ''}" style="background:linear-gradient(135deg,${p.bg} 50%,${p.ac} 50%)"></button>`).join('');
  $('tp_as').innerHTML = ASPECTS.map(a => `<button type="button" data-a="${a[0]}" class="${S.aspect === a[0] ? 'on' : ''}">${a[1]}</button>`).join('');
  const list = STYLES.filter(s => S.cat === 'all' || s.cat.includes(S.cat as any));
  const [, , W0, H0] = asp(), cw = 216, chh = Math.round(cw * H0 / W0);
  $('tp_cards').innerHTML = list.map(s => `<button type="button" class="tp-card${s.id === S.style ? ' on' : ''}${(s.min || 1) > ITEMS.length ? ' dim' : ''}" data-st="${s.id}"><canvas width="${cw}" height="${chh}" data-cv="${s.id}"></canvas><b>${s.e} ${esc(s.n)}${s.kind === 'image' ? ' <small style="color:var(--a2)">صورة</small>' : ''}</b><span>${esc(s.d)}</span></button>`).join('');
  const key = list.map(s => s.id).join() + '|' + S.aspect + '|' + S.pal + '|' + ITEMS.map(i => i.id + i.cap).join();
  if (key !== THUMBKEY) { THUMBKEY = key; } thumbs(list);
}
function thumbs(list: Style[]) {
  const job = ++THUMBJOB; let i = 0;
  const step = () => {
    if (job !== THUMBJOB) return; const s = list[i++]; if (!s) return; const cv = document.querySelector(`[data-cv="${s.id}"]`) as HTMLCanvasElement; if (!cv) return setTimeout(step, 0);
    try {
      const P = proj(cv.width / asp()[2], false, s), c = cv.getContext('2d')!;
      if (s.kind === 'image') poster(c, P); else { const sl = P.segs.find(x => x.k === 'slide') || P.segs[0]; frame(c, P, sl.s + (sl.e - sl.s) * (s.special === 'ba-wipe' || s.special === 'ba-split' ? .62 : .5)); }
    } catch (e) { console.warn('thumb', s.id, e); }
    setTimeout(step, 16);
  };
  step();
}

/* ───── المعاينة الحية ───── */
function startLoop(id: string, scale: number) {
  cancelAnimationFrame(RAF); const cv = $(id); if (!cv) return; let P = proj(scale, true);
  cv.width = P.W; cv.height = P.H; const c = cv.getContext('2d'); const t0 = performance.now(); let lastKey = '';
  const tick = () => {
    if (!document.body.contains(cv) || !cv.offsetParent) { stopVideos(P); return; }
    const k = S.style + S.pal + S.aspect + S.speed + mood() + ITEMS.length + JSON.stringify(S.T) + S.logoOn; if (k !== lastKey) { lastKey = k; P = proj(scale, true); cv.width = P.W; cv.height = P.H; }
    if (st().kind === 'image') { poster(c, P, Math.floor((performance.now() - t0) / 2500) % posterCount(P)); }
    else { const t = id === 'tp_big' ? curT(P) : ((performance.now() - t0) / 1000) % P.dur; frame(c, P, t); if (id === 'tp_big') { $('tp_seek').value = String(Math.round(t / P.dur * 1000)); $('tp_tm').textContent = arN(t.toFixed(1)) + ' / ' + arN(P.dur.toFixed(1)) + ' ث'; if (PLAY && t >= P.dur - .02) stopPlay(); } }
    RAF = requestAnimationFrame(tick);
  };
  tick();
}
const curT = (P: Proj) => PLAY ? Math.min(P.dur, TOFF + (performance.now() - T0) / 1000) : TOFF;
async function musicFor(dur: number): Promise<AudioBuffer | null> {
  if (USERMUS) return USERMUS; const k = mood() + '|' + bpm() + '|' + dur.toFixed(2); if (MUSCACHE.has(k)) return MUSCACHE.get(k)!;
  const b = await makeMusic(mood(), bpm(), dur); MUSCACHE.set(k, b); return b;
}
async function togglePlay() {
  const P = proj(.5, true); if (PLAY) { TOFF = curT(P); stopPlay(); return; }
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (!PCTX && AC) PCTX = new AC(); try { await PCTX!.resume(); } catch { }
  if (TOFF >= P.dur - .05) TOFF = 0; $('tp_pl').textContent = '⏳';
  const mb = st().kind === 'video' ? await musicFor(P.dur) : null; PLAY = true; T0 = performance.now(); $('tp_pl').textContent = '⏸️';
  if (mb && PCTX) { PSRC = PCTX.createBufferSource(); PSRC.buffer = mb; PSRC.connect(PCTX.destination); PSRC.start(0, Math.min(TOFF, mb.duration - .01)); }
}
function stopPlay() { PLAY = false; try { PSRC && PSRC.stop(); } catch { } PSRC = null; const b = $('tp_pl'); if (b) b.textContent = '▶️'; }

/* ───── ٣) الكلام ───── */
const TK: (keyof Texts)[] = ['title', 'sub', 'price', 'old', 'badge', 'cta', 'phone', 'shop', 'addr'];
function paintTexts() {
  TK.forEach(k => { const el = $('tp_t_' + k); el.value = (S.T as any)[k] || ''; el.oninput = () => { (S.T as any)[k] = el.value; save(); updDur(); }; });
  $('tp_t_stages').value = S.T.stages.join('\n'); $('tp_t_stages').oninput = (e: any) => { S.T.stages = e.target.value.split('\n').map((x: string) => x.trim()).filter(Boolean); save(); };
  $('tp_kit').onclick = () => { S.T.stages = KITCHEN.slice(0, Math.max(ITEMS.length, 3)); $('tp_t_stages').value = S.T.stages.join('\n'); save(); };
  $('tp_t_date').checked = S.T.date; $('tp_t_date').onchange = (e: any) => { S.T.date = e.target.checked; save(); };
  $('tp_logo').checked = S.logoOn; $('tp_logo').onchange = (e: any) => { S.logoOn = e.target.checked; save(); };
  const s = st(); $('tp_stw').style.display = s.special === 'journey' || s.poster === 'journey' ? '' : 'none'; $('tp_badgew').style.display = s.special === 'price' ? '' : 'none';
  $('tp_vidopt').style.display = s.kind === 'video' ? '' : 'none';
  $('tp_mood').innerHTML = MOODS.map(([k, n]) => `<button type="button" class="ch${!USERMUS && mood() === k ? ' on' : ''}" data-m="${k}">${n}</button>`).join('');
  $('tp_mi').innerHTML = USERMUS ? '🎵 ' + esc(USERMUSN) + ' <button type="button" class="b o" id="tp_mx" style="padding:2px 10px;min-height:30px">✕</button>' : '';
  const mx = $('tp_mx'); if (mx) mx.onclick = () => { USERMUS = null; paintTexts(); };
  $('tp_sp').value = String(S.speed); $('tp_sp').oninput = (e: any) => { S.speed = +e.target.value; save(); updDur(); }; updDur();
}
function updDur() { const P = proj(.25, false); const el = $('tp_dur'); if (el) el.textContent = '— المدة ' + arN(P.dur.toFixed(1)) + ' ثانية'; }

/* ───── ٤) جاهز + التصدير ───── */
function paintFinal() {
  const img = st().kind === 'image'; $('tp_play').style.display = img ? 'none' : 'flex'; $('tp_exv').style.display = img ? 'none' : '';
  $('tp_exi').textContent = img ? '🖼️ احفظ ' + (posterCount(proj(.25, false)) > 1 ? 'الصور (' + arN(posterCount(proj(.25, false))) + ')' : 'الصورة') : '🖼️ صدّر صور (كاروسيل لإنستجرام)';
  $('tp_res').innerHTML = ''; $('tp_msg').textContent = ''; TOFF = 0; startLoop('tp_big', .5);
}
const pickMime = () => { const R: any = (window as any).MediaRecorder; if (!R) return ''; return ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(t => R.isTypeSupported(t)) || ''; };
const fname = (ext: string, i?: number) => 'ميكانيزم-' + (S.T.title || st().n).replace(/[\/:*?"<>|]+/g, '-').slice(0, 30) + (i != null ? '-' + (i + 1) : '') + '.' + ext;

async function exportVideo() {
  if (BUSY) return; const mt = pickMime(); if (!mt) return toast('المتصفح ده مش بيقدر يصدّر فيديو — حدّث iOS أو استخدم كروم');
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac: AudioContext | null = AC ? new AC() : null; try { await ac?.resume(); } catch { }
  BUSY = true; stopPlay(); cancelAnimationFrame(RAF); const btn = $('tp_exv'), msg = $('tp_msg'); btn.disabled = true; $('tp_res').innerHTML = '';
  const cv = $('tp_big'), P = proj(1, true), c = cv.getContext('2d'); cv.width = P.W; cv.height = P.H;
  try {
    msg.textContent = '🎵 بجهّز الموسيقى…'; const mb = await musicFor(P.dur);
    try { await (document as any).fonts.ready; } catch { }
    P.items.forEach(it => { if (it.vel) { it.vel.pause(); it.vel.currentTime = 0; } });
    frame(c, P, 0); const stream: MediaStream = (cv as any).captureStream(30); let src: AudioBufferSourceNode | null = null;
    if (mb && ac) { const dst = ac.createMediaStreamDestination(); src = ac.createBufferSource(); src.buffer = mb; src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
    const ch: Blob[] = [], rec = new (window as any).MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: P.W * P.H >= 1920 * 1080 * .9 ? 12e6 : 8e6, audioBitsPerSecond: 160000 });
    rec.ondataavailable = (e: any) => e.data && e.data.size && ch.push(e.data); const stop = new Promise(r => rec.onstop = r);
    rec.start(250); const t0 = ac && src ? ac.currentTime : 0, p0 = performance.now(); if (src) src.start();
    const clock = () => ac && src ? ac.currentTime - t0 : (performance.now() - p0) / 1000;
    await new Promise<void>(res => { const tick = () => { const t = clock(); frame(c, P, Math.min(t, P.dur - .001)); btn.textContent = '⏺️ بسجّل… ' + arN(Math.min(99, Math.round(t / P.dur * 100))) + '٪'; if (t >= P.dur) return res(); setTimeout(tick, 1000 / 40); }; tick(); });
    await new Promise(r => setTimeout(r, 250)); rec.stop(); await stop; try { src && src.stop(); } catch { } stopVideos(P);
    const type = mt.split(';')[0], blob = new Blob(ch, { type }), ext = /mp4/.test(type) ? 'mp4' : 'webm', file = new File([blob], fname(ext), { type }), url = URL.createObjectURL(blob);
    $('tp_res').innerHTML = `<div class="p"><h2>✅ الفيديو جاهز (${arN((blob.size / 1048576).toFixed(1))} ميجا • ${arN(P.dur.toFixed(0))} ث)</h2><video src="${url}" controls playsinline></video>
      <button type="button" class="b" id="tp_sh" style="width:100%;min-height:54px">📤 شارك / احفظ في الصور</button><a class="b o" style="width:100%" download="${esc(file.name)}" href="${url}">⬇️ تنزيل</a>${ext !== 'mp4' ? '<p class="mu">⚠️ المتصفح ده طلّعه WebM — لو المنصة رفضته صدّره من الآيفون أو كروم أحدث.</p>' : ''}</div>`;
    $('tp_sh').onclick = () => share([file]); msg.textContent = '';
  } catch (e: any) { msg.textContent = '❌ التصدير وقف: ' + (e && e.message || e); }
  finally { BUSY = false; btn.disabled = false; btn.textContent = '🎬 صدّر الفيديو MP4'; try { ac?.close(); } catch { } startLoop('tp_big', .5); }
}
async function share(files: File[]) {
  try { const n: any = navigator; if (n.canShare && n.canShare({ files })) { await n.share({ files, title: S.T.title || 'ميكانيزم' }); return; } } catch (e: any) { if (e && e.name === 'AbortError') return; }
  files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
}
async function exportImages() {
  if (BUSY) return; BUSY = true; stopPlay(); const msg = $('tp_msg'), btn = $('tp_exi'); btn.disabled = true; $('tp_res').innerHTML = '';
  try {
    try { await (document as any).fonts.ready; } catch { }
    const P = proj(1, false), cv = document.createElement('canvas'); cv.width = P.W; cv.height = P.H; const c = cv.getContext('2d')!, files: File[] = [];
    const snap = async (i: number) => { const b: Blob = await new Promise((ok, no) => cv.toBlob(x => x ? ok(x) : no(new Error('الصورة كبيرة على الجهاز')), 'image/jpeg', .92)); files.push(new File([b], fname('jpg', i), { type: 'image/jpeg' })); };
    if (P.st.kind === 'image') { const n = posterCount(P); for (let i = 0; i < n; i++) { msg.textContent = '🖼️ ' + arN(i + 1) + ' من ' + arN(n); poster(c, P, i); await snap(i); } }
    else { const segs = P.segs.filter(s => s.k !== 'intro'); for (let i = 0; i < segs.length; i++) { const s = segs[i]; msg.textContent = '🖼️ ' + arN(i + 1) + ' من ' + arN(segs.length); const mid = s.k === 'outro' ? s.e - .05 : s.s + (s.e - s.s) * .72; frame(c, P, Math.max(mid, (P.segs[P.segs.indexOf(s) - 1]?.e ?? 0) + .01)); await snap(i); await new Promise(r => setTimeout(r, 0)); } }
    stopVideos(P);
    $('tp_res').innerHTML = `<div class="p"><h2>✅ ${arN(files.length)} صورة جاهزة</h2><div class="tp-imgs">${files.map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join('')}</div><button type="button" class="b" id="tp_shi" style="width:100%;min-height:54px;margin-top:8px">📤 شارك / احفظ ${files.length > 1 ? 'الكل' : ''} في الصور</button></div>`;
    $('tp_shi').onclick = () => share(files); msg.textContent = '';
  } catch (e: any) { msg.textContent = '❌ ' + (e && e.message || e); }
  finally { BUSY = false; btn.disabled = false; }
}

/* ───── التركيب في الستوديو ───── */
function paint() {
  const sec = $('v-tpl'); if (!sec || sec.dataset.on) return; sec.dataset.on = '1'; sec.innerHTML = markup();
  if (!$('tp-css')) { const s = document.createElement('style'); s.id = 'tp-css'; s.textContent = CSS; document.head.appendChild(s); }
  $('tp_f').onchange = (e: any) => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) addFiles(f); };
  $('tp_g').onclick = (e: any) => { const b = e.target.closest('[data-i]'); if (b) sheet(+b.dataset.i); };
  $('tp_tools').onclick = (e: any) => { const b = e.target.closest('[data-t]'); if (!b || !ITEMS.length) return; const t = b.dataset.t;
    if (t === 'date') { ITEMS.sort((a, b2) => a.date - b2.date); toast('اترتبت من الأقدم للأحدث'); } if (t === 'rev') ITEMS.reverse();
    if (t === 'clr') { if (!confirm('تمسح كل الصور؟')) return; ITEMS.forEach(freeItem); ITEMS = []; clearCaches(); } paintItems(); };
  $('tp_steps').onclick = (e: any) => { const b = e.target.closest('[data-s]'); if (b) goStep(+b.dataset.s); };
  $('tp_next').onclick = () => goStep(Math.min(4, STEP + 1)); $('tp_back').onclick = () => goStep(Math.max(1, STEP - 1));
  $('tp_cat').onclick = (e: any) => { const b = e.target.closest('[data-c]'); if (!b) return; S.cat = b.dataset.c; save(); paintStyles(); };
  $('tp_cards').onclick = (e: any) => { const b = e.target.closest('[data-st]'); if (!b) return; const s = styleById(b.dataset.st); if ((s.min || 1) > ITEMS.length) return toast('القالب ده محتاج ' + arN(s.min || 1) + ' صور على الأقل');
    S.style = s.id; S.mood = ''; save(); document.querySelectorAll('#tp_cards .tp-card').forEach((x: any) => x.classList.toggle('on', x.dataset.st === s.id)); $('tp_sw').querySelectorAll('button').forEach((x: any) => x.classList.toggle('on', x.dataset.p === pal().id)); };
  $('tp_sw').onclick = (e: any) => { const b = e.target.closest('[data-p]'); if (!b) return; S.pal = b.dataset.p; save(); paintStyles(); };
  $('tp_as').onclick = (e: any) => { const b = e.target.closest('[data-a]'); if (!b) return; S.aspect = b.dataset.a; save(); paintStyles(); startLoop('tp_mini', .36); };
  $('tp_mood').onclick = (e: any) => { const b = e.target.closest('[data-m]'); if (!b) return; USERMUS = null; S.mood = b.dataset.m; save(); paintTexts(); };
  $('tp_mf').onchange = async (e: any) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; try { USERMUS = await decodeMusic(f); USERMUSN = f.name; paintTexts(); } catch (x: any) { toast(x.message); } };
  $('tp_pl').onclick = togglePlay; $('tp_seek').oninput = (e: any) => { const P = proj(.5, false); stopPlay(); TOFF = +e.target.value / 1000 * P.dur; };
  $('tp_exv').onclick = exportVideo; $('tp_exi').onclick = exportImages;
  paintItems(); paintSteps(); officialLogo().then(l => { LOGO = l; });
}
export function mountTemplates() {
  const w: any = window, run = () => setTimeout(mountNow, 30);
  (w.__ready && w.__ready.then ? w.__ready : Promise.resolve()).then(run, run);
}
function addButtons() {
  const rail = $('rail'); if (rail && rail.querySelector('button') && !rail.querySelector('[data-go="tpl"]')) { const btn = '<button data-go="tpl"><svg class="i"><use href="#i-img"/></svg>🧩 القوالب</button>', f = rail.querySelector('[data-go="smart"]') || rail.querySelector('[data-go="vid"]'); f ? f.insertAdjacentHTML('afterend', btn) : rail.insertAdjacentHTML('beforeend', btn); }
  const tiles = $('tiles'); if (tiles && tiles.children.length && !tiles.querySelector('[data-go="tpl"]')) { const f = tiles.querySelector('[data-go="smart"]'), h = '<button class="tile" data-go="tpl"><span class="ic">🧩</span>القوالب</button>'; f ? f.insertAdjacentHTML('afterend', h) : tiles.insertAdjacentHTML('afterbegin', h); }
}
function mountNow() {
  if (!$('v-tpl')) { const ref = $('v-smart') || $('v-vid'), s = document.createElement('section'); s.className = 'v'; s.id = 'v-tpl'; (ref && ref.parentNode || document.querySelector('main') || document.body).insertBefore(s, ref || null); }
  addButtons(); let n = 0; const iv = setInterval(() => { addButtons(); if (++n > 40) clearInterval(iv); }, 500);
  if (location.hash === '#tpl') setTimeout(() => { const b = document.querySelector('#rail [data-go="tpl"]') as any; b && b.click(); }, 400);
  if ((window as any).__tplClick) return; (window as any).__tplClick = 1;
  document.addEventListener('click', e => {
    const b = (e.target as any).closest && (e.target as any).closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'tpl') { paint(); setTimeout(() => { document.querySelectorAll('.v').forEach(x => x.classList.toggle('on', x.id === 'v-tpl')); document.querySelectorAll('#rail button').forEach((x: any) => x.classList.toggle('on', x.dataset.go === 'tpl')); scrollTo(0, 0); if (STEP === 2) startLoop('tp_mini', .36); if (STEP === 4) startLoop('tp_big', .5); }, 0); }
    else { stopPlay(); cancelAnimationFrame(RAF); ITEMS.forEach(it => { try { it.vel && it.vel.pause(); } catch { } }); }
  });
}
