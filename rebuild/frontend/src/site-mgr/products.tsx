'use client';
// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
// Admin → products: search, add, edit (photos, section, description + specs, video, featured, hidden, left/right guidance), delete.
// Products are matched with the system by CODE (stock and orders use it), so the code must be the system's own product code.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { useProductInfo, useProducts, type ProductInfo } from '@/lib/trade-queries';
import { saveDoc, SITE_URL, type Rec, type SiteDoc } from './api';
import { HandDiagram } from './hand-stub';
import { handFromName, kindFromName, normKind, HAND_LABEL, KIND_LABEL, type HandKind } from './lib/hand';
import { Imgs, uid7 } from './ui';

type P = { badge?: string; brand?: string; tags?: string[]; avail?: 'in' | 'out' | 'order'; seoTitle?: string; seoDesc?: string; from?: string; until?: string; id: string; code: string; name: string; desc?: string; sec: string; imgs: string[]; img?: string; top?: boolean; video?: string; hidden?: boolean; dir?: { off?: boolean; hand?: 'R' | 'L'; kind?: string; pair?: string; note?: string; media?: string } };
const SPEC_CHIPS = ['المقاس', 'الخامة', 'اللون', 'النوع', 'القفلة', 'الحمل', 'البراند', 'المنشأ', 'يناسب', 'اتجاه الفتح', 'دليل التركيب'];
const PAGE = 25;
const BADGES = ['جديد', 'الأكثر طلباً', 'عرض خاص', 'كمية محدودة', 'وصل حديثاً', 'ضمان'];
const lite = (s: string) => String(s ?? '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

type View = 'all' | 'top' | 'hidden' | 'noimg' | 'nodesc';
type Sort = 'new' | 'name' | 'code';
const VIEWS: [View, string][] = [['all', 'الكل'], ['top', '⭐ مميز'], ['hidden', '🙈 مخفي'], ['noimg', '📷 من غير صور'], ['nodesc', '📝 من غير وصف']];

export function ProductsTab({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  const [q, setQ] = useState(''), [sec, setSec] = useState(''), [page, setPage] = useState(1);
  const [view, setView] = useState<View>('all'), [sort, setSort] = useState<Sort>('new');
  const [pick, setPick] = useState<Set<string>>(new Set()), [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const [edit, setEdit] = useState<string | 'new' | { sys: ProductDto } | null>(null);
  const all: P[] = doc.data.products ?? [];
  // 📦 the shop's own stock: search it here, so a product that is already set up in the system is picked, not typed again
  const sysQ = useProducts({ q: q.trim(), pageSize: 15 }, q.trim().length >= 1);
  const onSite = useMemo(() => new Set(all.map(p => String(p.code ?? ''))), [all]);
  const sysOnly = (sysQ.data?.items ?? []).filter(x => !onSite.has(String(x.code)));
  const secs: { id: string; name: string }[] = doc.data.sections ?? [];
  const secName = (id: string) => secs.find(s => s.id === id)?.name ?? '—';
  const noImg = (p: P) => !(p.imgs?.length || p.img);
  const counts = useMemo(() => ({ all: all.length, top: all.filter(p => p.top).length, hidden: all.filter(p => p.hidden).length, noimg: all.filter(noImg).length, nodesc: all.filter(p => !p.desc?.trim()).length }), [all]);
  const list = useMemo(() => {
    const w = lite(q).split(/\s+/).filter(Boolean);
    const ok = (p: P) => view === 'all' || (view === 'top' ? p.top : view === 'hidden' ? p.hidden : view === 'noimg' ? noImg(p) : !p.desc?.trim());
    const r = all.filter(p => (!sec || p.sec === sec) && ok(p) && w.every(x => lite(`${p.name} ${p.code}`).includes(x)));
    if (sort === 'name') r.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    else if (sort === 'code') r.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
    else r.reverse(); // newest added first
    return r;
  }, [all, q, sec, view, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), pg = Math.min(page, pages);
  const shown = list.slice((pg - 1) * PAGE, pg * PAGE);
  const toggle = (id: string) => setPick(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownPicked = shown.length > 0 && shown.every(p => pick.has(p.id));

  async function bulk(label: string, fn: (p: Rec) => void) {
    if (!pick.size || busy) return;
    setBusy(true); setNote('⏳ جاري التطبيق…');
    try {
      const ids = new Set(pick);
      onDoc(await saveDoc(x => { for (const p of (x.products ?? []) as Rec[]) if (ids.has(p.id)) fn(p); }));
      setNote(`✔ ${label} (${ids.size} منتج)`); setPick(new Set());
    } catch (e) { setNote('✗ ' + (e as Error).message); }
    setBusy(false);
  }
  const moveTo = (sid: string) => sid && bulk('اتنقلوا لقسم «' + secName(sid) + '»', p => { p.sec = sid; });
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['الكود', 'الاسم', 'القسم', 'مميز', 'مخفي', 'عدد الصور'], ...list.map(p => [p.code, p.name, secName(p.sec), p.top ? 'نعم' : '', p.hidden ? 'نعم' : '', p.imgs?.length ?? (p.img ? 1 : 0)])];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (edit) return <ProductEditor doc={doc} id={edit === 'new' || typeof edit === 'object' ? null : edit} sys={typeof edit === 'object' ? edit.sys : undefined} onDoc={onDoc} onClose={() => setEdit(null)} />;
  return (
    <section className="ad-s">
      <div className="ad-top"><h2>📦 المنتجات ({all.length})</h2><div className="ad-acts"><button type="button" className="lnk" onClick={exportCsv} disabled={!list.length}>⬇️ Excel</button><button className="pri" onClick={() => setEdit('new')}>＋ منتج جديد</button></div></div>
      <div className="ad-chipbar">{VIEWS.map(([k, t]) => <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => { setView(k); setPage(1); }}>{t} <b>{counts[k]}</b></button>)}</div>
      <div className="ad-filter ad-filter3">
        <input value={q} placeholder="ابحث بالاسم أو الكود…" onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select value={sec} onChange={e => { setSec(e.target.value); setPage(1); }}><option value="">كل الأقسام</option>{secs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="ترتيب"><option value="new">الأحدث</option><option value="name">بالاسم</option><option value="code">بالكود</option></select>
      </div>
      {pick.size > 0 && (
        <div className="ad-bulk" role="toolbar" aria-label="إجراءات جماعية">
          <b>{pick.size} مختار</b>
          <button type="button" disabled={busy} onClick={() => bulk('اتخفوا', p => { p.hidden = true; })}>🙈 إخفاء</button>
          <button type="button" disabled={busy} onClick={() => bulk('ظهروا', p => { delete p.hidden; })}>👁️ إظهار</button>
          <button type="button" disabled={busy} onClick={() => bulk('اتميّزوا', p => { p.top = true; })}>⭐ تمييز</button>
          <button type="button" disabled={busy} onClick={() => bulk('اتشال التمييز', p => { delete p.top; })}>☆ إلغاء التمييز</button>
          <select disabled={busy} value="" onChange={e => moveTo(e.target.value)} aria-label="نقل لقسم"><option value="">↪ نقل لقسم…</option>{secs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button type="button" className="lnk" onClick={() => setPick(new Set())}>إلغاء الاختيار</button>
        </div>
      )}
      {note && <p className={note.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{note}</p>}
      {q.trim() && sysOnly.length > 0 && (
        <section className="ad-s" aria-label="من المخزن">
          <h3>📦 من المخزن — لسه مش على الموقع <small>دوس على المنتج تكمّله وتنشره، بياناته وصوره من السيستم بتيجي لوحدها</small></h3>
          <div className="ad-list">{sysOnly.map(x => (
            <div key={x.id}>
              <button type="button" className="ad-li" onClick={() => setEdit({ sys: x })}>
                <span className="th">📦</span>
                <span className="tx"><b>{x.name}</b><small>كود {x.code} · {x.category || 'من غير قسم'} · متاح {x.qty}</small></span>
                <span className="bd"><i title="انشره على الموقع">⬆️</i></span>
              </button>
            </div>
          ))}</div>
        </section>
      )}
      {!list.length && !sysOnly.length && <p className="mut">{all.length ? 'مفيش منتج بالفلتر ده.' : 'لسه مفيش منتجات — دوس «منتج جديد».'}</p>}
      {shown.length > 0 && <label className="ad-ck ad-all"><input type="checkbox" checked={allShownPicked} onChange={() => setPick(s => { const n = new Set(s); shown.forEach(p => (allShownPicked ? n.delete(p.id) : n.add(p.id))); return n; })} /> اختيار كل اللي في الصفحة</label>}
      <div className="ad-list">{shown.map(p => (
        <div key={p.id} className={'ad-row' + (pick.has(p.id) ? ' sel' : '')}>
          <input type="checkbox" checked={pick.has(p.id)} onChange={() => toggle(p.id)} aria-label={'اختيار ' + (p.name || p.code)} />
          <button type="button" className="ad-li" onClick={() => setEdit(p.id)}>
            <span className="th">{(p.imgs?.[0] || p.img) ? <img src={p.imgs?.[0] || p.img} alt="" /> : '📷'}</span>
            <span className="tx"><b>{p.name || '(من غير اسم)'}</b><small>كود {p.code || '—'} · {secName(p.sec)}</small></span>
            <span className="bd">{p.top && <i title="مميز">⭐</i>}{p.hidden && <i title="مخفي">🙈</i>}{noImg(p) && <i title="من غير صور">⚠️</i>}</span>
          </button>
        </div>
      ))}</div>
      {pages > 1 && <div className="ad-pg"><button disabled={pg < 2} onClick={() => setPage(pg - 1)}>›</button><span>{pg} / {pages}</span><button disabled={pg >= pages} onClick={() => setPage(pg + 1)}>‹</button></div>}
    </section>
  );
}

type Dir = 'auto' | 'on' | 'off';

/** What the system's product screen holds (brand, size, finish, specs, description, photos) as the site's description text: «المقاس: …» lines are specs. */
function sysDesc(info: ProductInfo): string {
  const lines = String(info.descr ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const spec = (k: string, v: string) => { if (v.trim() && !lines.some(l => l.startsWith(k + ':'))) lines.push(`${k}: ${v.trim()}`); };
  spec('المقاس', info.size ?? '');
  spec('اللون', info.finish ?? '');
  for (const l of String(info.specs ?? '').split('\n').map(x => x.trim()).filter(Boolean)) if (!lines.includes(l)) lines.push(l);
  return lines.join('\n');
}

function ProductEditor({ doc, id, sys, onDoc, onClose }: { doc: SiteDoc; id: string | null; sys?: ProductDto; onDoc: (d: SiteDoc) => void; onClose: () => void }) {
  const all: P[] = doc.data.products ?? [];
  const secs: { id: string; name: string }[] = doc.data.sections ?? [];
  const cur = id ? all.find(p => p.id === id) : undefined;
  // the system product behind this one (found by code): its photos and data fill whatever the site product still lacks
  const found = useProducts({ q: cur?.code ?? '', pageSize: 5 }, !!cur?.code && !sys);
  const sysProd = sys ?? found.data?.items.find(x => String(x.code) === String(cur?.code));
  const sysInfo = useProductInfo(sysProd?.id ?? null).data;
  const [f, setF] = useState(() => ({
    id: cur?.id ?? uid7(), code: cur?.code ?? sys?.code ?? '', name: cur?.name ?? sys?.name ?? '', desc: cur?.desc ?? '', sec: cur?.sec ?? secs.find(s => s.name === sys?.category)?.id ?? '', imgs: [...(cur?.imgs ?? (cur?.img ? [cur.img] : []))],
    top: !!cur?.top, video: cur?.video ?? '', hidden: !!cur?.hidden,
    badge: cur?.badge ?? '', brand: cur?.brand ?? '', tags: (cur?.tags ?? []).join('، '), avail: (cur?.avail ?? '') as '' | 'in' | 'out' | 'order',
    seoTitle: cur?.seoTitle ?? '', seoDesc: cur?.seoDesc ?? '', from: cur?.from ?? '', until: cur?.until ?? '',
    dirMode: (cur?.dir?.off ? 'off' : cur?.dir ? 'on' : 'auto') as Dir,
    hand: (cur?.dir?.hand ?? handFromName(cur?.name ?? '') ?? 'R') as 'R' | 'L',
    kind: (cur?.dir?.kind ? normKind(cur.dir.kind) : kindFromName(cur?.name ?? '')) as HandKind, media: cur?.dir?.media ?? '',
    pairCode: all.find(x => x.id === cur?.dir?.pair)?.code ?? '', note: cur?.dir?.note ?? '',
  }));
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  // fill from the system once, only what is empty here (never overwrites what was written on the site)
  const filled = useRef('');
  const [pulled, setPulled] = useState('');
  useEffect(() => {
    if (!sysInfo || !sysProd || filled.current === sysProd.id) return;
    filled.current = sysProd.id;
    const got: string[] = [];
    setF(x => {
      const n = { ...x };
      if (!x.imgs.length && sysInfo.imgs?.length) { n.imgs = [...sysInfo.imgs]; got.push(`${sysInfo.imgs.length} صورة`); }
      const d = sysDesc(sysInfo);
      if (!x.desc.trim() && d) { n.desc = d; got.push('الوصف والمواصفات'); }
      if (!x.brand.trim() && sysInfo.brand?.trim()) { n.brand = sysInfo.brand.trim(); got.push('الماركة'); }
      return n;
    });
    setTimeout(() => setPulled(got.length ? '📦 اتسحب من شاشة المنتج في السيستم: ' + got.join('، ') : ''), 0);
  }, [sysInfo, sysProd]);
  /** ⟳ take the system's data again, replacing what is here. */
  function repull() {
    if (!sysInfo) return;
    if (!window.confirm('تستبدل الصور والوصف الحاليين ببيانات السيستم؟')) return;
    setF(x => ({ ...x, imgs: sysInfo.imgs?.length ? [...sysInfo.imgs] : x.imgs, desc: sysDesc(sysInfo) || x.desc, brand: sysInfo.brand?.trim() || x.brand }));
    setPulled('📦 اتسحبت بيانات السيستم من جديد');
  }
  const pair = f.pairCode.trim() ? all.find(x => x.id !== f.id && x.code === f.pairCode.trim()) : undefined;
  const autoHand = handFromName(f.name);
  // what the customer will see: the chosen type, or the one detected from the name
  const pvKind: HandKind = f.dirMode === 'on' ? f.kind : kindFromName(f.name);
  const pvHand = f.dirMode === 'on' ? f.hand : autoHand;

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
        const opt = (k: string, v: string) => { if (v.trim()) o[k] = v.trim(); else delete o[k]; };
        delete o.from; delete o.until; // the date window is gone from the screen: a product is always shown
        opt('badge', f.badge); opt('brand', f.brand); opt('seoTitle', f.seoTitle); opt('seoDesc', f.seoDesc); opt('avail', f.avail);
        const tg = f.tags.split(/[,،\n]/).map(x => x.trim()).filter(Boolean);
        if (tg.length) o.tags = tg; else delete o.tags;
        if (f.dirMode === 'off') o.dir = { off: true };
        else if (f.dirMode === 'on') o.dir = { hand: f.hand, kind: f.kind, ...(pair ? { pair: pair.id } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}), ...(f.media.trim() ? { media: f.media.trim() } : {}) };
        else delete o.dir;
        if (i > -1) arr[i] = o; else arr.push(o);
      }, ['products']);
      onDoc(d); onClose();
    } catch (e) { setMsg('✗ ' + (e as Error).message); setBusy(false); }
  }
  async function duplicate() {
    if (!cur) return;
    const code = window.prompt('كود النسخة الجديدة (لازم يكون كود منتج تاني في السيستم)');
    if (!code?.trim()) return;
    setBusy(true);
    try {
      const nid = uid7();
      onDoc(await saveDoc(x => {
        const arr: Rec[] = (x.products ??= []);
        if (arr.some(y => String(y.code ?? '') === code.trim())) throw new Error('الكود ده مستخدم في منتج تاني');
        const src = arr.find(y => y.id === f.id); if (!src) throw new Error('المنتج مش موجود');
        arr.push({ ...JSON.parse(JSON.stringify(src)), id: nid, code: code.trim(), name: src.name + ' (نسخة)', hidden: true });
      }, ['products']));
      onClose();
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
      {sysProd && (
        <p className="mut" aria-live="polite">
          📦 مربوط بمنتج المخزن «{sysProd.name}» (كود {sysProd.code}).{' '}
          {pulled || (sysInfo ? 'مفيش في شاشة المنتج صور أو بيانات زيادة تتسحب.' : '⏳ بسحب بياناته من السيستم…')}{' '}
          {sysInfo && <button type="button" className="lnk" onClick={repull}>⟳ هات بيانات السيستم تاني</button>}
        </p>
      )}
      <section className="ad-s">
        <h3>📝 البيانات الأساسية</h3>
        <label>اسم المنتج على الموقع<input value={f.name} placeholder="مثلاً: مجرى سفلي سوفت كلوز 50 سم" onChange={e => set('name', e.target.value)} /></label>
        <label>كود المنتج <small>(نفس كوده في السيستم — منه بيتحسب المخزون والطلبات)</small><input dir="ltr" value={f.code} disabled={!!cur || !!sys} onChange={e => set('code', e.target.value)} /></label>
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
        {f.dirMode === 'auto' && <p className="mut">النوع اللي اتعرف من الاسم: <b>{KIND_LABEL[pvKind]}</b>. {autoHand ? `الاسم فيه «${HAND_LABEL[autoHand]}» — هيظهر شرح الاتجاه تلقائياً، والنسخة التانية بتتلقى لوحدها لو اسمها زي ده بالظبط وفيه الاتجاه العكسي.` : 'الاسم مفيهوش «يمين» أو «شمال»، فمفيش شرح اتجاه. اختار «هحدده بنفسي» لو المنتج ليه اتجاه.'}</p>}
        {f.dirMode === 'on' && <>
          <label>اتجاه المنتج ده<span className="ad-seg">{(['R', 'L'] as const).map(h => <button key={h} type="button" className={f.hand === h ? 'on' : ''} onClick={() => set('hand', h)}>{HAND_LABEL[h]}</button>)}</span></label>
          <label>نوعه<span className="ad-seg">{(['bean', 'magic', 'generic', 'door', 'other'] as const).map(k => <button key={k} type="button" className={f.kind === k ? 'on' : ''} onClick={() => set('kind', k)}>{KIND_LABEL[k]}</button>)}</span></label>
          <label>كود النسخة التانية <small>(اختياري)</small><input dir="ltr" value={f.pairCode} onChange={e => set('pairCode', e.target.value)} /></label>
          {f.pairCode.trim() && <p className={pair ? 'mut' : 'err'}>{pair ? '✔ ' + pair.name : 'مفيش منتج بالكود ده'}</p>}
          <label>شرح إضافي <small>(اختياري — بيظهر للعميل)</small><textarea rows={3} value={f.note} onChange={e => set('note', e.target.value)} /></label>
          <label>موشن مخصوص <small>(اختياري — لينك GIF أو صورة أو فيديو قصير بيظهر بدل الموشن الجاهز)</small><input dir="ltr" value={f.media} placeholder="https://…" onChange={e => set('media', e.target.value)} /></label>
        </>}
        {f.dirMode !== 'off' && pvHand && pvKind !== 'other' && !f.media.trim() && <div className="ad-prevbox"><b>معاينة اللي الزبون هيشوفه:</b><HandDiagram hand={pvHand} kind={pvKind} /></div>}
      </section>
      <section className="ad-s">
        <h3>🏷️ شارة وتصنيف</h3>
        <label>شارة على الكارت <small>(اختياري — بتظهر بدل «جديد»)</small><input value={f.badge} maxLength={20} onChange={e => set('badge', e.target.value)} /></label>
        <div className="ad-chips">{BADGES.map(b => <button key={b} type="button" onClick={() => set('badge', b)}>{b}</button>)}{f.badge && <button type="button" onClick={() => set('badge', '')}>✕ من غير شارة</button>}</div>
        <label>البراند <small>(اختياري)</small><input value={f.brand} maxLength={40} onChange={e => set('brand', e.target.value)} /></label>
        <label>كلمات بحث إضافية <small>(بالفاصلة — العميل يلاقي المنتج بيها: مثلاً «بلوم، مجرى مخفي»)</small><input value={f.tags} onChange={e => set('tags', e.target.value)} /></label>
      </section>
      <section className="ad-s">
        <h3>📦 التوفر</h3>
        <label>حالة التوفر<select value={f.avail} onChange={e => set('avail', e.target.value as typeof f.avail)}><option value="">تلقائي (من مخزون السيستم)</option><option value="in">متوفر دايماً</option><option value="out">غير متوفر</option><option value="order">بالحجز</option></select></label>
      </section>
      <section className="ad-s">
        <h3>🔎 ظهور في جوجل</h3>
        <label>عنوان الصفحة <small>(اختياري)</small><input value={f.seoTitle} maxLength={70} onChange={e => set('seoTitle', e.target.value)} /></label>
        <label>وصف جوجل <small>({f.seoDesc.length}/155)</small><textarea rows={2} maxLength={155} value={f.seoDesc} onChange={e => set('seoDesc', e.target.value)} /></label>
      </section>
      <section className="ad-s">
        <h3>👁️ الظهور</h3>
        <label className="ad-ck"><input type="checkbox" checked={f.top} onChange={e => set('top', e.target.checked)} /> ⭐ منتج مميز <small>بيظهر في «الأكثر طلباً» في أول الموقع</small></label>
        <label className="ad-ck"><input type="checkbox" checked={f.hidden} onChange={e => set('hidden', e.target.checked)} /> 🙈 مخفي من الموقع <small>مبيظهرش للزباين، ولسه موجود هنا</small></label>
      </section>
      <div className="ad-bar">
        <span className={msg.startsWith('✗') || /اكتب|اختار|مفيش|الكود/.test(msg) ? 'err' : 'mut'} aria-live="polite">{msg}</span>
        {cur && <a className="lnk" href={SITE_URL + '/p/' + cur.id} target="_blank" rel="noopener">↗ افتحه على الموقع</a>}
        {cur && <button type="button" className="lnk" disabled={busy} onClick={duplicate}>⧉ نسخة منه</button>}
        {cur && <button type="button" className="lnk" disabled={busy} onClick={remove}>🗑️ حذف</button>}
        <button className="pri" disabled={busy} onClick={save}>💾 {cur ? 'حفظ ونشر' : 'إضافة ونشر'}</button>
      </div>
    </div>
  );
}
