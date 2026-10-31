'use client';
// Admin → works («أعمالنا»), hand-picked reviews, delivery + returns, contact details.
// Same fields and shapes as the system's «🌐 محتوى الموقع» (both write the same site_content document).
import { useState } from 'react';
import { saveDoc, type Rec, type SiteDoc } from '@/lib/admin-api';
import { Imgs, uid7 } from './ui';

type Work = { id: string; title: string; desc?: string; imgs: string[] };
type Rev = { id: string; name: string; area?: string; stars: number; text: string };

function ListEditor<T extends { id: string }>({ title, items, row, blank, form, field, allow, doc, onDoc, check }: {
  title: string; items: T[]; row: (x: T) => React.ReactNode; blank: () => T; form: (x: T, set: (v: Partial<T>) => void) => React.ReactNode;
  field: 'works' | 'reviews'; allow: 'works' | 'reviews'; doc: SiteDoc; onDoc: (d: SiteDoc) => void; check: (x: T) => string;
}) {
  const [cur, setCur] = useState<T | null>(null), [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  void doc;
  async function save() {
    if (!cur) return;
    const bad = check(cur); if (bad) return setMsg(bad);
    setBusy(true); setMsg('⏳ جاري الحفظ…');
    try {
      onDoc(await saveDoc((d: Rec) => {
        const arr: Rec[] = (d[field] ??= []);
        const i = arr.findIndex(y => y.id === cur.id);
        if (i > -1) arr[i] = { ...arr[i], ...cur }; else arr.push(cur);
      }, [allow]));
      setCur(null); setMsg('');
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    setBusy(false);
  }
  async function remove() {
    if (!cur || isNew || !window.confirm('تحذف ده؟')) return;
    setBusy(true);
    try { onDoc(await saveDoc((d: Rec) => { d[field] = (d[field] ?? []).filter((y: Rec) => y.id !== cur.id); }, [allow])); setCur(null); } catch (e) { setMsg('✗ ' + (e as Error).message); }
    setBusy(false);
  }
  if (cur) {
    return (
      <div>
        <div className="ad-top"><button type="button" className="lnk" onClick={() => { setCur(null); setMsg(''); }}>→ رجوع</button><h2>{isNew ? '➕ جديد' : '✏️ تعديل'}</h2></div>
        <section className="ad-s">{form(cur, v => setCur({ ...cur, ...v }))}</section>
        <div className="ad-bar">
          <span className={msg.startsWith('✗') || /اكتب|ضيف/.test(msg) ? 'err' : 'mut'} aria-live="polite">{msg}</span>
          {!isNew && <button type="button" className="lnk" disabled={busy} onClick={remove}>🗑️ حذف</button>}
          <button className="pri" disabled={busy} onClick={save}>💾 حفظ ونشر</button>
        </div>
      </div>
    );
  }
  return (
    <section className="ad-s">
      <div className="ad-top"><h2>{title} ({items.length})</h2><button className="pri" onClick={() => { setCur(blank()); setIsNew(true); }}>＋ جديد</button></div>
      {!items.length && <p className="mut">لسه مفيش حاجة.</p>}
      <div className="ad-list">{items.map(x => <button key={x.id} type="button" className="ad-li" onClick={() => { setCur({ ...x }); setIsNew(false); }}>{row(x)}</button>)}</div>
    </section>
  );
}

export function WorksTab({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  return (
    <ListEditor<Work> title="🏗️ أعمالنا" items={doc.data.works ?? []} field="works" allow="works" doc={doc} onDoc={onDoc}
      blank={() => ({ id: uid7(), title: '', desc: '', imgs: [] })}
      check={w => (w.title.trim().length < 2 ? 'اكتب عنوان الشغلانة' : !w.imgs.length ? 'ضيف صورة واحدة على الأقل' : '')}
      row={w => <><span className="th">{w.imgs?.[0] ? <img src={w.imgs[0]} alt="" /> : '🏗️'}</span><span className="tx"><b>{w.title}</b><small>{w.imgs?.length ?? 0} صور</small></span></>}
      form={(w, set) => <>
        <label>العنوان<input value={w.title} placeholder="مثلاً: مطبخ أكريليك — الشيخ زايد" onChange={e => set({ title: e.target.value })} /></label>
        <label>وصف قصير <small>(اختياري)</small><textarea rows={3} value={w.desc ?? ''} onChange={e => set({ desc: e.target.value })} placeholder={'مثلاً: مفصلات بلوم + مجر سفلي سوفت كلوز\nالمنتجات: 1248, P0339'} /></label>
        <p className="mut">اكتب في سطر <b>المنتجات: كود, كود</b> عشان المنتجات دي تظهر تحت الشغلانة وتظهر في صفحاتها «اتركّب في شغلنا». السطر ده مبيظهرش للزباين.</p>
        <b>الصور <small>(الأولى هي الغلاف)</small></b>
        <Imgs value={w.imgs} onChange={imgs => set({ imgs })} />
      </>} />
  );
}

export function ReviewsTab({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  return (
    <ListEditor<Rev> title="⭐ آراء العملاء" items={doc.data.reviews ?? []} field="reviews" allow="reviews" doc={doc} onDoc={onDoc}
      blank={() => ({ id: uid7(), name: '', area: '', stars: 5, text: '' })}
      check={r => (r.name.trim().length < 2 ? 'اكتب اسم العميل' : r.text.trim().length < 3 ? 'اكتب الرأي' : '')}
      row={r => <><span className="th">{'★'.repeat(r.stars)}</span><span className="tx"><b>{r.name}</b><small>{r.text.slice(0, 60)}</small></span></>}
      form={(r, set) => <>
        <label>اسم العميل<input value={r.name} onChange={e => set({ name: e.target.value })} /></label>
        <label>المنطقة <small>(اختياري)</small><input value={r.area ?? ''} onChange={e => set({ area: e.target.value })} /></label>
        <label>التقييم<select value={r.stars} onChange={e => set({ stars: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
        <label>الرأي<textarea rows={4} value={r.text} onChange={e => set({ text: e.target.value })} /></label>
      </>} />
  );
}

/** Delivery, returns policy and contact details — two small forms, each saved on its own. */
export function ShipTab({ doc, onDoc }: { doc: SiteDoc; onDoc: (d: SiteDoc) => void }) {
  const d = doc.data;
  const [note, setNote] = useState<string>(d.deliveryNote ?? '');
  const [loc, setLoc] = useState({ fee: d.shipLocal?.fee ?? '', days: d.shipLocal?.days ?? '', note: d.shipLocal?.note ?? '' });
  const [gov, setGov] = useState({ fee: d.shipGov?.fee ?? '', days: d.shipGov?.days ?? '', note: d.shipGov?.note ?? '' });
  const [rows, setRows] = useState<{ area: string; fee: string; days: string }[]>((d.delivery ?? []).map((r: Rec) => ({ area: r.area ?? '', fee: String(r.fee ?? ''), days: r.days ?? '' })));
  const [pol, setPol] = useState<string>(d.policy ?? '');
  const P: string[] = Array.isArray(d.phones) ? d.phones : [];
  const [wa, setWa] = useState<string>(d.phone ?? ''), [p1, setP1] = useState(P[0] ?? ''), [p2, setP2] = useState(P[1] ?? '');
  const [hours, setHours] = useState<string>(d.hours ?? ''), [map, setMap] = useState<string>(d.mapUrl ?? ''), [cat, setCat] = useState(d.catalog !== false);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState<Record<string, string>>({});
  const run = async (k: string, edit: (x: Rec) => void) => {
    setBusy(k); setMsg(m => ({ ...m, [k]: '⏳…' }));
    try { onDoc(await saveDoc(edit)); setMsg(m => ({ ...m, [k]: '✔ اتحفظ' })); } catch (e) { setMsg(m => ({ ...m, [k]: '✗ ' + (e as Error).message })); }
    setBusy('');
  };
  return (
    <>
      <section className="ad-s">
        <h2>🚚 التوصيل والاستبدال</h2>
        <label>جملة عن التوصيل <small>(اختياري)</small><input value={note} placeholder="مثلاً: بنوصّل لكل المحافظات خلال 2-4 أيام" onChange={e => setNote(e.target.value)} /></label>
        <h3>🛵 توصيل القاهرة والجيزة</h3>
        <label>المصاريف<input value={loc.fee} onChange={e => setLoc({ ...loc, fee: e.target.value })} placeholder="مثلاً: من 50 لـ 100 ج.م حسب المنطقة" /></label>
        <label>المدة<input value={loc.days} onChange={e => setLoc({ ...loc, days: e.target.value })} placeholder="مثلاً: في نفس اليوم أو تاني يوم" /></label>
        <label>ملاحظة<input value={loc.note} onChange={e => setLoc({ ...loc, note: e.target.value })} /></label>
        <h3>📦 شحن للمحافظات</h3>
        <label>المصاريف<input value={gov.fee} onChange={e => setGov({ ...gov, fee: e.target.value })} /></label>
        <label>المدة<input value={gov.days} onChange={e => setGov({ ...gov, days: e.target.value })} placeholder="مثلاً: من 2 لـ 4 أيام" /></label>
        <label>ملاحظة<input value={gov.note} onChange={e => setGov({ ...gov, note: e.target.value })} /></label>
        <h3>📍 مصاريف حسب المنطقة <small>(اختياري)</small></h3>
        {rows.map((r, i) => (
          <div key={i} className="ad-row3">
            <input placeholder="المنطقة" value={r.area} onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, area: e.target.value } : x)))} />
            <input placeholder="المصاريف" value={r.fee} onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, fee: e.target.value } : x)))} />
            <input placeholder="المدة" value={r.days} onChange={e => setRows(rows.map((x, k) => (k === i ? { ...x, days: e.target.value } : x)))} />
            <button type="button" className="lnk" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label="شيل">✕</button>
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setRows([...rows, { area: '', fee: '', days: '' }])}>＋ منطقة</button>
        <label style={{ marginTop: 12 }}>🔁 سياسة الاستبدال والاسترجاع<textarea rows={4} value={pol} onChange={e => setPol(e.target.value)} placeholder="مثلاً: الاستبدال خلال 14 يوم من الاستلام والمنتج بحالته وبالكرتونة…" /></label>
        <div className="ad-sv"><button className="pri" disabled={!!busy} onClick={() => run('ship', x => {
          x.delivery = rows.map(r => ({ area: r.area.trim(), fee: String(r.fee).trim(), days: r.days.trim() })).filter(r => r.area);
          x.deliveryNote = note; x.policy = pol.trim(); x.shipLocal = loc; x.shipGov = gov;
        })}>💾 حفظ التوصيل</button><span className={msg.ship?.startsWith('✗') ? 'err' : 'mut'}>{msg.ship}</span></div>
      </section>
      <section className="ad-s">
        <h2>📞 التواصل</h2>
        <label>رقم الواتساب الأساسي <small>(اللي عليه الكتالوج)</small><input dir="ltr" value={wa} onChange={e => setWa(e.target.value)} /></label>
        <label>رقم المحل 1<input dir="ltr" value={p1} onChange={e => setP1(e.target.value)} /></label>
        <label>رقم المحل 2<input dir="ltr" value={p2} onChange={e => setP2(e.target.value)} /></label>
        <label>ساعات العمل<input value={hours} onChange={e => setHours(e.target.value)} placeholder="مثلاً: يومياً من 10 الصبح لـ 12 بالليل — الجمعة إجازة" /></label>
        <label>لينك المحل على خرائط جوجل <small>(اختياري)</small><input dir="ltr" value={map} onChange={e => setMap(e.target.value)} placeholder="https://maps.app.goo.gl/…" /></label>
        <label className="ad-ck"><input type="checkbox" checked={cat} onChange={e => setCat(e.target.checked)} /> زرار «📒 شوف كتالوجنا على واتساب» في الموقع</label>
        <div className="ad-sv"><button className="pri" disabled={!!busy} onClick={() => run('contact', x => {
          x.phone = wa.trim() || x.phone; x.phones = [p1.trim(), p2.trim()].filter(Boolean); x.hours = hours.trim(); x.mapUrl = map.trim(); x.catalog = cat;
        })}>💾 حفظ التواصل</button><span className={msg.contact?.startsWith('✗') ? 'err' : 'mut'}>{msg.contact}</span></div>
      </section>
    </>
  );
}
