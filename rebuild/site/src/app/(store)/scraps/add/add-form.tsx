'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { scrapAdd, uploadRequestImage } from '@/lib/api';
import { shrinkImage } from '@/lib/images';
import { getMe, saveMe } from '@/lib/me';
import { ALU_TYPES, CATS, COMMON_THICK, SHEET_BRANDS, SHEET_MATERIALS, SOLID_SPECIES, type Cat } from '@/lib/scraps';
import { ev } from '@/lib/track';

const num = (v: string) => { const n = Number(String(v).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
export const SCRAP_KEY = 'mk_scraps';
const remember = (id: string, secret: string) => {
  try { const a = JSON.parse(localStorage.getItem(SCRAP_KEY) || '[]'); a.push({ id, secret }); localStorage.setItem(SCRAP_KEY, JSON.stringify(a.slice(-200))); } catch { /* */ }
};
const BLANK = { material: '', brand: '', code: '', color: '', thick: '', len: '', wid: '', qty: '1', note: '' };

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
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { const m = getMe(); setWho(w => ({ ...w, name: m.name, phone: m.phone })); try { setWho(w => ({ ...w, area: localStorage.getItem('mk_scrap_area') || '' })); } catch { /* */ } }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const setW = (k: keyof typeof who) => (e: { target: { value: string } }) => setWho(x => ({ ...x, [k]: e.target.value }));

  async function pick(fs: FileList | null) {
    const list = [...(fs ?? [])].slice(0, 3 - pics.length);
    setMsg('⏳ بنجهّز الصور…');
    const out: { blob: Blob; url: string }[] = [];
    for (const x of list) { try { const b = await shrinkImage(x, 1400); out.push({ blob: b, url: URL.createObjectURL(b) }); } catch { /* skip */ } }
    setPics(p => [...p, ...out]);
    setMsg('');
  }

  async function go() {
    const len = num(f.len), wid = num(f.wid), thick = num(f.thick);
    if (!len) return setMsg('اكتب الطول');
    if (cat !== 'alu' && !wid) return setMsg('اكتب العرض');
    if (cat !== 'alu' && !thick) return setMsg('اختار السمك');
    if (cat === 'sheet' && !f.material) return setMsg('اختار نوع اللوح');
    if (mode === 'price' && !num(price)) return setMsg('اكتب السعر');
    if (who.name.trim().length < 2) return setMsg('اكتب اسمك');
    if (who.phone.replace(/\D/g, '').length < 10) return setMsg('اكتب رقم واتساب صحيح');
    if (who.area.trim().length < 2) return setMsg('اكتب منطقتك');
    setBusy(true); setMsg('⏳ جاري النشر…');
    try {
      const imgs: string[] = [];
      for (const p of pics) imgs.push(await uploadRequestImage(p.blob));
      const r = await scrapAdd({
        category: cat, material: f.material, brand: /غير ذلك/.test(f.brand) ? '' : f.brand.trim(), code: f.code.trim(), color: f.color.trim(),
        thick: thick || undefined, len, wid: cat === 'alu' ? undefined : wid || undefined, qty: Math.max(1, Math.round(num(f.qty) || 1)),
        cond, edge, grain, price_mode: mode, price: mode === 'price' ? num(price) : undefined,
        area: who.area.trim(), name: who.name.trim(), phone: who.phone.trim(), note: f.note.trim(), imgs,
      });
      if (!r.ok || !r.data) throw new Error(r.message);
      remember(r.data.id, r.data.secret);
      saveMe({ name: who.name, phone: who.phone });
      try { localStorage.setItem('mk_scrap_area', who.area); } catch { /* */ }
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
      هتظهر لأي نجار بيدوّر على المقاس ده. لما تتباع افتح <Link href="/scraps/mine">فضلتي</Link> وشيلها.
      <div className="sc-top" style={{ marginTop: 10 }}>
        <button type="button" className="pri" onClick={() => { setDone(0); setF(x => ({ ...BLANK, material: x.material, brand: x.brand })); setPics([]); }}>➕ ضيف حتة تانية</button>
        <Link className="sec" href="/scraps">🔎 دوّر على فضلة</Link>
      </div>
    </div></div>
  );
  return (
    <div className="info-cards form">
      <div>
        <div className="sc-cats">{CATS.map(([k, n]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => { setCat(k); setF(x => ({ ...x, material: '', brand: '', code: '' })); }}>{n}</button>)}</div>
        {cat === 'sheet' && <>
          <label>نوع اللوح<select value={f.material} onChange={set('material')}><option value="">اختار</option>{SHEET_MATERIALS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>الشركة <small>(لو تعرفها)</small><input list="sc-brands2" value={f.brand} onChange={set('brand')} maxLength={40} /></label>
          <datalist id="sc-brands2">{SHEET_BRANDS.map(b => <option key={b} value={b} />)}</datalist>
          <label>كود اللون <small>(مكتوب على اللوح أو الفاتورة)</small><input value={f.code} onChange={set('code')} maxLength={30} /></label>
          <label>اسم اللون <small>(اختياري)</small><input value={f.color} onChange={set('color')} maxLength={40} placeholder="مثلاً: جوزي غامق" /></label>
        </>}
        {cat === 'solid' && <label>نوع الخشب<select value={f.material} onChange={set('material')}><option value="">اختار</option>{SOLID_SPECIES.map(m => <option key={m}>{m}</option>)}</select></label>}
        {cat === 'alu' && <>
          <label>نوع القطاع<select value={f.material} onChange={set('material')}><option value="">اختار</option>{ALU_TYPES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>الكود أو اللون <small>(اختياري)</small><input value={f.code} onChange={set('code')} maxLength={30} /></label>
        </>}
        {cat !== 'alu' && <>
          <b>السمك (مم)</b>
          <div className="chips2">{COMMON_THICK.map(t => <button key={t} type="button" className={'sc-chip' + (f.thick === String(t) ? ' on' : '')} onClick={() => setF(x => ({ ...x, thick: String(t) }))}>{t}</button>)}
            <input className="sc-in" inputMode="decimal" value={COMMON_THICK.map(String).includes(f.thick) ? '' : f.thick} onChange={set('thick')} placeholder="غيره" aria-label="سمك تاني" /></div>
        </>}
        <div className="sc-dims">
          <label>الطول (سم)<input inputMode="decimal" value={f.len} onChange={set('len')} /></label>
          {cat !== 'alu' && <label>العرض (سم)<input inputMode="decimal" value={f.wid} onChange={set('wid')} /></label>}
          <label>العدد<input inputMode="numeric" value={f.qty} onChange={set('qty')} /></label>
        </div>
        <label>الحالة<select value={cond} onChange={e => setCond(e.target.value)}><option value="new">جديدة</option><option value="used">مستعملة</option><option value="scratched">فيها خدش</option></select></label>
        {cat === 'sheet' && <label className="agree"><input type="checkbox" checked={edge} onChange={e => setEdge(e.target.checked)} /> متقفّلة حرف</label>}
        {cat !== 'alu' && <label className="agree"><input type="checkbox" checked={grain} onChange={e => setGrain(e.target.checked)} /> ليها اتجاه عرق (متتلفش)</label>}
      </div>
      <div>
        <h2>السعر والصور</h2>
        <label>تبيعها إزاي؟<select value={mode} onChange={e => setMode(e.target.value)}><option value="ask">نتفق على السعر</option><option value="price">بسعر محدد</option><option value="free">ببلاش</option><option value="swap">بدل</option></select></label>
        {mode === 'price' && <label>السعر (جنيه)<input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></label>}
        <div className="tpics">
          {pics.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" onClick={() => setPics(x => x.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></span>)}
          {pics.length < 3 && <button type="button" className="tadd" onClick={() => file.current?.click()}>📷<small>صورة</small></button>}
        </div>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        <label>ملاحظة <small>(اختياري)</small><textarea rows={2} value={f.note} onChange={set('note')} maxLength={300} placeholder="مثلاً: فيها شرخ صغير في الركن" /></label>
      </div>
      <div>
        <h2>بياناتك</h2>
        <label>الاسم<input value={who.name} onChange={setW('name')} maxLength={80} autoComplete="name" /></label>
        <label>رقم الواتساب<input value={who.phone} onChange={setW('phone')} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="01xxxxxxxxx" /></label>
        <label>المنطقة<input value={who.area} onChange={setW('area')} maxLength={80} placeholder="مثلاً: فيصل، الجيزة" /></label>
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg || 'الرقم بيظهر بس لمن حد يدوس «اطلبها».'}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>انشر الفضلة</button>
      </div>
    </div>
  );
}
