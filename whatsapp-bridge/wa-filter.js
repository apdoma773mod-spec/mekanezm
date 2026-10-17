// wa-filter.js v2 — فلتر رسايل الواتساب لجسر ميكانيزم (2026-10-15)
// القاعدة: مفيش رسالة ولا صورة تدخل السيستم إلا بسبب واضح (كلمة مفتاحية / عميل-مورد مسجّل / رقم مسموح).
// - القواعد بتتقري من السيستم (wa_rules_get) وبتتحفظ نسخة على الجهاز (wa-rules-cache.json)
//   عشان لو النت فصل أو الجسر اتعاد تشغيله ميرجعش يقبل كل حاجة.
// - لو مفيش قواعد خالص: وضع صارم افتراضي (مش «اقبل كل الصور» زي الأول).
// مفيش أي مفتاح أو سر هنا: الجسر بيمرّر rpc و secret بتوعه.
'use strict';
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, 'wa-rules-cache.json');
const KNOWN_CACHE = path.join(__dirname, 'wa-known-cache.json');

const DEFAULT_RULES = {
  enabled: true,
  windowMin: 10,
  ownerPhones: [],
  blockPhones: [],      // أرقام بتتجاهل دايمًا (أهل/أصحاب)
  allowPhones: [],      // أرقام بتدخل دايمًا (صنايعية شغالين معاك)
  ignoreSaved: false,   // تجاهل أي رقم متسجّل في موبايل المحل
  never: [],            // عبارات لو موجودة الرسالة تتجاهل حتى لو فيها كلمة
  photos: { byCaption: true, byWindow: true, fromKnown: true },
  rules: [
    { phrases: ['طلب', 'اوردر', 'order'], type: 'طلب', scope: 'both', mode: 'contains', on: true },
    { phrases: ['تحويل', 'حولت', 'حولتلك', 'ايصال تحويل', 'انستاباي', 'instapay'], type: 'تحويل', scope: 'both', mode: 'contains', on: true },
  ],
};

// ───────── محرك المطابقة (نفس الكود بالظبط موجود في شاشة الكلمات عشان «جرّب رسالة» تدّي نفس النتيجة)
function norm(s) {
  return String(s || '')
    .replace(/[ً-ٰـ]/g, '')                 // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1$1')                          // طلبببب ← طلبب
    .replace(/\s+/g, ' ').trim();
}
const words = (t) => t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'ا', 'ي', 'ت', 'ن', 'س'];
function variants(w) {
  const out = new Set([w]);
  const strip = (x, depth) => {
    if (depth > 2) return;
    for (const p of PREFIXES) if (x.length - p.length >= 2 && x.startsWith(p)) { const y = x.slice(p.length); if (!out.has(y)) { out.add(y); strip(y, depth + 1); } }
  };
  strip(w, 1);
  return [...out];
}
const skel = (x) => x.charAt(0) + x.slice(1).replace(/[اوي]/g, '');
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// كلمة واحدة: كلمة قصيرة (حرفين) لازم تطابق بالظبط. ٣-٤ حروف: الكلمة تبدأ بيها (بعد شيل و/ب/ال...) من غير تقريب
// (عشان «قلب» و«كلب» و«طلع» متتحسبش «طلب»). ٥ حروف أو أكتر: بيتحمّل غلطة حرف (٨+ حرفين).
function wordHit(w, q, fuzzy) {
  if (w === q) return true;
  if (q.length <= 2) return false;
  for (const v of variants(w)) {
    if (v === q) return true;
    if (v.startsWith(q) && v.length - q.length <= 5) return true;
    // حروف المد (ا و ي) بيتكتبوا ويتشالوا كتير: «دولفة» = «دلفة»، «استانليس» = «استانلس»
    if (q.length >= 4) { const sq = skel(q), sv = skel(v); if (sq.length >= 3 && (sv === sq || (sv.startsWith(sq) && sv.length - sq.length <= 3))) return true; }
    if (fuzzy !== false && q.length >= 5) {
      const lim = q.length >= 7 && v[0] === q[0] ? 2 : 1;   // كلمة طويلة: بتتحمّل غلطتين (استلس = استانلس)
      if (Math.abs(v.length - q.length) <= lim && lev(v, q) <= lim) return true;
      if (v.length > q.length && lev(v.slice(0, q.length), q) <= lim && v.length - q.length <= 4) return true;
    }
  }
  return false;
}
function phraseHit(p, t, ws, mode, fuzzy) {
  const q = norm(p);
  if (!q) return false;
  if (mode === 'exact') return t === q;
  if (mode === 'starts') { const qw = words(q); return qw.length > 0 && qw.every((x, i) => ws[i] && wordHit(ws[i], x, fuzzy)); }
  const qw = words(q);
  if (!qw.length) return false;
  if (qw.length === 1) return ws.some((w) => wordHit(w, qw[0], fuzzy));
  if ((' ' + ws.join(' ') + ' ').includes(' ' + qw.join(' ') + ' ')) return true;
  // عبارة من كذا كلمة: كل كلماتها لازم تبقى موجودة وقريبة من بعض (جوه ٦ كلمات)
  for (let i = 0; i < ws.length; i++) {
    if (!wordHit(ws[i], qw[0], fuzzy)) continue;
    const win = ws.slice(i, i + qw.length + 5);
    if (qw.every((x) => win.some((w) => wordHit(w, x, fuzzy)))) return true;
  }
  return false;
}
function ruleHits(rule, text) {
  const t = norm(text), ws = words(t);
  if (!ws.length) return false;
  if ((rule.not || []).some((p) => phraseHit(p, t, ws, 'contains', false))) return false;
  return (rule.phrases || []).some((p) => phraseHit(p, t, ws, rule.mode, rule.fuzzy));
}
// ───────── نهاية المحرك

