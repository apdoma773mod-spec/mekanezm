'use client';
// «احكيلنا مشكلتك»: the customer says what he needs (fix an old slide, new kitchen, dressing room, a shoe cabinet,
// home maintenance…). It reaches the system as a website request («🙋 محتاج فني», with photos), and the screen then
// suggests reviewed craftsmen for that need and area. The shop does not install; it recommends.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { placeRequest, uploadRequestImage } from '@/lib/api';
import { shrinkImage } from '@/lib/images';
import { getMe, saveMe } from '@/lib/me';
import { NEEDS, matchPros } from '@/lib/pros';
import type { Pro } from '@/lib/schema';
import { ev } from '@/lib/track';
import { ProCard, ProNote } from '../pros/pro-card';

type Lite = Pick<Pro, 'id' | 'name' | 'kind' | 'skills' | 'areas' | 'phone' | 'years'> & { photo: string; imgs: number };

export function HelpForm({ pros }: { pros: Lite[] }) {
  const [need, setNeed] = useState<(typeof NEEDS)[number][0]>('slide-old');
  const [f, setF] = useState({ name: '', phone: '', area: '', text: '' });
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { const m = getMe(); setF(x => ({ ...x, name: m.name, phone: m.phone })); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const cur = NEEDS.find(n => n[0] === need)!;

  async function pick(fs: FileList | null) {
    const list = [...(fs ?? [])].slice(0, 3 - pics.length);
    setMsg('⏳ بنجهّز الصور…');
    const out: { blob: Blob; url: string }[] = [];
    for (const x of list) { try { const b = await shrinkImage(x, 1400); out.push({ blob: b, url: URL.createObjectURL(b) }); } catch { /* skip */ } }
    setPics(p => [...p, ...out]);
    setMsg('');
  }

  async function go() {
    if (f.name.trim().length < 2) return setMsg('اكتب اسمك');
    if (f.phone.replace(/\D/g, '').length < 10) return setMsg('اكتب رقم موبايلك');
    if (f.area.trim().length < 2) return setMsg('اكتب منطقتك');
    if (f.text.trim().length < 5 && !pics.length) return setMsg('احكيلنا المشكلة بكلمتين أو ابعت صورة');
    setBusy(true); setMsg('⏳ جاري الإرسال…');
    try {
      const imgs: string[] = [];
      for (const p of pics) imgs.push(await uploadRequestImage(p.blob));
      const note = ['🙋 محتاج فني / تركيب', `الطلب: ${cur[1].replace(/^\S+\s/, '')}`, `المنطقة: ${f.area.trim()}`, f.text.trim() && `التفاصيل: ${f.text.trim()}`, imgs.length && `(${imgs.length} صور)`].filter(Boolean).join('\n');
      const r = await placeRequest(f.name.trim(), f.phone.trim(), note.slice(0, 1000), imgs);
      if (!r.ok) throw 0;
      saveMe({ name: f.name, phone: f.phone });
      ev('generate_lead', 'Lead', { method: 'help_' + need });
      setSent(true);
    } catch { setMsg('ماتبعتش — جرّب تاني أو كلّمنا على الواتساب'); setBusy(false); }
  }

  if (sent) {
    const full: Pro[] = pros.map(x => ({ ...x, bio: '', link: '', checked: '', imgs: [] }));
    const list = matchPros(full, cur[2], f.area).slice(0, 4);
    const msgText = `${cur[1].replace(/^\S+\s/, '')}${f.area ? ' في ' + f.area.trim() : ''}.`;
    return (
      <div className="info-cards"><div>
        <h2>✔ وصلنا طلبك</h2>
        هنراجعه ونرد عليك على الواتساب. وفي الوقت ده دول ناس مراجَع شغلها تقدر تكلمها لو مستعجل:
        <div style={{ margin: '10px 0' }}><ProNote /></div>
        {list.length ? <div className="pros">{list.map(p => <ProCard key={p.id} p={p} msg={msgText} />)}</div> : <p className="mut">لسه مفيش حد مسجّل للطلب ده، وهنكلمك احنا ونرشّحلك حد.</p>}
        <p style={{ marginBottom: 0 }}><Link href={`/pros`}>شوف كل الفنيين ←</Link></p>
      </div></div>
    );
  }
  return (
    <div className="info-cards form">
      <div>
        <h2>محتاج إيه؟</h2>
        <div className="proofs">{NEEDS.map(([k, t]) => (
          <label key={k} className={need === k ? 'on' : ''}><input type="radio" name="need" checked={need === k} onChange={() => setNeed(k)} />{t}</label>
        ))}</div>
      </div>
      <div>
        <h2>احكيلنا</h2>
        <label>التفاصيل <small>(المقاس، اللي بايظ، اللي عايزه…)</small><textarea rows={4} value={f.text} onChange={set('text')} maxLength={600} placeholder={need === 'slide-old' ? 'مثلاً: مجرة درج الدولاب وقعت، طولها حوالي 45 سم' : ''} /></label>
        <div className="tpics">
          {pics.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" onClick={() => setPics(x => x.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></span>)}
          {pics.length < 3 && <button type="button" className="tadd" onClick={() => file.current?.click()}>📷<small>صورة</small></button>}
        </div>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        <p className="mut" style={{ margin: '6px 0 0', fontSize: 13 }}>صورة للمشكلة أو للمكان بتساعدنا كتير (لحد ٣).</p>
      </div>
      <div>
        <h2>بياناتك</h2>
        <label>اسمك<input value={f.name} onChange={set('name')} maxLength={80} autoComplete="name" /></label>
        <label>رقم الموبايل (واتساب)<input value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
        <label>منطقتك<input value={f.area} onChange={set('area')} maxLength={80} placeholder="مثلاً: فيصل، مدينة نصر" /></label>
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>ابعت طلبي</button>
      </div>
    </div>
  );
}
