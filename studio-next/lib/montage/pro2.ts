// أدوات المونتاج الاحترافية (الدفعة التانية) — دوال نقية بتتختبر في Node:
// أفضل مقاطع قصيرة، منحنى الاحتفاظ، تقرير الحشو، عناوين بديلة، كابشن لكل منصة، قائمة لقطات ناقصة، سكريبت نضيف، SRT، كلمات الضربة، ضربات الموسيقى.
type Seg = { s: number; e: number; t: string; cut?: boolean; kw?: string[] };
const norm = (w: string) => String(w).replace(/[ً-ْـ.,،؟!?:؛"«»()]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const words = (t: string) => String(t).split(/\s+/).filter(Boolean);
const ar = (s: string | number) => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

export const FILLERS = ['يعني', 'امم', 'اممم', 'ام', 'اه', 'ااا', 'ايوه', 'طيب', 'بقي', 'كده', 'اصل', 'بص', 'خلاص', 'تمام', 'زي ما قلت'];
export const PUNCH = ['مستحيل', 'خطير', 'سر', 'غلط', 'ممنوع', 'احذر', 'مجانا', 'ببلاش', 'ضمان', 'اقوي', 'افضل', 'احسن', 'ارخص', 'خصم', 'عرض', 'جديد', 'حصري', 'وفر', 'صدمه', 'هتخسر', 'اوعي', 'فرق', 'سعر', 'جنيه'];
const STOP = new Set(['اللي', 'الي', 'ده', 'دي', 'دول', 'كده', 'يعني', 'ازاي', 'انا', 'احنا', 'انت', 'هو', 'هي', 'ممكن', 'لازم', 'كمان', 'برضو', 'عشان', 'علشان', 'لان', 'لكن', 'يلا', 'فيه', 'علي', 'عندنا', 'عندك', 'بتاع', 'بتاعه', 'هنا', 'هناك', 'دلوقتي', 'النهارده', 'جدا', 'اوي', 'حاجه', 'حاجات', 'جماعه', 'بقي', 'خالص', 'كل', 'مش', 'مع', 'من', 'في', 'او', 'ولا', 'لما', 'اللى', 'وده', 'ودي', 'تاني', 'كان', 'يكون', 'هيكون', 'بيكون', 'عايز', 'محتاج', 'طيب', 'تمام', 'كمان']);

export function keywords(seg: Seg[], n = 6, skip: string[] = []): string[] {
  const sk = new Set(skip.filter(Boolean).map(x => norm(x).replace(/\s+/g, '')));
  const c: Record<string, number> = {}; seg.filter(g => !g.cut).forEach(g => { words(g.t).forEach(w => { const k = norm(w).replace(/[^؀-ۿa-z0-9]/gi, ''); if (k.length >= 4 && !STOP.has(k) && !/^\d+$/.test(k)) c[k] = (c[k] || 0) + 1; }); (g.kw || []).forEach(k => { const x = norm(k); c[x] = (c[x] || 0) + 2; }); });
  return Object.keys(c).filter(k => !sk.has(k)).sort((a, b) => c[b] - c[a] || b.length - a.length).slice(0, n);
}

/** درجة كل جملة: سؤال، رقم، كلمة قوية، طول مناسب. */
function segScore(g: Seg): number {
  const t = g.t, n = norm(t), w = words(t).length; let s = 0;
  if (/[؟?]/.test(t) || /^(ليه|ازاي|هل|مين|ايه|كام|بكام)/.test(n)) s += 3; if (/[0-9٠-٩]/.test(t)) s += 2;
  s += Math.min(3, PUNCH.filter(p => n.includes(p)).length * 1.5); if (w >= 4 && w <= 14) s += 1; if (g.kw && g.kw.length) s += 1; return s;
}

/* ١٢) أفضل مقاطع قصيرة */
export interface Clip { len: number; s: number; e: number; score: number; first: string }
export function bestClips(seg: Seg[], dur: number, lens = [15, 30, 60]): Clip[] {
  const L = seg.filter(g => !g.cut), out: Clip[] = [];
  lens.forEach(len => {
    if (dur < len * .8) return; let best: Clip | null = null;
    L.forEach((g, i) => { const end = g.s + len; const inn = L.filter(x => x.s >= g.s && x.e <= end + .5); if (!inn.length) return;
      const talk = inn.reduce((a, x) => a + (x.e - x.s), 0) / len, sc = inn.reduce((a, x) => a + segScore(x), 0) + segScore(g) * 2 + talk * 4 - (i === 0 ? 0 : .3);
      if (!best || sc > best.score) best = { len, s: Math.max(0, g.s - .15), e: Math.min(dur, inn[inn.length - 1].e + .3), score: +sc.toFixed(1), first: g.t }; });
    if (best) out.push(best);
  });
  return out;
}

/* ١٣) منحنى الاحتفاظ المتوقع (كل ٥ ثواني في الفيديو النهائي) */
export interface Bucket { s: number; v: number; why: string }
export function retention(seg: Seg[], outDur: number, toOut: (t: number) => number = t => t, step = 5): Bucket[] {
  const L = seg.filter(g => !g.cut).map(g => ({ ...g, s: toOut(g.s), e: toOut(g.e) })), B: Bucket[] = []; let keep = 100;
  for (let s = 0; s < outDur; s += step) {
    const inn = L.filter(g => g.e > s && g.s < s + step), talk = inn.reduce((a, g) => a + Math.max(0, Math.min(g.e, s + step) - Math.max(g.s, s)), 0) / step;
    const sc = inn.reduce((a, g) => a + segScore(g), 0); let drop = s === 0 ? 18 : 6; let why = '';
    if (talk < .45) { drop += 9; why = 'سكوت كتير'; } if (sc >= 4) { drop -= 4; why = why || 'فيه جذب'; } if (s === 0 && sc >= 3) { drop -= 8; why = 'بداية قوية'; } if (s === 0 && sc < 2) why = 'البداية ضعيفة — حط هوك';
    if (!inn.length) { drop += 6; why = 'مفيش كلام'; }
    keep = Math.max(5, keep - Math.max(1, drop)); B.push({ s, v: Math.round(keep), why });
  }
  return B;
}

/* ١٤) تقرير الحشو والتكرار */
export function fillerReport(seg: Seg[], durMin: number) {
  const c: Record<string, number> = {}, all = seg.map(g => norm(g.t)).join(' ');
  FILLERS.forEach(f => { const m = all.match(new RegExp('(^|\\s)' + f + '(?=\\s|$)', 'g')); if (m && m.length) c[f] = m.length; });
  const total = Object.values(c).reduce((a, b) => a + b, 0), perMin = +(total / Math.max(.2, durMin)).toFixed(1), cut = seg.filter(g => g.cut).length;
  const rep: Record<string, number> = {}; seg.forEach(g => words(g.t).forEach(w => { const k = norm(w); if (k.length >= 4 && !STOP.has(k)) rep[k] = (rep[k] || 0) + 1; }));
  const over = Object.keys(rep).filter(k => rep[k] >= 4).sort((a, b) => rep[b] - rep[a]).slice(0, 5).map(k => [k, rep[k]] as [string, number]);
  const tips: string[] = []; if (perMin > 6) tips.push('كلمات الحشو كتير (' + ar(perMin) + '/دقيقة) — خد نفس بدل «يعني»'); if (cut > 3) tips.push('فيه ' + ar(cut) + ' إعادة — جهّز الجملة في دماغك قبل ما تبدأ'); if (over.length) tips.push('كلمة «' + over[0][0] + '» اتكررت ' + ar(over[0][1]) + ' مرة — نوّع');
  if (!tips.length) tips.push('كلامك نضيف 👌');
  return { counts: c, total, perMin, cut, over, tips };
}

/* ١٥) عناوين بديلة */
export function titleIdeas(seg: Seg[], title: string, shop = 'ميكانيزم'): string[] {
  const k = keywords(seg, 4, [shop, 'ميكانيزم']), a = k[0] || 'المنتج', num = (seg.map(g => g.t).join(' ').match(/[0-9٠-٩]+/) || [])[0];
  const L = [
    'ليه ' + a + ' ده أحسن من العادي؟', 'متشتريش ' + a + ' قبل ما تشوف الفيديو ده ⚠️', 'سر ' + a + ' اللي محدش بيقولهولك 🤫',
    num ? a + ' بـ' + num + ' بس؟! 😳' : 'كام سعر ' + a + ' النهارده؟ 💰', a + ' الأصلي ولا التقليد؟ شوف الفرق 👀', '٣ حاجات لازم تعرفها عن ' + a,
    'غلطة الكل بيعملها في ' + a + ' ❌', a + ' من ' + shop + ' — شوف الفرق بنفسك',
  ];
  return [...new Set((title ? [title] : []).concat(L))].map(x => x.slice(0, 60)).slice(0, 8);
}

/* ١٦) كابشن لكل منصة */
export function platformCaptions(seg: Seg[], title: string, b: { shop?: string; phone?: string; addr?: string; cta?: string }) {
  const k = keywords(seg, 6, [b.shop || '', 'ميكانيزم']), tags = [...new Set(['#' + (b.shop || 'ميكانيزم').replace(/\s+/g, '_')].concat(k.map(w => '#' + w)))], first = seg.filter(g => !g.cut).slice(0, 3).map(g => g.t).join(' ').split(/\s+/).slice(0, 24).join(' ');
  const cta = (b.cta || 'اطلب دلوقتي') + (b.phone ? ' 📞 ' + b.phone : ''), T = title || first.split(/\s+/).slice(0, 8).join(' ');
  return {
    tt: (T + ' 🔥\n' + tags.slice(0, 5).join(' ') + ' #fyp #explore').trim(),
    ig: (T + ' ✨\n\n' + first + '…\n\n' + cta + (b.addr ? '\n📍 ' + b.addr : '') + '\n.\n.\n' + tags.join(' ')).trim(),
    fb: (T + '\n\n' + first + '…\n\n✅ ' + cta + (b.addr ? '\n📍 ' + b.addr : '') + '\n\n' + tags.slice(0, 4).join(' ')).trim(),
    yt: (T + ' | ' + (b.shop || 'ميكانيزم')).slice(0, 95) + '\n\n' + first + '…\n\n' + cta + '\n\n' + tags.join(' '),
  };
}

/* ١٧) قائمة لقطات ناقصة */
export function shotList(seg: Seg[], toOut: (t: number) => number = t => t): { at: number; shot: string }[] {
  const L = seg.filter(g => !g.cut), out: { at: number; shot: string }[] = [], seen = new Set<string>();
  const MAP: [RegExp, string][] = [[/مجر|درج|ادراج/, 'لقطة قريبة للدرج وهو بيتفتح ويتقفل بهدوء'], [/مفصل|سوفت|هادي/, 'ماكرو للمفصلة وهي بتقفل لوحدها'], [/مقبض|اكر|كالون/, 'إيد ماسكة المقبض بإضاءة جانبية'], [/مطبخ/, 'لقطة واسعة للمطبخ من الركن بحركة بطيئة'], [/دريسنج|دولاب/, 'لقطة من تحت لفوق للدولاب مفتوح'], [/سعر|جنيه|خصم/, 'المنتج قدام الكاميرا ومعاه بطاقة السعر'], [/تركيب|يركب|مسمار|مسامير/, 'إيد بتركّب خطوة خطوة (لقطة من فوق)'], [/مقاس|سم|متر/, 'متر قياس على المنتج يبيّن المقاس'], [/خام|المنيوم|ستانلس|خشب/, 'لقطة قريبة جدًا للخامة والتشطيب'], [/لون|الوان/, 'الألوان المتاحة جنب بعض']];
  L.forEach(g => { const n = norm(g.t); MAP.forEach(([re, s]) => { if (re.test(n) && !seen.has(s)) { seen.add(s); out.push({ at: toOut(g.s), shot: s }); } }); });
  L.forEach(g => { if (g.e - g.s >= 7 && words(g.t).length / (g.e - g.s) < 1.4) out.push({ at: toOut(g.s), shot: 'الجزء ده بطيء — حط عليه لقطة إدراج للمنتج' }); });
  if (!out.length) out.push({ at: 0, shot: 'لقطة افتتاحية للمنتج في أول ثانيتين قبل ما تتكلم' });
  return out.sort((a, b) => a.at - b.at).slice(0, 10);
}

/* ١٩) سكريبت نضيف للمرة الجاية */
export function cleanScript(seg: Seg[], hook?: string, cta = 'اطلب دلوقتي'): string {
  const fill = new RegExp('(^|\\s)(' + FILLERS.join('|') + ')(?=\\s|$)', 'g');
  const L = seg.filter(g => !g.cut).map(g => norm(g.t) === g.t ? g.t : g.t).map(t => t.replace(fill, ' ').replace(/\s+/g, ' ').trim()).filter(t => words(t).length >= 2);
  const lines: string[] = []; if (hook) lines.push('🎣 ' + hook); L.forEach(t => { if (t !== hook) lines.push('• ' + t); }); lines.push('📞 ' + cta);
  return lines.join('\n');
}

/* ٢٠) SRT بتوقيت الفيديو النهائي */
export function toSrt(caps: { s: number; e: number; w: string[] }[], toOut: (t: number) => number = t => t): string {
  const f = (t: number) => { t = Math.max(0, t); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60), ms = Math.round((t % 1) * 1000); const p = (x: number, n = 2) => String(x).padStart(n, '0'); return p(h) + ':' + p(m) + ':' + p(s) + ',' + p(ms === 1000 ? 999 : ms, 3); };
  return caps.map((c, i) => (i + 1) + '\n' + f(toOut(c.s)) + ' --> ' + f(Math.max(toOut(c.s) + .3, toOut(c.e))) + '\n' + c.w.join(' ')).join('\n\n') + '\n';
}

/* ٩) كلمات الضربة: أوقات الكلمات القوية في الكلام (بتوقيت الأصل) */
export function punchWords(caps: { s: number; e: number; w: string[] }[], max = 8): { t: number; w: string }[] {
  const out: { t: number; w: string }[] = [];
  caps.forEach(c => { const n = c.w.length, d = Math.max(.2, c.e - c.s); c.w.forEach((w, i) => { const k = norm(w); if (PUNCH.some(p => k === p || (p.length >= 4 && k.includes(p)))) out.push({ t: c.s + d * i / n, w: w.replace(/[.,،؟!?]/g, '') }); }); });
  const res: { t: number; w: string }[] = []; out.forEach(x => { if (!res.length || x.t - res[res.length - 1].t > 4) res.push(x); }); return res.slice(0, max);
}

/* ١٠) ضربات الموسيقى من الطاقة (onsets) */
export function beatsOf(ch: Float32Array, sr: number, maxSec = 600): number[] {
  const hop = Math.round(sr * .02), n = Math.min(Math.floor(ch.length / hop), Math.floor(maxSec / .02)), E = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop; j < i * hop + hop; j++) s += ch[j] * ch[j]; E[i] = s; }
  const out: number[] = []; let last = -1;
  for (let i = 8; i < n - 1; i++) { let avg = 0; for (let k = i - 8; k < i; k++) avg += E[k]; avg /= 8; if (E[i] > avg * 1.8 && E[i] >= E[i - 1] && E[i] >= E[i + 1] && E[i] > 1e-4 && (last < 0 || i - last > 12)) { out.push(i * .02); last = i; } }
  return out;
}
