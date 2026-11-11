// @ts-nocheck
// 🧩 كل شاشات الستوديو ملمومة في أيقونات: أي كارت ليه عنوان (h2) بيتحوّل لأيقونة صغيرة في شبكة أول الشاشة،
// والدوسة على الأيقونة بتفتح الكارت ده بس (والتانية بتقفله). مفيش ولا خانة ولا زرار بيتشال — بيتلمّ بس.
// اللي بيفضل مفتوح: المعاينة (أي كارت فيه canvas/فيديو)، الكروت المتثبتة فوق، والكروت اللي الكود بيفتحها بنفسه (مخفية من الأول).
// الشاشات اللي بتتبني بعدين (القوالب، السكيل…) بتتلمّ لوحدها أول ما تظهر. المونتاج الذكي ليه أيقوناته الخاصة.

const SKIP_VIEWS = new Set([]);
// كروت بتفضل مفتوحة: المعاينة (canvas/فيديو/صورة التصميم) وزرار التصدير
const KEEP = 'canvas,video,.pv,#sm_ex';
// أيقونة مناسبة للكروت اللي عنوانها من غير أيقونة
const KW = [[/نص|كتابة|سطر/, '✍️'], [/خطة|تقويم|جدول/, '🗓️'], [/أسلوب|خط/, '🔤'], [/تصميم|تخطيط/, '🎨'], [/اقتراح|أفكار/, '💡'], [/كابشن|ترجمة/, '📝'], [/مكتب|سكيل/, '📚'], [/ستايل|لون|ألوان|ثيم/, '🎨'], [/إعداد|عام|ضبط/, '⚙️'], [/عنوان/, '🔤'], [/سعر|شارة/, '🏷️'], [/كروت|شعار|لوجو/, '🃏'], [/تأثير|موشن/, '✨'], [/خطة|تقويم|جدول/, '🗓️'], [/سجل|إحصا|تقرير/, '📊'], [/منتج/, '📦'], [/صورة|صور/, '🖼️'], [/فيديو|مونتاج|وسائط|مقطع/, '🎬'], [/دخول|حساب/, '🔐'], [/نسخ|احتياط/, '💾'], [/خطأ|أخطاء/, '🐞'], [/اختصار/, '⌨️'], [/ذكاء|اسأل|اطلب/, '🤖'], [/موسيقى|صوت/, '🎵'], [/لينك|رابط/, '🔗'], [/مشروع/, '🗂️'], [/سرعة/, '⏩'], [/ملفات|المصدر/, '📁'], [/خريطة/, '🗺️'], [/ابدأ/, '🚀']];
const CSS = `
.fz-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 10px}
@media(min-width:700px){.fz-g{grid-template-columns:repeat(5,minmax(0,1fr))}}
.fz-t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:86px;padding:10px 6px;border-radius:16px;
 background:var(--sf);border:1px solid var(--ln);color:var(--tx);font:700 12.5px/1.35 var(--f,Cairo),Cairo,sans-serif;text-align:center;cursor:pointer;
 box-shadow:0 2px 10px rgba(0,0,0,.08);transition:transform .12s ease,border-color .12s ease;-webkit-tap-highlight-color:transparent}
.fz-t:active{transform:scale(.96)}
.fz-t .fz-i{font-size:26px;line-height:1;display:grid;place-items:center;height:30px;color:var(--a2)}
.fz-t .fz-i svg{width:28px;height:28px}
.fz-t .fz-l{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.fz-t.on{border-color:var(--a2);background:color-mix(in srgb,var(--a2) 18%,var(--sf));box-shadow:0 0 0 2px color-mix(in srgb,var(--a2) 45%,transparent)}
.fz-c{display:none!important}
.fz-open{animation:fzIn .18s ease}
@keyframes fzIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
`;
const EMO = /^\s*((?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*️?)/u;

function iconOf(h2) {
  const svg = h2.querySelector('svg');
  if (svg) return svg.cloneNode(true);
  const t = h2.textContent.trim(), m = t.match(EMO);
  const s = document.createElement('span'); const kw = KW.find(([re]) => re.test(t)); s.textContent = m ? m[1] : kw ? kw[1] : (t.match(/[①-⑳]/) || [''])[0] || '📄'; return s;
}
const labelOf = (h2) => { const k = h2.cloneNode(true); k.querySelectorAll('small').forEach((x) => x.remove()); return labelTx(k); };
const labelTx = (h2) => h2.textContent.replace(EMO, '').replace(/^[\s①-⑳٠-٩0-9).\-–—]+/, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 32) || 'تفاصيل';

