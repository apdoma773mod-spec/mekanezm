'use client';
// «اشترك في الجديد على الواتساب» → a website request marked «📣 اشتراك»; the shop adds the number to its broadcast list.
import { useEffect, useState } from 'react';
import { placeRequest } from '@/lib/api';
import { getMe, saveMe } from '@/lib/me';
import { ev } from '@/lib/track';

const TOPICS = ['منتجات جديدة', 'عروض', 'مطابخ', 'دريسنج روم', 'للنجارين'];

export function Subscribe() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [t, setT] = useState<string[]>(['منتجات جديدة', 'عروض']);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const m = getMe(); setName(m.name); setPhone(m.phone);
    try { if (localStorage.getItem('mk_sub')) setDone(true); } catch { /* */ }
  }, []);
  async function go() {
    if (phone.replace(/\D/g, '').length < 8) return setMsg('اكتب رقم الواتساب');
    setBusy(true); setMsg('⏳…');
    try {
      const r = await placeRequest(name.trim().length >= 2 ? name.trim() : 'مشترك من الموقع', phone.trim(), `📣 اشتراك في جديد الواتساب\nمهتم بـ: ${t.join('، ') || 'كل حاجة'}`, []);
      if (!r.ok) throw 0;
      saveMe({ name, phone });
      try { localStorage.setItem('mk_sub', '1'); } catch { /* */ }
      ev('generate_lead', 'Lead', { method: 'subscribe' });
      setDone(true);
    } catch { setMsg('ماتبعتش — جرّب تاني'); setBusy(false); }
  }
  return (
    <section className="subx" aria-labelledby="sub-h">
      <h2 id="sub-h">📣 اعرف الجديد أول بأول</h2>
      {done ? <p>✔ انت مشترك — هيوصلك الجديد والعروض على الواتساب.</p> : <>
        <p>سيب رقم الواتساب وهنبعتلك المنتجات الجديدة والعروض. من غير إزعاج.</p>
        <div className="chips" role="group" aria-label="مهتم بإيه؟" style={{ flexWrap: 'wrap' }}>{TOPICS.map(x => (
          <button key={x} type="button" className={t.includes(x) ? 'on' : ''} onClick={() => setT(v => v.includes(x) ? v.filter(y => y !== x) : [...v, x])}>{x}</button>
        ))}</div>
        <div className="subf">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك (اختياري)" maxLength={80} autoComplete="name" />
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="01xxxxxxxxx" maxLength={20} autoComplete="tel" />
          <button className="pri" onClick={go} disabled={busy}>اشترك</button>
        </div>
        {msg && <p className="err">{msg}</p>}
      </>}
    </section>
  );
}