const digits = (p) => String(p || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '');
const last10 = (p) => digits(p).slice(-10);
const inList = (list, phone) => { const p = last10(phone); return !!p && (list || []).some((o) => last10(o) === p); };

let CFG = DEFAULT_RULES, SRC = 'default';
let KNOWN = new Set();
let ctx = null;
let PRIVATE = false, FORCE_SAVED = false;   // للأرقام الشخصية: مفيش نص رسايل بيتحفظ، والأرقام المتسجّلة (أهل/أصحاب) بتتجاهل
let ignoredToday = 0, acceptedToday = 0, dayKey = '', recent = [];
const lastKw = new Map();   // رقم ← وقت آخر رسالة فيها كلمة مفتاحية
const seen = new Map();     // msg id ← وقت (منع التكرار)
const today = () => new Date().toISOString().slice(0, 10);

function merge(v) {
  return Object.assign({}, DEFAULT_RULES, v, { photos: Object.assign({}, DEFAULT_RULES.photos, (v && v.photos) || {}) });
}
function loadCache() {
  try { const v = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (v && Array.isArray(v.rules) && v.rules.length) { CFG = merge(v); SRC = 'cache'; } } catch (e) {}
  try { const k = JSON.parse(fs.readFileSync(KNOWN_CACHE, 'utf8')); if (Array.isArray(k)) KNOWN = new Set(k.map(last10).filter(Boolean)); } catch (e) {}
}

function init(c) {
  ctx = c;
  PRIVATE = !!c.private; FORCE_SAVED = !!c.ignoreSaved;
  loadCache();
  log('🔑 الفلتر بدأ — القواعد من: ' + (SRC === 'cache' ? 'النسخة المحفوظة على الجهاز' : 'الوضع الصارم الافتراضي'));
  refresh(); refreshKnown();
  setInterval(refresh, 60 * 1000);
  setInterval(refreshKnown, 10 * 60 * 1000);
  if (!PRIVATE) setInterval(pushStat, 60 * 1000);
}
const log = (m) => { try { ctx && ctx.log && ctx.log(m); } catch (e) {} };

