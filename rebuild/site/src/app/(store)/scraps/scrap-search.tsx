'use client';
import { useState } from 'react';
import { ALU_TYPES, CATS, COMMON_THICK, SHEET_BRANDS, SHEET_MATERIALS, SOLID_SPECIES, type Cat, type Hit } from '@/lib/scraps';
import { ev } from '@/lib/track';
import Link from 'next/link';
import { ScrapCard } from './scrap-card';

const num = (v: string) => { const n = Number(String(v).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

export function ScrapSearch() {
  const [cat, setCat] = useState<Cat>('sheet');
  const [f, setF] = useState({ material: '', brand: '', code: '', thick: '', len: '', wid: '' });
  const [rotate, setRotate] = useState(true);
  const [res, setRes] = useState<{ hits: Hit[]; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));

  async function go() {
    const len = num(f.len), wid = num(f.wid), thick = num(f.thick);
    if (!len) return setMsg('اكتب الطول');
    if (cat !== 'alu' && !wid) return setMsg('اكتب العرض');
    if (cat !== 'alu' && !thick) return setMsg('اختار السمك');
    setMsg(''); setBusy(true); setRes(null);
    const q = new URLSearchParams({ category: cat, len: String(len) });
    if (wid && cat !== 'alu') q.set('wid', String(wid));
    if (thick && cat !== 'alu') q.set('thick', String(thick));
    for (const k of ['material', 'brand', 'code'] as const) if (f[k].trim() && !(k === 'brand' && /غير ذلك/.test(f[k]))) q.set(k, f[k].trim());
    if (!rotate) q.set('rotate', '0');
    try {
      const r = await fetch('/api/scraps?' + q);
      if (!r.ok) throw 0;
      setRes(await r.json());
      ev('search', 'Search', { search_term: 'scrap', category: cat });
    } catch { setMsg('البحث مشتغلش — جرّب تاني'); }
    setBusy(false);
  }

  const want = `${f.len}${f.wid ? '×' + f.wid : ''} سم${f.thick ? ' سمك ' + f.thick : ''}`;
  const groups: [number, string][] = [[1, '✔ مناسبة'], [2, '≈ قريبة (أقصر شوية)'], [3, '◐ نفس الخامة بلون تاني']];
  return (
    <section className="info-cards form" aria-label="بحث عن فضلة">
      <div>
        <div className="sc-cats" role="tablist">{CATS.map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={cat === k} className={cat === k ? 'on' : ''} onClick={() => { setCat(k); setRes(null); setMsg(''); setF(x => ({ ...x, material: '', brand: '', code: '' })); }}>{n}</button>)}</div>
        <h2>محتاج إيه؟</h2>
        {cat === 'sheet' && <>
          <label>نوع اللوح <small>(اختياري)</small><select value={f.material} onChange={set('material')}><option value="">أي نوع</option>{SHEET_MATERIALS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>الشركة <small>(اختياري)</small><input list="sc-brands" value={f.brand} onChange={set('brand')} maxLength={40} placeholder="جودوود، توبوود…" /></label>
          <datalist id="sc-brands">{SHEET_BRANDS.map(b => <option key={b} value={b} />)}</datalist>
          <label>كود اللون <small>(لو عايز نفس اللون بالظبط)</small><input value={f.code} onChange={set('code')} maxLength={30} placeholder="مثلاً: 1021" /></label>
        </>}
        {cat === 'solid' && <label>نوع الخشب <small>(اختياري)</small><select value={f.material} onChange={set('material')}><option value="">أي نوع</option>{SOLID_SPECIES.map(m => <option key={m}>{m}</option>)}</select></label>}
        {cat === 'alu' && <>
          <label>نوع القطاع <small>(اختياري)</small><select value={f.material} onChange={set('material')}><option value="">أي نوع</option>{ALU_TYPES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>كود القطاع أو اللون <small>(اختياري)</small><input value={f.code} onChange={set('code')} maxLength={30} /></label>
        </>}
        {cat !== 'alu' && <>
          <b>السمك (مم)</b>
          <div className="chips2">{COMMON_THICK.map(t => <button key={t} type="button" className={'sc-chip' + (f.thick === String(t) ? ' on' : '')} onClick={() => setF(x => ({ ...x, thick: String(t) }))}>{t}</button>)}
            <input className="sc-in" inputMode="decimal" value={COMMON_THICK.map(String).includes(f.thick) ? '' : f.thick} onChange={set('thick')} placeholder="غيره" aria-label="سمك تاني" /></div>
        </>}
        <div className="sc-dims">
          <label>الطول (سم)<input inputMode="decimal" value={f.len} onChange={set('len')} placeholder="70" /></label>
          {cat !== 'alu' && <label>العرض (سم)<input inputMode="decimal" value={f.wid} onChange={set('wid')} placeholder="25" /></label>}
        </div>
        {cat !== 'alu' && <label className="agree"><input type="checkbox" checked={!rotate} onChange={e => setRotate(!e.target.checked)} /> ممنوع تلف الحتة (فيها اتجاه عرق)</label>}
        <p className="err" aria-live="polite">{msg}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>{busy ? '⏳ بندوّر…' : '🔎 دوّر'}</button>
      </div>
      {res && (
        <div>
          {!res.hits.length ? (
            <>
              <h2>مفيش حتة مناسبة دلوقتي</h2>
              <p style={{ margin: 0 }}>{res.total ? `بندوّر في ${res.total} إعلان وماطلعش حاجة بالمقاس ده.` : 'لسه السوق في أوله.'} جرّب مقاس أو لون تاني، أو <Link href="/scraps/add">ضيف اللي عندك</Link> علشان غيرك يلاقيه.</p>
            </>
          ) : groups.map(([lv, title]) => {
            const items = res.hits.filter(h => h.level === lv);
            return items.length ? (
              <div key={lv} style={{ marginBottom: 12 }}>
                <h2>{title} ({items.length})</h2>
                <div className="scraps">{items.map(h => <ScrapCard key={h.s.id} s={h.s} hit={h} want={want} />)}</div>
              </div>
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
