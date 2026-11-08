'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { scrapAdd, scrapReadTape, uploadScrapImage as uploadRequestImage } from '@/lib/api';
import { shrinkImage } from '@/lib/images';
import { getMe, saveMe } from '@/lib/me';
import { ALU_TYPES, BRAND_LINKS, CATS, COMMON_THICK, codesFor, groupsFor, SHEET_BRANDS, SHEET_MATERIALS, SOLID_SPECIES, type Cat } from '@/lib/scraps';
import { ev } from '@/lib/track';
import { WOOD_LIB } from '@/lib/woods';

const num = (v: string) => { const n = Number(String(v).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
export const SCRAP_KEY = 'mk_scraps';
const remember = (id: string, secret: string) => {
  try { const a = JSON.parse(localStorage.getItem(SCRAP_KEY) || '[]'); a.push({ id, secret }); localStorage.setItem(SCRAP_KEY, JSON.stringify(a.slice(-200))); } catch { /* */ }
};
const BLANK = { material: '', brand: '', code: '', color: '', thick: '', len: '', wid: '', qty: '1', note: '' };
const PREF_KEY = 'mk_scrap_prefs', RECENT_KEY = 'mk_scrap_recent';
const LEN_CHIPS = [30, 40, 50, 60, 80, 100, 120, 150];
const WID_CHIPS = [10, 15, 20, 25, 30, 40, 50, 60];
const LEVELS: [number, string][] = [[1, 'مبتدئ 🌱'], [5, 'نشيط ⭐'], [15, 'محترف 🔧'], [40, 'نجم السوق 🏅'], [100, 'أسطورة الفضلة 👑']];
const levelOf = (n: number) => {
  let i = -1; LEVELS.forEach(([t], k) => { if (n >= t) i = k; });
  return { name: i < 0 ? 'لسه ماسجّلتش' : LEVELS[i][1], next: LEVELS[i + 1] ?? null };
};
const myCount = () => { try { return (JSON.parse(localStorage.getItem(SCRAP_KEY) || '[]') as unknown[]).length; } catch { return 0; } };
const getRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const Progress = ({ n }: { n: number }) => {
  const l = levelOf(n);
  return <p className="mut" style={{ margin: '0 0 8px' }}>🏆 سجّلت <b>{n}</b> فضلة · مستواك: <b>{l.name}</b>{l.next ? ` · فاضل ${l.next[0] - n} للمستوى الجاي (${l.next[1]})` : ''}</p>;
};

type Piece = { len: string; wid: string; qty: number };
const PLAIN_COLORS: [string, string][] = [['أبيض', '#f4f4f1'], ['بيج', '#d9c9a8'], ['رمادي فاتح', '#b5b5b2'], ['رمادي غامق', '#555759'], ['أسود', '#1d1d1d'], ['أحمر', '#a8322d'], ['أزرق', '#2f4f7f'], ['أخضر', '#4a6b4a']];
const COLOR_SWATCHES: [string, string][] = [...WOOD_LIB.map(w => [w.name, w.tones[1]] as [string, string]), ...PLAIN_COLORS];
const fix = (v: string) => String(v).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/،/g, '.').replace(/(d)s*(?:في|ضرب|علي|على)s*(d)/g, '$1×$2');
/** «١٨ جوزي ٧٠×٣٠ × ٢» or one piece per line → pieces (+ thickness if written). */
function parseLines(text: string, cat: Cat): { pieces: Piece[]; thick: string } {
  const pieces: Piece[] = []; let thick = '';
  for (const raw of fix(text).split(/\n|;|؛/)) {
    let line = raw.trim(); if (!line) continue;
    const m = line.match(/(\d+(?:\.\d+)?)\s*[x×*✕]\s*(\d+(?:\.\d+)?)(?:\s*[x×*✕]\s*(\d+))?/i);
    if (m && cat !== 'alu') {
      line = line.replace(m[0], ' ');
      const t = (line.match(/\d+(?:\.\d+)?/g) || []).find(n => COMMON_THICK.includes(Number(n)));
      if (t && !thick) thick = t;
      pieces.push({ len: m[1], wid: m[2], qty: Math.max(1, Number(m[3] || 1)) });
    } else if (cat === 'alu') {
      const n = line.match(/\d+(?:\.\d+)?/g);
      if (n) pieces.push({ len: n[0], wid: '', qty: Math.max(1, Number(n[1] || 1)) });
    }
  }
  return { pieces, thick };
}

/** Drag on the rectangle to set the size (cm): for people who do not like typing numbers. */
function DrawBox({ maxL, maxW, len, wid, onSet }: { maxL: number; maxW: number; len: number; wid: number; onSet: (l: number, w: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    const l = Math.min(maxL, Math.max(5, Math.round(((e.clientX - r.left) / r.width) * maxL)));
    const w = Math.min(maxW, Math.max(5, Math.round(((e.clientY - r.top) / r.height) * maxW)));
    onSet(l, w);
  };
  const L = Math.min(len || 0, maxL), W = Math.min(wid || 0, maxW);
  return (
    <div>
      <div ref={ref} onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); move(e); }} onPointerMove={move}
        style={{ position: 'relative', width: '100%', aspectRatio: maxL + ' / ' + maxW, background: 'var(--bg)', border: '1.5px dashed var(--line)', borderRadius: 10, touchAction: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: (L / maxL) * 100 + '%', height: (W / maxW) * 100 + '%', background: 'var(--accent)', opacity: 0.35, border: '2px solid var(--accent)' }} />
        <span style={{ position: 'absolute', bottom: 4, insetInlineEnd: 8, fontSize: 12 }}>اسحب لحد المقاس · لوح كامل {maxL}×{maxW}</span>
      </div>
      <small>{L && W ? `${L} × ${W} سم` : 'اسحب صباعك على المستطيل'}</small>
    </div>
  );
}