let warned = 0;
async function refresh() {
  try {
    const r = await ctx.rpc('wa_rules_get', { p_secret: ctx.secret });
    const v = typeof r === 'string' ? JSON.parse(r) : r;
    if (v && Array.isArray(v.rules) && v.rules.length) {
      CFG = merge(v); SRC = 'server';
      try { fs.writeFileSync(CACHE, JSON.stringify(v)); } catch (e) {}
    } else if (v && v.enabled === false) { CFG = merge({ enabled: false }); SRC = 'server'; }
    // لو السيستم رجّع فاضي (لسه محدش حفظ قواعد) بنفضل على النسخة المحفوظة أو الصارم
  } catch (e) {
    if (Date.now() - warned > 30 * 60 * 1000) { warned = Date.now(); log('🔑 الفلتر: مش قادر أقرا القواعد من السيستم (' + String(e.message).slice(0, 80) + ') — شغّال بـ ' + (SRC === 'cache' ? 'النسخة المحفوظة' : 'الوضع الصارم')); }
  }
}
async function refreshKnown() {
  try {
    const r = await ctx.rpc('wa_known_phones', { p_secret: ctx.secret });
    const arr = (typeof r === 'string' ? JSON.parse(r) : r) || [];
    if (Array.isArray(arr)) {
      KNOWN = new Set(arr.map(last10).filter(Boolean));
      try { fs.writeFileSync(KNOWN_CACHE, JSON.stringify([...KNOWN])); } catch (e) {}
    }
  } catch (e) { /* الدالة لسه مش متشغّلة: بنستخدم النسخة المحفوظة لو موجودة */ }
}

function match(text, phone) {
  const isOwner = inList(CFG.ownerPhones, phone);
  for (const r of CFG.rules || []) {
    if (r.on === false) continue;
    if (r.scope === 'owner' && !isOwner) continue;
    if (r.scope === 'shop' && isOwner) continue;
    if (ruleHits(r, text)) return r;
  }
  // كلمات الاستانلس مدمجة (بكل طرق كتابتها) — طلب الاستانلس مايتجاهلش حتى لو الكلمة مش في القواعد (2026-10-17)
  if (ruleHits(STEEL_RULE, text)) return STEEL_RULE;
  return null;
}
const STEEL_RULE = { phrases: ['استانلس', 'ستانلس', 'استنلس', 'استلس', 'ستنلس', 'استانليس', 'ستانليس', 'ستينلس', 'stainless', 'حرف يو', 'حرف u'], type: 'استانلس', scope: 'both', mode: 'contains', builtin: true, on: true };
function neverHit(text) {
  const t = norm(text), ws = words(t);
  return (CFG.never || []).some((p) => phraseHit(p, t, ws, 'contains', false));
}

function note(phone, name, text, why) {
  const d = today();
  if (d !== dayKey) { dayKey = d; ignoredToday = 0; acceptedToday = 0; }
  ignoredToday++;
  if (PRIVATE) return;   // رقم شخصي: ولا نص ولا رقم بيتسجّل للرسايل اللي اتجاهلت
  recent.push({ at: Date.now(), phone: String(phone || ''), name: String(name || ''), text: String(text || '').slice(0, 300), why: why || '' });
  const cut = Date.now() - 24 * 3600 * 1000;
  recent = recent.filter((x) => x.at >= cut).slice(-40);
}
// حماية من الإغراق: رقم واحد مايدخلش أكتر من ٢٥ رسالة/صورة في ١٠ دقايق (إلا رقمك)
const burst = new Map();
function flood(phone) {
  if (inList(CFG.ownerPhones, phone)) return false;
  const k = last10(phone) || String(phone || ''), now = Date.now();
  const a = (burst.get(k) || []).filter((t) => now - t < 10 * 60 * 1000);
  a.push(now); burst.set(k, a);
  if (burst.size > 2000) burst.clear();
  return a.length > 25;
}
function ok(res) {
  const d = today();
  if (d !== dayKey) { dayKey = d; ignoredToday = 0; acceptedToday = 0; }
  acceptedToday++;
  return res;
}
// منع نفس الرسالة تتعالج مرتين (واتساب أحيانًا بيبعت الحدث مرتين)
function dup(id) {
  if (!id) return false;
  const now = Date.now();
  if (seen.has(id)) return true;
  seen.set(id, now);
  if (seen.size > 800) { const cut = now - 3600 * 1000; for (const [k, t] of seen) if (t < cut) seen.delete(k); }
  return false;
}

