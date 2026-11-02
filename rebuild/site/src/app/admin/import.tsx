'use client';
// Admin → «استيراد»: products from Excel / CSV / JSON / pasted cells, photos in bulk matched by product code,
// and restoring a site backup. Every import shows a preview first and nothing is written until the owner confirms.
import { useMemo, useRef, useState } from 'react';
import { saveDoc, type Rec, type SiteDoc } from '@/lib/admin-api';
import { FIELD_LABEL, guessField, parseDelimited, readTable, truthy, type Table } from '@/lib/import-files';
import { sendPhoto, uid7 } from './ui';

const lite = (s: string) => String(s ?? '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const FIELDS = Object.keys(FIELD_LABEL);

export function ImportTab({ doc, onDoc, backup }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void; backup: () => void }) {
  return <>
    <ProductImport doc={doc} onDoc={onDoc} />
    <BulkPhotos doc={doc} onDoc={onDoc} />
    <Restore doc={doc} onDoc={onDoc} backup={backup} />
  </>;
}

/* ───────────── products from a file ───────────── */
function ProductImport({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  const [table, setTable] = useState<Table | null>(null), [map, setMap] = useState<string[]>([]);
  const [paste, setPaste] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const [upd, setUpd] = useState(true), [add, setAdd] = useState(true), [hideNew, setHideNew] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const products: Rec[] = doc.data.products ?? [];

  function load(t: Table) {
    if (!t.rows.length) return setMsg('الملف فاضي أو مفيهوش صفوف');
    setTable(t); setMap(t.headers.map(guessField)); setMsg('');
  }
  async function pick(f?: File) {
    if (!f) return;
    try { load(await readTable(f)); } catch (e) { setMsg('✗ ' + (e as Error).message); }
  }
  const col = (field: string) => map.indexOf(field);
  const plan = useMemo(() => {
    if (!table) return null;
    const ci = (f: string) => map.indexOf(f);
    const byCode = new Map(products.map(p => [String(p.code ?? '').trim(), p]));
    const seen = new Set<string>();
    const items = table.rows.map((r, i) => {
      const g = (f: string) => (ci(f) < 0 ? '' : r[ci(f)] ?? '').trim();
      const code = g('code'), name = g('name');
      let st: 'new' | 'upd' | 'bad' = 'new', why = '';
      if (!code) { st = 'bad'; why = 'من غير كود'; }
      else if (seen.has(code)) { st = 'bad'; why = 'كود مكرر في الملف'; }
      else if (byCode.has(code)) st = 'upd';
      else if (!name) { st = 'bad'; why = 'من غير اسم'; }
      seen.add(code);
      return { i, r, code, name, st, why };
    });
    return { items, n: items.filter(x => x.st === 'new').length, u: items.filter(x => x.st === 'upd').length, b: items.filter(x => x.st === 'bad').length };
  }, [table, map, products]);

  async function apply() {
    if (!table || !plan) return;
    setBusy(true); setMsg('⏳ جاري الاستيراد…');
    try {
      let made = 0, changed = 0, secsMade = 0;
      const d = await saveDoc(x => {
        const arr: Rec[] = (x.products ??= []);
        const secs: Rec[] = (x.sections ??= []);
        const byCode = new Map(arr.map(p => [String(p.code ?? '').trim(), p]));
        const secId = (name: string) => {
          const n = name.trim() || 'غير مصنف';
          let s = secs.find(y => lite(y.name) === lite(n));
          if (!s) { s = { id: uid7(), name: n, img: '' }; secs.push(s); secsMade++; }
          return s.id as string;
        };
        for (const it of plan.items) {
          if (it.st === 'bad') continue;
          const g = (f: string) => (col(f) < 0 ? '' : it.r[col(f)] ?? '').trim();
          const cur = byCode.get(it.code);
          if (it.st === 'upd' && !upd) continue;
          if (it.st === 'new' && !add) continue;
          const o: Rec = cur ?? { id: uid7(), code: it.code, imgs: [] };
          if (g('name')) o.name = g('name');
          if (g('sec')) o.sec = secId(g('sec')); else if (!cur) o.sec = secId('');
          if (g('desc')) o.desc = g('desc');
          if (g('brand')) o.brand = g('brand');
          if (g('badge')) o.badge = g('badge');
          if (g('video')) o.video = g('video');
          if (g('tags')) o.tags = g('tags').split(/[,،|]/).map(t => t.trim()).filter(Boolean);
          const im = g('imgs').split(/[\s|;,\n]+/).filter(u => /^https?:\/\//i.test(u));
          if (im.length) { o.imgs = im; o.img = im[0]; }
          if (col('top') >= 0) { if (truthy(g('top'))) o.top = true; else delete o.top; }
          if (col('hidden') >= 0) { if (truthy(g('hidden'))) o.hidden = true; else delete o.hidden; }
          if (!cur) { if (hideNew) o.hidden = true; o.imgs ??= []; arr.push(o); byCode.set(it.code, o); made++; } else changed++;
        }
      }, ['products']);
      onDoc(d);
      setMsg(`✔ اتضاف ${made} منتج، واتعدّل ${changed}${secsMade ? `، واتعمل ${secsMade} قسم جديد` : ''}.${hideNew && made ? ' المنتجات الجديدة مخفية — راجعها وأظهرها من «المنتجات ← 🙈 مخفي».' : ''}`);
      setTable(null); setPaste('');
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    setBusy(false);
  }

  return (
    <section className="ad-s">
      <h2>📥 استيراد منتجات من ملف</h2>
      <p className="mut">Excel (xlsx) أو CSV أو JSON — أو انسخ الخلايا من Excel والصقها هنا. أول صف لازم يكون عناوين الأعمدة (كود، اسم، قسم، وصف…). الكود هو اللي بيربط بالسيستم، فلو الكود موجود المنتج بيتحدّث، ولو جديد بيتضاف.</p>
      <div className="ad-acts">
        <button type="button" className="sec" onClick={() => file.current?.click()}>📂 اختار ملف</button>
        <button type="button" className="lnk" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿كود,اسم,قسم,وصف,براند,كلمات بحث,شارة,فيديو,صور\r\n1001,مجرى سفلي 50 سم,المجاري,المقاس: 50 سم,بلوم,مجرى مخفي,جديد,,https://…/1.jpg | https://…/2.jpg'], { type: 'text/csv;charset=utf-8' })); a.download = 'products-template.csv'; a.click(); }}>⬇️ نموذج جاهز</button>
        <input ref={file} type="file" accept=".xlsx,.csv,.tsv,.txt,.json" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {!table && <>
        <textarea rows={4} value={paste} placeholder="…أو الصق هنا الخلايا المنسوخة من Excel" onChange={e => setPaste(e.target.value)} />
        <button type="button" className="sec" disabled={!paste.trim()} onClick={() => load(parseDelimited(paste))}>اقرا اللي لصقته</button>
      </>}
      {table && plan && <>
        <h3 className="ad-sub">ربط الأعمدة <small>(اتخمّن تلقائي — صحّحه لو غلط)</small></h3>
        <div className="ad-map">{table.headers.map((h, i) => (
          <label key={i}><b>{h}</b>
            <select value={map[i]} onChange={e => setMap(m => m.map((x, k) => (k === i ? e.target.value : x)))}>
              <option value="">— تجاهل —</option>{FIELDS.map(f => <option key={f} value={f} disabled={map.includes(f) && map[i] !== f}>{FIELD_LABEL[f]}</option>)}
            </select></label>))}
        </div>
        {(col('code') < 0 || col('name') < 0) && <p className="err">لازم تربط عمود «الكود» وعمود «الاسم» على الأقل.</p>}
        <div className="ad-sum"><b>{plan.n}</b> جديد · <b>{plan.u}</b> هيتحدّث · <b>{plan.b}</b> هيتخطّى</div>
        <div className="ad-tbl"><table><thead><tr><th>#</th><th>الكود</th><th>الاسم</th><th>الحالة</th></tr></thead><tbody>
          {plan.items.slice(0, 40).map(x => <tr key={x.i} className={x.st}><td>{x.i + 1}</td><td dir="ltr">{x.code || '—'}</td><td>{x.name || '—'}</td><td>{x.st === 'new' ? '➕ جديد' : x.st === 'upd' ? '✏️ تحديث' : '⚠️ ' + x.why}</td></tr>)}
        </tbody></table>{plan.items.length > 40 && <small className="mut">…وباقي {plan.items.length - 40} صف.</small>}</div>
        <label className="ad-ck"><input type="checkbox" checked={add} onChange={e => setAdd(e.target.checked)} /> أضف المنتجات الجديدة</label>
        <label className="ad-ck"><input type="checkbox" checked={upd} onChange={e => setUpd(e.target.checked)} /> حدّث المنتجات الموجودة (الحقول المربوطة وغير الفاضية بس)</label>
        <label className="ad-ck"><input type="checkbox" checked={hideNew} onChange={e => setHideNew(e.target.checked)} /> خلّي الجديد مخفي لحد ما أراجعه</label>
        <div className="ad-acts">
          <button type="button" className="pri" disabled={busy || col('code') < 0 || col('name') < 0 || (!plan.n && !plan.u)} onClick={apply}>✔ استورد</button>
          <button type="button" className="lnk" onClick={() => setTable(null)}>إلغاء</button>
        </div>
      </>}
      {msg && <p className={msg.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{msg}</p>}
    </section>
  );
}

/* ───────────── photos in bulk, matched by file name = product code ───────────── */
function BulkPhotos({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  const [files, setFiles] = useState<File[]>([]), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [replace, setReplace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const products: Rec[] = doc.data.products ?? [];
  const match = useMemo(() => {
    const byCode = new Map(products.map(p => [String(p.code ?? '').trim().toLowerCase(), p]));
    const groups = new Map<string, { p: Rec; files: File[] }>(), lost: File[] = [];
    for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      const base = f.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
      const p = byCode.get(base) ?? byCode.get(base.split(/[\s_\-.(]+/)[0]);
      if (!p) { lost.push(f); continue; }
      const g = groups.get(p.id) ?? { p, files: [] }; g.files.push(f); groups.set(p.id, g);
    }
    return { groups: [...groups.values()], lost };
  }, [files, products]);

  async function apply() {
    setBusy(true);
    try {
      const urls = new Map<string, string[]>();
      let done = 0; const total = match.groups.reduce((a, g) => a + g.files.length, 0);
      for (const g of match.groups) {
        const list: string[] = [];
        for (const f of g.files) { setMsg(`⏳ بيرفع ${++done} من ${total}…`); list.push(await sendPhoto(f)); }
        urls.set(g.p.id, list);
      }
      onDoc(await saveDoc(x => {
        for (const p of (x.products ?? []) as Rec[]) {
          const add = urls.get(p.id); if (!add) continue;
          const cur: string[] = replace ? [] : [...(p.imgs ?? (p.img ? [p.img] : []))];
          p.imgs = [...cur, ...add]; p.img = p.imgs[0];
        }
      }, ['products']));
      setMsg(`✔ اترفعت ${total} صورة على ${match.groups.length} منتج.`); setFiles([]);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    setBusy(false);
  }
  return (
    <section className="ad-s">
      <h2>🖼️ رفع صور بالجملة</h2>
      <p className="mut">اختار صور كتير مرة واحدة. اسم كل ملف لازم يبدأ بكود المنتج: <b dir="ltr">1001.jpg</b> أو <b dir="ltr">1001-2.jpg</b> أو <b dir="ltr">1001_front.png</b>، والصور بتتوزع على منتجاتها لوحدها.</p>
      <button type="button" className="sec" onClick={() => input.current?.click()}>📷 اختار الصور</button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { setFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      {!!files.length && <>
        <div className="ad-sum"><b>{match.groups.length}</b> منتج · <b>{files.length - match.lost.length}</b> صورة مطابقة · <b>{match.lost.length}</b> من غير منتج</div>
        <div className="ad-tbl"><table><tbody>
          {match.groups.slice(0, 30).map(g => <tr key={g.p.id}><td dir="ltr">{g.p.code}</td><td>{g.p.name}</td><td>{g.files.length} صورة</td></tr>)}
          {match.lost.slice(0, 15).map(f => <tr key={f.name} className="bad"><td colSpan={3}>⚠️ {f.name} — مفيش منتج بالكود ده</td></tr>)}
        </tbody></table></div>
        <label className="ad-ck"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> استبدل الصور القديمة (بدل ما تتضاف بعدها)</label>
        <div className="ad-acts"><button type="button" className="pri" disabled={busy || !match.groups.length} onClick={apply}>✔ ارفع ووزّع</button><button type="button" className="lnk" onClick={() => setFiles([])}>إلغاء</button></div>
      </>}
      {msg && <p className={msg.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{msg}</p>}
    </section>
  );
}

/* ───────────── restore a backup ───────────── */
const PARTS: [string, string][] = [['products', 'المنتجات'], ['sections', 'الأقسام'], ['works', 'أعمالنا'], ['reviews', 'الآراء'], ['pros', 'الفنيين'], ['settings', 'الإعدادات (الألوان والخشب والنصوص والبنرات والتوصيل)']];
const LISTS = ['products', 'sections', 'works', 'reviews', 'pros'];

function Restore({ doc, onDoc, backup }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void; backup: () => void }) {
  const [data, setData] = useState<Rec | null>(null), [pick, setPick] = useState<Set<string>>(new Set()), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load(f?: File) {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('الملف مش نسخة احتياطية للموقع');
      setData(j); setPick(new Set(PARTS.map(p => p[0]).filter(k => k === 'settings' || Array.isArray(j[k])))); setMsg('');
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
  }
  async function apply() {
    if (!data || !pick.size) return;
    if (!window.confirm('هتستبدل الأجزاء المختارة بالنسخة الاحتياطية. هنزّل لك نسخة من الموقع الحالي الأول للأمان. تكمّل؟')) return;
    backup(); setBusy(true);
    try {
      onDoc(await saveDoc(x => {
        for (const k of Object.keys(data)) {
          if (LISTS.includes(k)) { if (pick.has(k) && Array.isArray(data[k])) x[k] = data[k]; }
          else if (pick.has('settings')) x[k] = data[k];
        }
      }, ['products', 'works', 'reviews', 'pros']));
      setMsg('✔ اتسترجعت النسخة.'); setData(null);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    setBusy(false);
  }
  const has = (k: string) => k === 'settings' || (data && Array.isArray(data[k]));
  return (
    <section className="ad-s">
      <h2>♻️ استرجاع نسخة احتياطية</h2>
      <p className="mut">الموقع الحالي فيه {doc.data.products?.length ?? 0} منتج. اختار ملف النسخة اللي نزّلتها قبل كده من «💾 نسخة احتياطية».</p>
      <div className="ad-acts"><button type="button" className="sec" onClick={backup}>💾 نزّل نسخة من الموقع الحالي</button><button type="button" className="sec" onClick={() => input.current?.click()}>📂 اختار نسخة للاسترجاع</button></div>
      <input ref={input} type="file" accept=".json" hidden onChange={e => { load(e.target.files?.[0]); e.target.value = ''; }} />
      {data && <>
        {PARTS.filter(([k]) => has(k)).map(([k, t]) => <label key={k} className="ad-ck"><input type="checkbox" checked={pick.has(k)} onChange={() => setPick(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })} /> {t}{LISTS.includes(k) && <small> ({(data[k] as unknown[]).length})</small>}</label>)}
        <div className="ad-acts"><button type="button" className="pri" disabled={busy || !pick.size} onClick={apply}>♻️ استرجع المختار</button><button type="button" className="lnk" onClick={() => setData(null)}>إلغاء</button></div>
      </>}
      {msg && <p className={msg.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{msg}</p>}
    </section>
  );
}