type SR = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
function Voice({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false), [ok, setOk] = useState(true), rec = useRef<SR | null>(null);
  useEffect(() => { const w = window as unknown as Record<string, unknown>; setOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  if (!ok) return null;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const w = window as unknown as Record<string, new () => SR>;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition; const r = new R();
    r.lang = 'ar-EG'; r.continuous = false; r.interimResults = false;
    r.onresult = e => { const t = Array.from(e.results).map(x => x[0].transcript).join(' '); onText(t); };
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    rec.current = r; setOn(true); r.start();
  };
  return <button type="button" className={'sc-chip' + (on ? ' on' : '')} onClick={toggle}>{on ? '🎙 بسمعك… دوس عشان توقف' : '🎤 قول المقاسات بصوتك'}</button>;
}

export function AddForm() {
  const [cat, setCat] = useState<Cat>('sheet');
  const [f, setF] = useState(BLANK);
  const [who, setWho] = useState({ name: '', phone: '', area: '' });
  const [cond, setCond] = useState('new');
  const [mode, setMode] = useState('ask');
  const [price, setPrice] = useState('');
  const [edge, setEdge] = useState(false), [grain, setGrain] = useState(false);
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>([]), [lines, setLines] = useState(''), [showDraw, setShowDraw] = useState(false);
  const [cnt, setCnt] = useState(0), [recent, setRecent] = useState<string[]>([]), [editWho, setEditWho] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const tape = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState('');
  const [cands, setCands] = useState<{ len: number | null; wid: number | null }[]>([]);
  const fmt = (n: number | null) => (n == null ? '' : String(Math.round(n * 10) / 10));
  const applyRead = (len: number | null, wid: number | null) => setF(x => ({ ...x, len: fmt(len) || x.len, wid: cat === 'alu' ? x.wid : fmt(wid) || x.wid }));
  async function readTape(fs: FileList | null) {
    const x = fs?.[0]; if (!x) return;
    setCands([]); setMsg('⏳ بقرا المتر من الصورة…');
    try {
      const b = await shrinkImage(x, 1600);
      const r = await scrapReadTape(b);
      if (!r.ok || !r.data) return setMsg(r.message || 'مقدرتش أقرا المتر — صوّر أقرب وبإضاءة أحسن');
      const d = r.data;
      if (!d.ambiguous && d.len) { applyRead(d.len, d.wid); setMsg(`✔ قريت ${fmt(d.len)}${cat !== 'alu' && d.wid ? ' × ' + fmt(d.wid) : ''} سم — راجعه وعدّله لو غلط`); }
      else {
        const c = d.candidates.filter(k => k.len);
        if (!c.length) return setMsg('مش متأكد من القراءة — اكتب المقاس بإيدك أو صوّر تاني أقرب');
        setCands(c); setMsg('مش متأكد — اختار القراءة الصح:');
      }
    } catch { setMsg('مقدرتش أقرا المتر — جرّب تاني'); }
  }
  useEffect(() => {
    const m = getMe(); setWho(w => ({ ...w, name: m.name, phone: m.phone }));
    try { setWho(w => ({ ...w, area: localStorage.getItem('mk_scrap_area') || '' })); } catch { /* */ }
    try {
      const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
      if (p) { setCat(p.cat || 'sheet'); setF(x => ({ ...x, ...p.f, len: '', wid: '', qty: '1' })); setCond(p.cond || 'new'); setMode(p.mode || 'ask'); setEdge(!!p.edge); setGrain(!!p.grain); }
    } catch { /* */ }
    setCnt(myCount()); setRecent(getRecent());
  }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const setW = (k: keyof typeof who) => (e: { target: { value: string } }) => setWho(x => ({ ...x, [k]: e.target.value }));
  const whoOk = who.name.trim().length >= 2 && who.phone.replace(/\D/g, '').length >= 10 && who.area.trim().length >= 2;
  const qty = Math.max(1, Math.round(num(f.qty) || 1));

  async function pick(fs: FileList | null) {
    const list = [...(fs ?? [])].slice(0, 3 - pics.length);
    setMsg('⏳ بنجهّز الصور…');
    const out: { blob: Blob; url: string }[] = [];
    for (const x of list) { try { const b = await shrinkImage(x, 1400); out.push({ blob: b, url: URL.createObjectURL(b) }); } catch { /* skip */ } }
    setPics(p => [...p, ...out]);
    setMsg('');
  }

  async function go() {
    const thick = num(f.thick);
    const list: Piece[] = [...pieces];
    if (num(f.len)) list.push({ len: f.len, wid: f.wid, qty });
    if (!list.length) { setOpen('size'); return setMsg('اكتب الطول'); }
    if (cat !== 'alu' && list.some(p => !num(p.wid))) { setOpen('size'); return setMsg('اكتب العرض'); }
    if (cat !== 'alu' && !thick) { setOpen('size'); return setMsg('اختار السمك'); }
    if (cat === 'sheet' && !f.material) { setOpen('mat'); return setMsg('اختار نوع اللوح'); }
    if (mode === 'price' && !num(price)) { setOpen('more'); return setMsg('اكتب السعر'); }
    if (who.name.trim().length < 2) { setEditWho(true); setOpen('who'); return setMsg('اكتب اسمك'); }
    if (who.phone.replace(/\D/g, '').length < 10) { setEditWho(true); setOpen('who'); return setMsg('اكتب رقم واتساب صحيح'); }
    if (who.area.trim().length < 2) { setEditWho(true); setOpen('who'); return setMsg('اكتب منطقتك'); }
    setBusy(true); setMsg('⏳ جاري النشر…');
    try {
      const imgs: string[] = [];
      for (const p of pics) imgs.push(await uploadRequestImage(p.blob));
      for (const [i, p] of list.entries()) {
        setMsg(list.length > 1 ? `⏳ جاري النشر (${i + 1}/${list.length})…` : '⏳ جاري النشر…');
        const r = await scrapAdd({
          category: cat, material: f.material, brand: /غير ذلك/.test(f.brand) ? '' : f.brand.trim(), code: f.code.trim(), color: f.color.trim(),
          thick: thick || undefined, len: num(p.len), wid: cat === 'alu' ? undefined : num(p.wid) || undefined, qty: p.qty,
          cond, edge, grain, price_mode: mode, price: mode === 'price' ? num(price) : undefined,
          area: who.area.trim(), name: who.name.trim(), phone: who.phone.trim(), note: f.note.trim(), imgs,
        });
        if (!r.ok || !r.data) throw new Error(r.message);
        remember(r.data.id, r.data.secret);
      }
      setPieces([]); setLines('');
      const len = num(list[list.length - 1].len), wid = num(list[list.length - 1].wid);
      saveMe({ name: who.name, phone: who.phone });
      try {
        localStorage.setItem('mk_scrap_area', who.area);
        localStorage.setItem(PREF_KEY, JSON.stringify({ cat, f: { material: f.material, brand: f.brand, code: f.code, color: f.color, thick: f.thick }, cond, mode, edge, grain }));
        const key = cat === 'alu' ? String(len) : `${len}×${wid}`;
        const rec = [key, ...getRecent().filter(k => k !== key)].slice(0, 6);
        localStorage.setItem(RECENT_KEY, JSON.stringify(rec)); setRecent(rec);
      } catch { /* */ }
      setCnt(myCount());
      ev('generate_lead', 'Lead', { method: 'scrap_add', category: cat });
      setDone(n => n + 1); setBusy(false); setMsg('');
    } catch (e) {
      setMsg(/relation|function|PGRST/i.test((e as Error).message) ? 'السوق لسه مش متفعّل — حاول بعد شوية' : 'ماتنشرتش — جرّب تاني');
      setBusy(false);
    }
  }

  if (done) return (
    <div className="info-cards"><div>
      <h2>✔ اتنشرت فضلتك</h2>
      <Progress n={cnt} />
      كل حتة بتسجّلها بتوفّر على نجار لوح كامل. وهتظهر لأي نجار بيدوّر على المقاس ده. لما تتباع افتح <Link href="/scraps/mine">فضلتي</Link> وشيلها.
      <div className="sc-top" style={{ marginTop: 10 }}>
        <button type="button" className="pri" onClick={() => { setDone(0); setF(x => ({ ...x, len: '', wid: '', qty: '1', note: '' })); setPics([]); }}>➕ حتة تانية بنفس الخامة</button>
        <button type="button" className="sec" onClick={() => { setDone(0); setPics([]); }}>⎘ نفس المقاس تاني</button>
      </div>
      <div className="sc-top"><Link className="sec" href="/scraps">🔎 دوّر على فضلة</Link></div>
    </div></div>
  );
  const sizeSum = pieces.length ? pieces.length + ' حتة' : f.len ? f.len + (cat !== 'alu' && f.wid ? '×' + f.wid : '') + (f.thick && cat !== 'alu' ? ' · ' + f.thick + 'مم' : '') : '';
  const matSum = [f.material, f.brand, f.color].filter(Boolean).join(' · ');
  const moreSum = [cond !== 'new' ? 'مش جديدة' : '', mode !== 'ask' ? { price: 'بسعر', free: 'ببلاش', swap: 'بدل' }[mode] : '', f.note ? 'ملاحظة' : ''].filter(Boolean).join(' · ');
  const whoSum = whoOk ? who.name : '';
  const tiles: { k: string; ic: string; t: string; sum: string }[] = [
    { k: 'pics', ic: '📷', t: 'صور', sum: pics.length ? pics.length + ' صورة' : '' },
    { k: 'size', ic: '📐', t: 'المقاس', sum: sizeSum },
    { k: 'mat', ic: cat === 'sheet' ? '🎨' : cat === 'solid' ? '🪵' : '🔩', t: cat === 'sheet' ? 'اللون والشركة' : 'النوع', sum: matSum },
    { k: 'more', ic: '⚙️', t: 'باقي الاختيارات', sum: moreSum },
    { k: 'who', ic: '👤', t: 'بياناتك', sum: whoSum },
  ];
  const brandLink = BRAND_LINKS.find(b => b.match.test(f.brand));
  const codes = codesFor(f.brand), groups = groupsFor(f.brand);
  return (
    <div className="info-cards form">
      <div>
        <Progress n={cnt} />
        <div className="sc-cats">{CATS.map(([k, n]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => { setCat(k); setF(x => ({ ...x, material: '', brand: '', code: '' })); }}>{n}</button>)}</div>
        <div className="sc-tiles">
          {tiles.map(t => (
            <button key={t.k} type="button" className={'sc-tile' + (open === t.k ? ' on' : '') + (t.sum ? ' ok' : '')} onClick={() => setOpen(o => (o === t.k ? '' : t.k))} aria-expanded={open === t.k}>
              <span className="ic">{t.ic}</span><b>{t.t}</b><small>{t.sum || 'دوس'}</small>
            </button>
          ))}
        </div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        <input ref={tape} type="file" accept="image/*" capture="environment" hidden onChange={e => { readTape(e.target.files); e.target.value = ''; }} />
      </div>

      {open === 'pics' && <div className="sc-panel">
        <b>📷 صوّر الحتة (اختياري)</b>
        <div className="tpics">
          {pics.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" onClick={() => setPics(x => x.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></span>)}
          {pics.length < 3 && <button type="button" className="tadd" onClick={() => cam.current?.click()}>📷<small>كاميرا</small></button>}
          {pics.length < 3 && <button type="button" className="tadd" onClick={() => file.current?.click()}>🖼<small>من الموبايل</small></button>}
        </div>
      </div>}

      {open === 'size' && <div className="sc-panel">
        <button type="button" className="sc-chip on" style={{ width: '100%', padding: 12 }} onClick={() => tape.current?.click()}>📏 صوّر المتر على الحتة (بيقرا المقاس لوحده)</button>
        {cands.length > 0 && <div className="chips2" style={{ marginTop: 8 }}>{cands.map((k, i) => <button key={i} type="button" className="sc-chip" onClick={() => { applyRead(k.len, k.wid); setCands([]); setMsg('✔ اتحط ' + fmt(k.len) + (cat !== 'alu' && k.wid ? ' × ' + fmt(k.wid) : '') + ' — راجعه'); }}>{fmt(k.len)}{cat !== 'alu' && k.wid ? ' × ' + fmt(k.wid) : ''}</button>)}</div>}
        {cat !== 'alu' && <>
          <b>السمك (مم)</b>
          <div className="chips2">{COMMON_THICK.map(t => <button key={t} type="button" className={'sc-chip' + (f.thick === String(t) ? ' on' : '')} onClick={() => setF(x => ({ ...x, thick: String(t) }))}>{t}</button>)}
            <input className="sc-in" inputMode="decimal" value={COMMON_THICK.map(String).includes(f.thick) ? '' : f.thick} onChange={set('thick')} placeholder="غيره" aria-label="سمك تاني" /></div>
        </>}
        {recent.length > 0 && <>
          <b>مقاسات سجّلتها قبل كده</b>
          <div className="chips2">{recent.map(k => <button key={k} type="button" className="sc-chip" onClick={() => { const [l, w] = k.split('×'); setF(x => ({ ...x, len: l, wid: w ?? '' })); }}>{k.replace('×', ' × ')}</button>)}</div>
        </>}
        <div className="sc-dims">
          <label>الطول (سم)<input inputMode="decimal" value={f.len} onChange={set('len')} /></label>
          {cat !== 'alu' && <label>العرض (سم)<input inputMode="decimal" value={f.wid} onChange={set('wid')} /></label>}
        </div>
        <div className="chips2">{LEN_CHIPS.map(t => <button key={t} type="button" className={'sc-chip' + (f.len === String(t) ? ' on' : '')} onClick={() => setF(x => ({ ...x, len: String(t) }))}>{t}</button>)}</div>
        {cat !== 'alu' && <div className="chips2">{WID_CHIPS.map(t => <button key={t} type="button" className={'sc-chip' + (f.wid === String(t) ? ' on' : '')} onClick={() => setF(x => ({ ...x, wid: String(t) }))}>{t}</button>)}</div>}
        {cat !== 'alu' && <>
          <button type="button" className="sc-chip" onClick={() => setShowDraw(v => !v)}>{showDraw ? 'اقفل الرسم' : '✏️ ارسم المقاس بصباعك'}</button>
          {showDraw && <DrawBox maxL={cat === 'sheet' ? 244 : 400} maxW={cat === 'sheet' ? 122 : 40} len={num(f.len)} wid={num(f.wid)} onSet={(l, w) => setF(x => ({ ...x, len: String(l), wid: String(w) }))} />}
        </>}
        <b>العدد</b>
        <div className="chips2">
          <button type="button" className="sc-chip" onClick={() => setF(x => ({ ...x, qty: String(Math.max(1, qty - 1)) }))} aria-label="أقل">−</button>
          <span className="sc-chip on" style={{ minWidth: 44, textAlign: 'center' }}>{qty}</span>
          <button type="button" className="sc-chip" onClick={() => setF(x => ({ ...x, qty: String(qty + 1) }))} aria-label="أكتر">+</button>
        </div>
        <button type="button" className="sc-chip on" style={{ marginTop: 8 }} onClick={() => {
          if (!num(f.len)) return setMsg('اكتب الطول الأول');
          if (cat !== 'alu' && !num(f.wid)) return setMsg('اكتب العرض الأول');
          setPieces(p => [...p, { len: f.len, wid: f.wid, qty }]); setF(x => ({ ...x, len: '', wid: '', qty: '1' })); setMsg('');
        }}>➕ ضيف الحتة للقايمة وكمّل (أكتر من حتة مرة واحدة)</button>
        {pieces.length > 0 && <div className="chips2" style={{ marginTop: 8 }}>{pieces.map((p, i) => <button key={i} type="button" className="sc-chip" onClick={() => setPieces(x => x.filter((_, k) => k !== i))} title="دوس تشيل">{p.len}{p.wid ? ' × ' + p.wid : ''}{p.qty > 1 ? ' ×' + p.qty : ''} ✕</button>)}</div>}
        <label style={{ marginTop: 8 }}>أو اكتب الحتت كلها (سطر لكل حتة) <small>مثال: 70×30 ×2</small>
          <textarea rows={3} value={lines} onChange={e => setLines(e.target.value)} placeholder={'70×30\n50×25 × 3\n120×40'} />
        </label>
        <Voice onText={t => { const r = parseLines(t, cat); if (!r.pieces.length) { setLines(x => (x ? x + " " : '') + t); return setMsg('سمعت: «' + t + '» — قولها زي: سبعين في تلاتين'); } setPieces(p => [...p, ...r.pieces]); if (r.thick) setF(x => ({ ...x, thick: r.thick })); setMsg('✔ اتضافت ' + r.pieces.length + ' حتة'); }} />
        {lines.trim() && <button type="button" className="sc-chip" onClick={() => {
          const r = parseLines(lines, cat);
          if (!r.pieces.length) return setMsg('ماقدرتش أفهم المقاسات — اكتبها زي 70×30');
          setPieces(p => [...p, ...r.pieces]); if (r.thick) setF(x => ({ ...x, thick: r.thick })); setLines(''); setMsg('');
        }}>حوّلها لقايمة</button>}
      </div>}

      {open === 'mat' && <div className="sc-panel">
        {cat === 'sheet' && <>
          <label>نوع اللوح<select value={f.material} onChange={set('material')}><option value="">اختار</option>{SHEET_MATERIALS.map(m => <option key={m}>{m}</option>)}</select></label>
          <b>الشركة (كتالوجات الشركات)</b>
          <div className="chips2">{SHEET_BRANDS.map(b => <button key={b} type="button" className={'sc-chip' + (f.brand === b ? ' on' : '')} onClick={() => setF(x => ({ ...x, brand: x.brand === b ? '' : b, code: '' }))}>{b}</button>)}</div>
          {f.brand && <p className="mut" style={{ margin: '4px 0' }}>
            {codes.length ? <>أكواد <b>{f.brand}</b> — دوس على الكود:</> : <>أكواد <b>{f.brand}</b> لسه مش متسجّلة هنا — اكتب الكود بإيدك.</>}
            {brandLink && <> · <a href={brandLink.url} target="_blank" rel="noopener noreferrer">افتح كتالوج {brandLink.name} ↗</a></>}
          </p>}
          {groups.map(g => <div key={g.name}><small><b>{g.name}</b></small><div className="chips2">{g.codes.map(c => <button key={c} type="button" className={'sc-chip' + (f.code === c ? ' on' : '')} onClick={() => setF(x => ({ ...x, code: x.code === c ? '' : c }))}>{c}</button>)}</div></div>)}
          {codes.length > 0 && !groups.length && <div className="chips2">{codes.map(c => <button key={c} type="button" className={'sc-chip' + (f.code === c ? ' on' : '')} onClick={() => setF(x => ({ ...x, code: x.code === c ? '' : c }))}>{c}</button>)}</div>}
          <label>كود اللون <small>(مكتوب على اللوح أو الفاتورة)</small><input value={f.code} onChange={set('code')} maxLength={30} /></label>
          <b>اللون (دوس على اللون الأقرب)</b>
          <div className="chips2" style={{ gap: 8 }}>{COLOR_SWATCHES.map(([n, c]) => <button key={n} type="button" title={n} aria-label={n} onClick={() => setF(x => ({ ...x, color: x.color === n ? '' : n }))}
            style={{ width: 40, height: 40, padding: 0, borderRadius: 10, background: c, border: f.color === n ? '3px solid var(--accent)' : '1.5px solid var(--line)' }} />)}</div>
          {f.color && <small>اللون المختار: <b>{f.color}</b></small>}
          <label>اسم اللون <small>(اختياري)</small><input value={f.color} onChange={set('color')} maxLength={40} placeholder="مثلاً: جوزي غامق" /></label>
        </>}
        {cat === 'solid' && <label>نوع الخشب<select value={f.material} onChange={set('material')}><option value="">اختار</option>{SOLID_SPECIES.map(m => <option key={m}>{m}</option>)}</select></label>}
        {cat === 'alu' && <>
          <label>نوع القطاع<select value={f.material} onChange={set('material')}><option value="">اختار</option>{ALU_TYPES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>الكود أو اللون <small>(اختياري)</small><input value={f.code} onChange={set('code')} maxLength={30} /></label>
        </>}
      </div>}

      {open === 'more' && <div className="sc-panel">
        <label>الحالة<select value={cond} onChange={e => setCond(e.target.value)}><option value="new">جديدة</option><option value="used">مستعملة</option><option value="scratched">فيها خدش</option></select></label>
        {cat === 'sheet' && <label className="agree"><input type="checkbox" checked={edge} onChange={e => setEdge(e.target.checked)} /> متقفّلة حرف</label>}
        {cat !== 'alu' && <label className="agree"><input type="checkbox" checked={grain} onChange={e => setGrain(e.target.checked)} /> ليها اتجاه عرق (متتلفش)</label>}
        <label>تبيعها إزاي؟<select value={mode} onChange={e => setMode(e.target.value)}><option value="ask">نتفق على السعر</option><option value="price">بسعر محدد</option><option value="free">ببلاش</option><option value="swap">بدل</option></select></label>
        {mode === 'price' && <label>السعر (جنيه)<input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></label>}
        <label>ملاحظة <small>(اختياري)</small><textarea rows={2} value={f.note} onChange={set('note')} maxLength={300} placeholder="مثلاً: فيها شرخ صغير في الركن" /></label>
      </div>}

      {open === 'who' && <div className="sc-panel">
        <h2>بياناتك (مرة واحدة بس)</h2>
        <label>الاسم<input value={who.name} onChange={setW('name')} maxLength={80} autoComplete="name" /></label>
        <label>رقم الواتساب<input value={who.phone} onChange={setW('phone')} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="01xxxxxxxxx" /></label>
        <label>المنطقة<input value={who.area} onChange={setW('area')} maxLength={80} placeholder="مثلاً: فيصل، الجيزة" /></label>
      </div>}

      <div>
        {pieces.length > 0 && open !== 'size' && <div className="chips2" style={{ marginBottom: 8 }}>{pieces.map((p, i) => <button key={i} type="button" className="sc-chip" onClick={() => setPieces(x => x.filter((_, k) => k !== i))} title="دوس تشيل">{p.len}{p.wid ? ' × ' + p.wid : ''}{p.qty > 1 ? ' ×' + p.qty : ''} ✕</button>)}</div>}
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg || (whoOk ? 'هتتسجّل باسم ' + who.name + ' · ' + who.area + '. الرقم بيظهر بس لمن حد يدوس «اطلبها».' : 'دوس على «بياناتك» مرة واحدة، وبعدها بيتحفظوا.')}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>انشر الفضلة</button>
      </div>
    </div>
  );
}