function foldable(c) {
  if (c.dataset.fz || c.dataset.tl) return false;
  if (c.parentElement && c.parentElement.closest('.p')) return false;          // كارت جوه كارت
  if (c.classList.contains('pin') || c.closest('.pin,#evpin,.tl-p,#mkpc,.fz-keep')) return false;
  if (c.style.display === 'none') return false;                                // الكود بيفتحه بنفسه
  const h = c.querySelector('h2'); if (!h) return false;
  if (c.querySelector(KEEP)) return false;                           // المعاينة تفضل ظاهرة
  return true;
}

function closeAll(g) { g.querySelectorAll('.fz-t').forEach((t) => { t.classList.remove('on'); t._c.classList.add('fz-c'); t._c.classList.remove('fz-open'); }); }

// شبكة واحدة لكل شاشة (حتى لو الكروت في عمودين)، قبل أول كارت ملموم
function foldParent(v, cards) {
  let g = v.querySelector('.fz-g');
  if (!g) {
    if (cards.length < 2) return;                                               // كارت واحد بس يفضل مفتوح
    g = document.createElement('div'); g.className = 'fz-g';
    cards[0].before(g);
    g.addEventListener('click', (e) => {
      const t = e.target.closest('.fz-t'); if (!t) return;
      const was = t.classList.contains('on'); closeAll(g);
      if (!was) { t.classList.add('on'); t._c.classList.remove('fz-c'); t._c.classList.add('fz-open'); try { t._c.dispatchEvent(new CustomEvent('fzopen', { bubbles: true })); } catch { } setTimeout(() => { try { t._c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { } }, 40); }
    });
  }
  cards.forEach((c) => {
    const h = c.querySelector('h2'); c.dataset.fz = '1';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fz-t';
    const i = document.createElement('span'); i.className = 'fz-i'; i.appendChild(iconOf(h));
    const l = document.createElement('span'); l.className = 'fz-l'; l.textContent = labelOf(h);
    b.append(i, l); b._c = c; g.appendChild(b); c.classList.add('fz-c');
  });
}

function foldView(v) {
  if (SKIP_VIEWS.has(v.id)) return;
  const cards = [...v.querySelectorAll('.p')].filter(foldable);
  if (!cards.length) return;
  foldParent(v, cards);
}

export function mountFold() {
  if (window.__fold) return; window.__fold = 1;
  if (!document.getElementById('fz-css')) { const st = document.createElement('style'); st.id = 'fz-css'; st.textContent = CSS; document.head.appendChild(st); }
  const run = () => { try { document.querySelectorAll('.fz-t').forEach((t) => { const c = t._c; if (!c || !document.body.contains(c) || c.classList.contains('pin') || c.closest('.pin,#evpin') || c.querySelector(KEEP)) { if (c) { c.classList.remove('fz-c'); delete c.dataset.fz; } const g = t.parentElement; t.remove(); if (g && !g.children.length) g.remove(); } }); document.querySelectorAll('section.v').forEach(foldView); } catch (e) { console.warn('fold', e); } };
  run();
  let t = 0; const hasCard = (n) => n.nodeType === 1 && (n.matches('.p,section.v') || !!n.querySelector('.p'));
  const mo = new MutationObserver((recs) => { if (!recs.some((r) => [...r.addedNodes].some(hasCard))) return; clearTimeout(t); t = setTimeout(run, 350); });
  mo.observe(document.body, { childList: true, subtree: true });
  window.__foldRun = run;
}