// meta: { saved: متسجّل في موبايل المحل؟ }
// بيرجّع { accept, rule?, why }
function decideText(text, phone, name, meta) {
  meta = meta || {};
  if (inList(CFG.blockPhones, phone)) { note(phone, name, text, 'رقم محظور'); return { accept: false, why: 'رقم محظور' }; }
  if (CFG.enabled === false) return ok({ accept: true, why: 'الفلتر مقفول', rule: { type: 'كل الرسايل' } });
  const allowed = inList(CFG.allowPhones, phone);
  if ((CFG.ignoreSaved || FORCE_SAVED) && meta.saved && !allowed && !KNOWN.has(last10(phone)) && !inList(CFG.ownerPhones, phone)) { note(phone, name, text, 'متسجّل في موبايل المحل'); return { accept: false, why: 'متسجّل في الموبايل' }; }
  if (neverHit(text)) { note(phone, name, text, 'فيها عبارة ممنوعة'); return { accept: false, why: 'عبارة ممنوعة' }; }
  const r = match(text, phone);
  if ((r || allowed) && flood(phone)) { note(phone, name, text, 'رسايل كتير ورا بعض (إغراق)'); return { accept: false, why: 'إغراق' }; }
  if (r) { lastKw.set(last10(phone), Date.now()); return ok({ accept: true, rule: r, why: 'كلمة مفتاحية' }); }
  if (allowed) return ok({ accept: true, rule: { type: 'طلب' }, why: 'رقم مسموح' });
  // تكملة: رسالة من غير كلمة بس جاية ورا رسالة فيها كلمة من نفس الرقم (خلال نافذة الدقايق) ← جزء من نفس الطلب
  const lk = lastKw.get(last10(phone));
  if (lk && Date.now() - lk <= (CFG.windowMin || 10) * 60 * 1000) {
    if (flood(phone)) { note(phone, name, text, 'رسايل كتير ورا بعض (إغراق)'); return { accept: false, why: 'إغراق' }; }
    lastKw.set(last10(phone), Date.now());
    return ok({ accept: true, follow: true, rule: { type: 'تكملة' }, why: 'تكملة رسالة الطلب' });
  }
  remember(phone, text);
  note(phone, name, text, 'مفيش كلمة مفتاحية');
  return { accept: false, why: 'مفيش كلمة مفتاحية' };
}

// صورة: بتدخل بس لو: من رقمك / رقم مسموح / عميل-مورد متسجّل في السيستم / تعليقها فيه كلمة / بعد رسالة بكلمة من نفس الرقم خلال النافذة
function decidePhoto(caption, phone, name, meta) {
  meta = meta || {};
  const P = CFG.photos || {};
  if (inList(CFG.blockPhones, phone)) { note(phone, name, '[صورة] ' + (caption || ''), 'رقم محظور'); return { accept: false, why: 'رقم محظور' }; }
  if (CFG.enabled === false) return ok({ accept: true, why: 'الفلتر مقفول' });
  if (inList(CFG.ownerPhones, phone)) return ok({ accept: true, owner: true, why: 'رقمك الشخصي' });
  if (inList(CFG.allowPhones, phone)) return flood(phone) ? { accept: false, why: 'إغراق' } : ok({ accept: true, why: 'رقم مسموح' });
  if ((CFG.ignoreSaved || FORCE_SAVED) && meta.saved && !KNOWN.has(last10(phone))) { note(phone, name, '[صورة] ' + (caption || ''), 'متسجّل في موبايل المحل'); return { accept: false, why: 'متسجّل في الموبايل' }; }
  if (caption && neverHit(caption)) { note(phone, name, '[صورة] ' + caption, 'فيها عبارة ممنوعة'); return { accept: false, why: 'عبارة ممنوعة' }; }
  if (P.byCaption !== false && caption) {
    const r = match(caption, phone);
    if (r && flood(phone)) { note(phone, name, '[صورة] ' + caption, 'إغراق'); return { accept: false, why: 'إغراق' }; }
    if (r) { lastKw.set(last10(phone), Date.now()); return ok({ accept: true, rule: r, why: 'كلمة في التعليق' }); }
  }
  if (P.fromKnown !== false && KNOWN.has(last10(phone))) return flood(phone) ? { accept: false, why: 'إغراق' } : ok({ accept: true, known: true, why: 'عميل/مورد متسجّل' });
  if (P.byWindow !== false) {
    const t = lastKw.get(last10(phone));
    if (t && Date.now() - t <= (CFG.windowMin || 10) * 60 * 1000) return ok({ accept: true, window: true, why: 'بعد رسالة بكلمة' });
  }
  note(phone, name, '[صورة] ' + (caption || ''), 'صورة من غير سبب');
  return { accept: false, why: 'صورة من غير كلمة ومن رقم مش معروف' };
}

