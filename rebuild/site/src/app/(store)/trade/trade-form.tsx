'use client';
// Trade sign-up → arrives in the system as a website request (place_request), marked «🧰 تسجيل جملة».
import { useEffect, useState } from 'react';
import { placeRequest } from '@/lib/api';
import { getMe, saveMe } from '@/lib/me';
import { ev } from '@/lib/track';

const KINDS = ['نجار / ورشة', 'تاجر / محل', 'مقاول / شركة', 'مهندس ديكور'];

export function TradeForm() {
  const [f, setF] = useState({ name: '', phone: '', shop: '', kind: KINDS[0], area: '', buys: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { const m = getMe(); setF(x => ({ ...x, name: m.name, phone: m.phone })); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));

  async function go() {
    if (f.name.trim().length < 2) return setMsg('اكتب اسمك');
    if (f.phone.replace(/\D/g, '').length < 8) return setMsg('اكتب رقم موبايلك');
    if (f.area.trim().length < 2) return setMsg('اكتب المنطقة');
    setBusy(true); setMsg('⏳ جاري الإرسال…');
    const note = [`🧰 تسجيل جملة: ${f.kind}`, f.shop.trim() && `الاسم التجاري: ${f.shop.trim()}`, `المنطقة: ${f.area.trim()}`, f.buys.trim() && `بيشتري غالباً: ${f.buys.trim()}`].filter(Boolean).join('\n');
    try {
      const r = await placeRequest(f.name.trim(), f.phone.trim(), note.slice(0, 1000), []);
      if (!r.ok) throw 0;
      saveMe({ name: f.name, phone: f.phone });
      ev('generate_lead', 'Lead', { method: 'trade' });
      setSent(true);
    } catch { setMsg('ماتبعتش — جرّب تاني أو كلّمنا على الواتساب'); setBusy(false); }
  }

  if (sent) return <div className="info-cards" style={{ marginTop: 12 }}><div><h2>✔ وصلنا طلبك</h2>هنكلمك على الواتساب نتفق على الأسعار والطلبات.</div></div>;
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
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>سجّلني</button>
      </div>
    </div>
  );
}
