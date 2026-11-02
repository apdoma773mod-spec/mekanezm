'use client';
// Craftsman application → arrives in the system as a website request («🔨 طلب انضمام…», with up to 3 photos).
// Nothing is published automatically: the owner reviews and adds the person in /admin → 🧰 الفنيين.
import { useEffect, useRef, useState } from 'react';
import { placeRequest, uploadRequestImage } from '@/lib/api';
import { PROS } from '@/lib/config';
import { shrinkImage } from '@/lib/images';
import { getMe, saveMe } from '@/lib/me';
import { KINDS, SKILLS } from '@/lib/pros';
import { ev } from '@/lib/track';

export function JoinForm() {
  const [f, setF] = useState({ name: '', phone: '', kind: 'carpenter', years: '', areas: '', link: '', bio: '', refName: '', refPhone: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { const m = getMe(); setF(x => ({ ...x, name: m.name, phone: m.phone })); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));

  async function pick(fs: FileList | null) {
    const list = [...(fs ?? [])].slice(0, 3 - pics.length);
    setMsg('⏳ بنجهّز الصور…');
    const out: { blob: Blob; url: string }[] = [];
    for (const x of list) { try { const b = await shrinkImage(x, 1400); out.push({ blob: b, url: URL.createObjectURL(b) }); } catch { /* skip */ } }
    setPics(p => [...p, ...out]);
    setMsg('');
  }

  async function go() {
    const yrs = Number(f.years.replace(/\D/g, ''));
    if (f.name.trim().length < 2) return setMsg('اكتب اسمك');
    if (f.phone.replace(/\D/g, '').length < 10) return setMsg('اكتب رقم واتساب صحيح');
    if (!skills.length) return setMsg('اختار تخصص واحد على الأقل');
    if (f.areas.trim().length < 2) return setMsg('اكتب المناطق اللي بتشتغل فيها');
    if (!yrs || yrs < PROS.minYears) return setMsg(`الشرط خبرة ${PROS.minYears} سنين على الأقل`);
    if (pics.length < PROS.minPhotos) return setMsg(`ضيف ${PROS.minPhotos} صور لشغلك`);
    if (f.refName.trim().length < 2 || f.refPhone.replace(/\D/g, '').length < 10) return setMsg('اكتب اسم ورقم مرجع نكلمه');
    if (!agree) return setMsg('وافق على الشروط الأول');
    setBusy(true); setMsg('⏳ جاري الإرسال…');
    try {
      const imgs: string[] = [];
      for (const p of pics) imgs.push(await uploadRequestImage(p.blob));
      const note = [
        '🔨 طلب انضمام لقايمة الفنيين — محتاج مراجعة',
        `النوع: ${KINDS[f.kind]} · خبرة ${yrs} سنة`,
        `التخصصات: ${skills.map(s => SKILLS.find(x => x[0] === s)?.[1]).join('، ')}`,
        `المناطق: ${f.areas.trim()}`,
        f.link.trim() && `رابط أعمال: ${f.link.trim()}`,
        f.bio.trim() && `نبذة: ${f.bio.trim()}`,
        `المرجع: ${f.refName.trim()} ${f.refPhone.trim()}`,
      ].filter(Boolean).join('\n');
      const r = await placeRequest(f.name.trim(), f.phone.trim(), note.slice(0, 1000), imgs);
      if (!r.ok) throw 0;
      saveMe({ name: f.name, phone: f.phone });
      ev('generate_lead', 'Lead', { method: 'pro_apply' });
      setSent(true);
    } catch { setMsg('ماتبعتش — جرّب تاني أو كلّمنا على الواتساب'); setBusy(false); }
  }

  if (sent) return (
    <div className="info-cards" style={{ marginTop: 12 }}><div>
      <h2>✔ وصلنا طلبك</h2>
      هنراجع بياناتك ونكلم المرجع ونطلب منك صور أكتر على الواتساب خلال {PROS.reviewDays} أيام شغل. لو الشروط اتحققت هتظهر في القايمة وهنبلغك.
    </div></div>
  );
  return (
    <div className="info-cards form" style={{ marginTop: 12 }}>
      <div>
        <h2>بياناتك</h2>
        <label>الاسم<input value={f.name} onChange={set('name')} maxLength={80} autoComplete="name" /></label>
        <label>رقم الواتساب<input value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
        <label>انت إيه؟<select value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label>سنين الخبرة<input value={f.years} onChange={set('years')} inputMode="numeric" maxLength={2} placeholder={`${PROS.minYears} أو أكتر`} /></label>
        <label>المناطق اللي بتشتغل فيها<input value={f.areas} onChange={set('areas')} maxLength={120} placeholder="مثلاً: فيصل، الهرم، 6 أكتوبر" /></label>
        <b>تخصصك</b>
        <div className="proofs">{SKILLS.map(([k, n]) => (
          <label key={k} className={skills.includes(k) ? 'on' : ''}><input type="checkbox" checked={skills.includes(k)} onChange={() => setSkills(x => x.includes(k) ? x.filter(y => y !== k) : [...x, k])} />{n}</label>
        ))}</div>
      </div>
      <div>
        <h2>📷 شغلك</h2>
        <div className="tpics">
          {pics.map((p, i) => <span key={p.url}><img src={p.url} alt="" /><button type="button" onClick={() => setPics(x => x.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></span>)}
          {pics.length < 3 && <button type="button" className="tadd" onClick={() => file.current?.click()}>📷<small>ضيف صورة</small></button>}
        </div>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
        <p className="mut" style={{ margin: '6px 0 10px', fontSize: 13 }}>{PROS.minPhotos} صور لشغل نفّذته انت (مطبخ، دريسنج، تركيب…).</p>
        <label>رابط صفحتك أو فيديوهات شغلك <small>(اختياري)</small><input value={f.link} onChange={set('link')} type="url" inputMode="url" maxLength={200} placeholder="https://" /></label>
        <label>نبذة عنك <small>(اختياري)</small><textarea rows={3} value={f.bio} onChange={set('bio')} maxLength={300} /></label>
        <h2 style={{ marginTop: 14 }}>👤 مرجع نكلمه</h2>
        <label>اسمه<input value={f.refName} onChange={set('refName')} maxLength={60} placeholder="عميل اشتغلتله أو محل بتعامل معاه" /></label>
        <label>رقمه<input value={f.refPhone} onChange={set('refPhone')} type="tel" inputMode="tel" maxLength={20} /></label>
      </div>
      <div>
        <label className="agree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> البيانات صحيحة وموافق على الشروط والالتزامات فوق</label>
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg}</p>
        <button className="pri" style={{ width: '100%' }} onClick={go} disabled={busy}>ابعت طلب الانضمام</button>
      </div>
    </div>
  );
}
