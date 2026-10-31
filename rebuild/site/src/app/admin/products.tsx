'use client';
// Admin → products: search, add, edit (photos, section, description + specs, video, featured, hidden, left/right guidance), delete.
// Products are matched with the system by CODE (stock and orders use it), so the code must be the system's own product code.
import { useMemo, useState } from 'react';
import { saveDoc, type Rec, type SiteDoc } from '@/lib/admin-api';
import { handFromName, kindFromName, HAND_LABEL } from '@/lib/hand';
import { Imgs, uid7 } from './ui';

type P = { id: string; code: string; name: string; desc?: string; sec: string; imgs: string[]; img?: string; top?: boolean; video?: string; hidden?: boolean; dir?: { off?: boolean; hand?: 'R' | 'L'; kind?: 'corner' | 'door' | 'other'; pair?: string; note?: string } };
const SPEC_CHIPS = ['المقاس', 'الخامة', 'اللون', 'النوع', 'القفلة', 'الحمل', 'البراند', 'المنشأ', 'يناسب', 'اتجاه الفتح', 'دليل التركيب'];
const PAGE = 25;
const lite = (s: string) => String(s ?? '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export function ProductsTab({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  const [q, setQ] = useState(''), [sec, setSec] = useState(''), [page, setPage] = useState(1);
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const all: P[] = doc.data.products ?? [];
  const secs: { id: string; name: string }[] = doc.data.sections ?? [];
  const secName = (id: string) => secs.find(s => s.id === id)?.name ?? '—';
  const list = useMemo(() => {
    const w = lite(q).split(/\s+/).filter(Boolean);
    return all.filter(p => (!sec || p.sec === sec) && w.every(x => lite(`${p.name} ${p.code}`).includes(x)));
  }, [all, q, sec]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), pg = Math.min(page, pages);

  if (edit) return <ProductEditor doc={doc} id={edit === 'new' ? null : edit} onDoc={onDoc} onClose={() => setEdit(null)} />;
  return (
    <section className="ad-s">
      <div className="ad-top"><h2>📦 المنتجات ({all.length})</h2><button className="pri" onClick={() => setEdit('new')}>＋ منتج جديد</button></div>
      <div className="ad-filter">
        <input value={q} placeholder="ابحث بالاسم أو الكود…" onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select value={sec} onChange={e => { setSec(e.target.value); setPage(1); }}><option value="">كل الأقسام</option>{secs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {!list.length && <p className="mut">{all.length ? 'مفيش منتج بالاسم ده.' : 'لسه مفيش منتجات — دوس «منتج جديد».'}</p>}
      <div className="ad-list">{list.slice((pg - 1) * PAGE, pg * PAGE).map(p => (
        <button key={p.id} type="button" className="ad-li" onClick={() => setEdit(p.id)}>
          <span className="th">{(p.imgs?.[0] || p.img) ? <img src={p.imgs?.[0] || p.img} alt="" /> : '📷'}</span>
          <span className="tx"><b>{p.name || '(من غير اسم)'}</b><small>كود {p.code || '—'} · {secName(p.sec)}</small></span>
          <span className="bd">{p.top && <i>⭐</i>}{p.hidden && <i>🙈</i>}</span>
        </button>
      ))}</div>
      {pages > 1 && <div className="ad-pg"><button disabled={pg < 2} onClick={() => setPage(pg - 1)}>›</button><span>{pg} / {pages}</span><button disabled={pg >= pages} onClick={() => setPage(pg + 1)}>‹</button></div>}
    </section>
  );
}

type Dir = 'auto' | 'on' | 'off';

function ProductEditor({ doc, id, onDoc, onClose }: { doc: SiteDoc; id: string | null; onDoc: (d: SiteDoc) => void; onClose: () => void }) {
  const all: P[] = doc.data.products ?? [];
  const secs: { id: string; name: string }[] = doc.data.sections ?? [];
  const cur = id ? all.find(p => p.id === id) : undefined;
  const [f, setF] = useState(() => ({
    id: cur?.id ?? uid7(), code: cur?.code ?? '', name: cur?.name ?? '', desc: cur?.desc ?? '', sec: cur?.sec ?? '', imgs: [...(cur?.imgs ?? (cur?.img ? [cur.img] : []))],
    top: !!cur?.top, video: cur?.video ?? '', hidden: !!cur?.hidden,
    dirMode: (cur?.dir?.off ? 'off' : cur?.dir ? 'on' : 'auto') as Dir,
    hand: (cur?.dir?.hand ?? handFromName(cur?.name ?? '') ?? 'R') as 'R' | 'L',
    kind: (cur?.dir?.kind ?? kindFromName(cur?.name ?? '')) as 'corner' | 'door' | 'other',
    pairCode: all.find(x => x.id === cur?.dir?.pair)?.code ?? '', note: cur?.dir?.note ?? '',
  }));
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const pair = f.pairCode.trim() ? all.find(x => x.id !== f.id && x.code === f.pairCode.trim()) : undefined;
  const autoHand = handFromName(f.name);

  async function newSection() {
    const n = window.prompt('اسم القسم الجديد');
    if (!n?.trim()) return;
    const sid = uid7();
    try { const d = await saveDoc(x => { (x.sections ??= []).push({ id: sid, name: n.trim(), img: '' }); }); onDoc(d); set('sec', sid); } catch (e) { setMsg((e as Error).message); }
  }
  async function save() {
    if (!f.name.trim()) return setMsg('اكتب اسم المنتج');
    if (!f.code.trim()) return setMsg('اكتب كود المنتج (نفس كوده في السيستم)');
    if (!f.sec) return setMsg('اختار القسم');
    if (!f.imgs.length && !window.confirm('المنتج من غير صور — تكمّل؟')) return;
    if (f.dirMode === 'on' && f.pairCode.trim() && !pair) return setMsg('كود النسخة التانية مش موجود في المنتجات');
    setBusy(true); setMsg('⏳ جاري الحفظ…');
    try {
      const d = await saveDoc((x: Rec) => {
        const arr: Rec[] = (x.products ??= []);
        const dup = arr.find(y => y.id !== f.id && String(y.code ?? '') === f.code.trim());
        if (dup) throw new Error('الكود ده مستخدم في منتج تاني: ' + dup.name);
        const i = arr.findIndex(y => y.id === f.id);
        const o: Rec = i > -1 ? arr[i] : { id: f.id };
        Object.assign(o, { code: f.code.trim(), name: f.name.trim(), desc: f.desc.split('\n').filter(l => !/^[^:：]{1,30}[:：]\s*$/.test(l.trim())).join('\n').trim(), sec: f.sec, imgs: f.imgs, img: f.imgs[0] ?? '', top: f.top });
        if (f.video.trim()) o.video = f.video.trim(); else delete o.video;
        if (f.hidden) o.hidden = true; else delete o.hidden;
        if (f.dirMode === 'off') o.dir = { off: true };
        else if (f.dirMode === 'on') o.dir = { hand: f.hand, kind: f.kind, ...(pair ? { pair: pair.id } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) };
        else delete o.dir;
        if (i > -1) arr[i] = o; else arr.push(o);
      }, ['products']);
      onDoc(d); onClose();
    } catch (e) { setMsg('✗ ' + (e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!cur || !window.confirm(`تحذف «${cur.name}» من الموقع نهائياً؟\nلو عايز تخفيه بس من غير ما تحذفه، استخدم «مخفي».`)) return;
    setBusy(true);
    try { onDoc(await saveDoc(x => { x.products = (x.products ?? []).filter((y: Rec) => y.id !== f.id); }, ['products'])); onClose(); } catch (e) { setMsg('✗ ' + (e as Error).message); setBusy(false); }
  }

  return (
    <div>
      <div className="ad-top"><button type="button" className="lnk" onClick={onClose}>→ رجوع للمنتجات</button><h2>{cur ? '✏️ تعديل منتج' : '➕ منتج جديد'}</h2></div>
      <section className="ad-s">
        <h3>📝 البيانات الأساسية</h3>
        <label>اسم المنتج على الموقع<input value={f.name} placeholder="مثلاً: مجرى سفلي سوفت كلوز 50 سم" onChange={e => set('name', e.target.value)} /></label>
        <label>كود المنتج <small>(نفس كوده في السيستم — منه بيتحسب المخزون والطلبات)</small><input dir="ltr" value={f.code} disabled={!!cur} onChange={e => set('code', e.target.value)} /></label>
        <label>القسم
          <select value={f.sec} onChange={e => (e.target.value === '__new' ? newSection() : set('sec', e.target.value))}>
            <option value="">— اختار القسم —</option>{secs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="__new">＋ قسم جديد…</option>
          </select>
        </label>
      </section>
      <section className="ad-s"><h3>📷 الصور <small>أول صورة هي اللي بتظهر في الكارت</small></h3><Imgs value={f.imgs} onChange={u => set('imgs', u)} /></section>
      <section className="ad-s">
        <h3>📋 الوصف والمواصفات</h3>
        <p className="mut">اكتب كل مواصفة في سطر: <b dir="ltr">المقاس: 50 سم</b> — بتتحول لجدول في صفحة المنتج وفلاتر المقارنة.</p>
        <textarea rows={9} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder={'سطر أو اتنين عن المنتج.\nالمقاس: 50 سم\nالخامة: ...'} />
        <div className="ad-chips">{SPEC_CHIPS.map(c => <button key={c} type="button" onClick={() => set('desc', (f.desc.trim() ? f.desc.replace(/\s+$/, '') + '\n' : '') + c + ': ')}>＋ {c}</button>)}</div>
      </section>
      <section className="ad-s"><h3>🎬 فيديو <small>اختياري — يوتيوب أو لينك فيديو</small></h3><input dir="ltr" value={f.video} placeholder="https://youtube.com/watch?v=…" onChange={e => set('video', e.target.value)} /></section>
      <section className="ad-s">
        <h3>↔️ اتجاه الفتح (يمين / شمال)</h3>
        <p className="mut">للمنتجات اللي ليها نسخة يمين ونسخة شمال (ماجيك كورنر، فاصوليا…). الموقع بيشرح للعميل إزاي يختار الصح ويوديه للنسخة التانية.</p>
        <div className="ad-seg">{([['auto', 'تلقائي من الاسم'], ['on', 'هحدده بنفسي'], ['off', 'من غير اتجاه']] as const).map(([k, t]) => <button key={k} type="button" className={f.dirMode === k ? 'on' : ''} onClick={() => set('dirMode', k)}>{t}</button>)}</div>
        {f.dirMode === 'auto' && <p className="mut">{autoHand ? `الاسم فيه «${HAND_LABEL[autoHand]}» — هيظهر شرح الاتجاه تلقائياً، والنسخة التانية بتتلقى لوحدها لو اسمها زي ده بالظبط وفيه الاتجاه العكسي.` : 'الاسم مفيهوش «يمين» أو «شمال»، فمفيش شرح اتجاه. اختار «هحدده بنفسي» لو المنتج ليه اتجاه.'}</p>}
        {f.dirMode === 'on' && <>
          <label>اتجاه المنتج ده<span className="ad-seg">{(['R', 'L'] as const).map(h => <button key={h} type="button" className={f.hand === h ? 'on' : ''} onClick={() => set('hand', h)}>{HAND_LABEL[h]}</button>)}</span></label>
          <label>نوعه<span className="ad-seg">{([['corner', 'ماجيك / ركنة'], ['door', 'ضلفة / مفصلة'], ['other', 'تاني']] as const).map(([k, t]) => <button key={k} type="button" className={f.kind === k ? 'on' : ''} onClick={() => set('kind', k)}>{t}</button>)}</span></label>
          <label>كود النسخة التانية <small>(اختياري)</small><input dir="ltr" value={f.pairCode} onChange={e => set('pairCode', e.target.value)} /></label>
          {f.pairCode.trim() && <p className={pair ? 'mut' : 'err'}>{pair ? '✔ ' + pair.name : 'مفيش منتج بالكود ده'}</p>}
          <label>شرح إضافي <small>(اختياري — بيظهر للعميل)</small><textarea rows={3} value={f.note} onChange={e => set('note', e.target.value)} /></label>
        </>}
      </section>
      <section className="ad-s">
        <h3>👁️ الظهور</h3>
        <label className="ad-ck"><input type="checkbox" checked={f.top} onChange={e => set('top', e.target.checked)} /> ⭐ منتج مميز <small>بيظهر في «الأكثر طلباً» في أول الموقع</small></label>
        <label className="ad-ck"><input type="checkbox" checked={f.hidden} onChange={e => set('hidden', e.target.checked)} /> 🙈 مخفي من الموقع <small>مبيظهرش للزباين، ولسه موجود هنا</small></label>
      </section>
      <div className="ad-bar">
        <span className={msg.startsWith('✗') || /اكتب|اختار|مفيش|الكود/.test(msg) ? 'err' : 'mut'} aria-live="polite">{msg}</span>
        {cur && <button type="button" className="lnk" disabled={busy} onClick={remove}>🗑️ حذف</button>}
        <button className="pri" disabled={busy} onClick={save}>💾 {cur ? 'حفظ ونشر' : 'إضافة ونشر'}</button>
      </div>
    </div>
  );
}
