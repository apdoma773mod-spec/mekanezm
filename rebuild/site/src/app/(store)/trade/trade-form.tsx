'use client';
// Wholesale sign-up with proof → arrives in the system as a website request (place_request, up to 3 photos),
// marked «🧰 طلب حساب جملة — محتاج مراجعة». Nothing is granted automatically: the shop reviews and replies.
import { useEffect, useRef, useState } from 'react';
import { placeRequest, uploadRequestImage } from '@/lib/api';
import { TRADE } from '@/lib/config';
import { shrinkImage } from '@/lib/images';
import { getMe, saveMe } from '@/lib/me';
import { ev } from '@/lib/track';

const KINDS = ['نجار / ورشة', 'تاجر / محل', 'مقاول / شركة', 'مهندس ديكور'];
const PROOFS = [
  ['place', '📷 صور الورشة أو المحل أو شغل بتعمله دلوقتي', true],
  ['paper', '📄 سجل تجاري أو بطاقة ضريبية أو كارت الورشة', true],
  ['invoices', `🧾 اشتريت مننا ${TRADE.minInvoices} فواتير أو أكتر في آخر ${TRADE.months} شهور`, false],
] as const;
type Proof = (typeof PROOFS)[number][0];

export function TradeForm() {
  const [f, setF] = useState({ name: '', phone: '', shop: '', kind: KINDS[0], area: '', buys: '' });
  const [proof, setProof] = useState<Proof>('place');
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { const m = getMe(); setF(x => ({ ...x, name: m.name, phone: m.phone })); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const needPics = PROOFS.find(p => p[0] === proof)![2];

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
    if (f.phone.replace(/\D/g, '').length < 8) return setMsg('اكتب رقم موبايلك');
    if (f.area.trim().length < 2) return setMsg('اكتب المنطقة');
    if (needPics && !pics.length) return setMsg('ضيف صورة واحدة على الأقل للإثبات');
    if (!agree) return setMsg('وافق على الشروط الأول');
    setBusy(true); setMsg('⏳ جاري الإرسال…');
    try {
      const imgs: string[] = [];
      for (const p of pics) imgs.push(await uploadRequestImage(p.blob));
      const note = [
        '🧰 طلب حساب جملة — محتاج مراجعة',
        `النوع: ${f.kind}`, f.shop.trim() && `الاسم التجاري: ${f.shop.trim()}`, `المنطقة: ${f.area.trim()}`,
        f.buys.trim() && `بيشتري غالباً: ${f.buys.trim()}`,
        `الإثبات: ${PROOFS.find(p => p[0] === proof)![1].replace(/^\S+\s/, '')}${imgs.length ? ` (${imgs.length} صور)` : ' — راجع فواتيره برقم الموبايل'}`,
      ].filter(Boolean).join('\n');
      const r = await placeRequest(f.name.trim(), f.phone.trim(), note.slice(0, 1000), imgs);
      if (!r.ok) throw 0;
      saveMe({ name: f.name, phone: f.phone });
      ev('generate_lead', 'Lead', { method: 'trade' });
      setSent(true);
    } catch { setMsg('ماتبعتش — جرّب تاني أو كلّمنا على الواتساب'); setBusy(false); }
  }

  if (sent) return (
    <div className="info-cards" style={{ marginTop: 12 }}><div>
      <h2>✔ وصلنا طلبك وهو تحت المراجعة</h2>
      هنراجع البيانات{needPics ? ' والصور' : ' وفواتيرك'} ونرد عليك على الواتساب خلال {TRADE.reviewDays === 1 ? 'يوم شغل' : `${TRADE.reviewDays} أيام شغل`}. لحد ما الحساب يتفعّل تقدر تطلب عادي بأسعار القطاعي.
    </div></div>
  );
  return (
    <div className="info-cards form" style={{ marginTop: 12 }}>
      <div>
        <h2>سجّل بياناتك</h2>
        <label>اسمك<input value={f.name} onChange={set('name')} maxLength={80} autoComplete="name" /></label>
        <label>رقم الموبايل (واتساب)<input value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
        <label>انت إيه؟<select value={f.kind} onChange={set('kind')}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
        <label>اسم الورشة / المحل (اختياري)<input value={f.shop} onChange={set('shop')} maxLength={80} /></label>
        <label>المنطقة<input value={f.area} onChange={set('area')} maxLength={80} placeholder="مثلاً: فيصل، الجيزة" /></label>
        <label>بتشتري إيه غالباً؟ (اختياري)<input value={f.buys} onChange={set('buys')} maxLength={200} placeholder="مفصلات، مجر، جرارات…" /></label>
      </div>
      <div>
        <h2>🔎 هتثبت إزاي إنك صنايعي أو تاجر؟</h2>
        <p className="mut" style={{ margin: '0 0 8px' }}>اختار واحدة:</p>
        <div className="proofs">{PROOFS.map(([v, t]) => (
          <label key={v} className={proof === v ? 'on' : ''}><input type="radio" name="proof" checked={proof === v} onChange={() => setProof(v)} />{t}</label>
        ))}</div>
        {needPics && <>
          <div className="tpics">
            {pics.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" onClick={() => setPics(x => x.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></span>)}
            {pics.length < 3 && <button type="button" className="tadd" onClick={() => file.current?.click()}>📷<small>ضيف صورة</small></button>}
          </div>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
          <p className="mut" style={{ margin: '6px 0 0', fontSize: 13 }}>لحد ٣ صور. الصور بتشوفها الإدارة بس.</p>
        </>}
      </div>
      <div>
        <h2>📋 الشروط</h2>
        <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.9 }}>
          <li>أسعار الجملة بتتفعّل بعد مراجعة الإثبات، مش أوتوماتيك.</li>
          <li>بنراجع ونرد عليك على الواتساب خلال {TRADE.reviewDays === 1 ? 'يوم شغل' : `${TRADE.reviewDays} أيام شغل`}.</li>
          <li>الحساب بيتراجع كل {TRADE.months} شهور، ولو مفيش مشتريات ممكن يرجع قطاعي.</li>
          <li>أسعار الجملة لصاحب الحساب بس، وبتتأكد على رقم الموبايل المسجّل.</li>
        </ul>
        <label className="agree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> البيانات صحيحة وموافق على الشروط</label>
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>ابعت طلب الحساب</button>
      </div>
    </div>
  );
}