// ───────── تجميع رسايل الطلب الواحد (2026-10-17)
// العميل كتير بيبعت «طلب» في رسالة والتفاصيل في رسالة تانية (أو العكس). بدل ما كل رسالة تبقى طلب لوحدها أو تتجاهل:
// - الرسايل اللي من غير كلمة قبل رسالة الكلمة بـ ٣ دقايق (من نفس الرقم) بتتضم في أول الطلب (في الذاكرة بس، مابتتسجّلش)
// - الرسايل اللي بعدها بتتضم لنفس الطلب لحد ما الرقم يسكت ٤٥ ثانية (بحد أقصى ٤ دقايق)
const HOLD_MS = 45 * 1000, HOLD_MAX = 4 * 60 * 1000, BEFORE_MS = 3 * 60 * 1000;
const hold = new Map(), before = new Map();
function remember(phone, text) {
  if (PRIVATE) return;
  const k = last10(phone); if (!k || !text) return;
  const now = Date.now();
  const a = (before.get(k) || []).filter((x) => now - x.at < BEFORE_MS);
  a.push({ at: now, text: String(text).slice(0, 1500) });
  before.set(k, a.slice(-5));
  if (before.size > 500) before.clear();
}
function group(o, dec, sendFn) {
  const k = last10(o.phone) || String(o.msg_id || Math.random());
  const now = Date.now();
  let h = hold.get(k);
  if (h) { h.o.body += '\n' + o.body; h.n++; clearTimeout(h.t); }
  else {
    const prev = dec && dec.follow ? [] : (before.get(k) || []).filter((x) => now - x.at < BEFORE_MS).map((x) => x.text);
    before.delete(k);
    const body = (dec && dec.follow ? '↩️ تكملة لطلب اتبعت قبل كده من نفس الرقم:\n' : '') + (prev.length ? prev.join('\n') + '\n' : '') + o.body;
    h = { o: Object.assign({}, o, { body }), at: now, n: 1 + prev.length };
    hold.set(k, h);
  }
  const wait = now - h.at >= HOLD_MAX ? 0 : HOLD_MS;
  const v = (h.v = (h.v || 0) + 1);
  h.t = setTimeout(() => { if (h.v !== v || hold.get(k) !== h) return; hold.delete(k); sendFn(h.o, h.n); }, wait);
}
// لو الجسر قفل (اتفصل/اتعاد تشغيله) والطلب لسه بيتجمّع: يتحفظ في الطابور ويتبعت أول ما يشتغل
process.on('exit', () => {
  if (!hold.size || !ctx || !ctx.queue) return;
  try { for (const h of hold.values()) fs.appendFileSync(ctx.queue, JSON.stringify(h.o) + '\n'); } catch (e) {}
});

async function pushStat() {
  try {
    await ctx.rpc('wa_rules_stat', { p_secret: ctx.secret, p_stat: { day: dayKey || today(), ignored: ignoredToday, accepted: acceptedToday, src: SRC, known: KNOWN.size, recent, at: new Date().toISOString() } });
  } catch (e) { /* مش مهم */ }
}

module.exports = { init, decideText, decidePhoto, norm, match, ruleHits, dup, group, _set: (v) => { CFG = merge(v); } };
