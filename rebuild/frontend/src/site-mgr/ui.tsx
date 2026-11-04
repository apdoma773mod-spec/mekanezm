'use client';
// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
// Small building blocks shared by the admin screens.
import { useRef, useState } from 'react';
import { uploadImage } from './api';
import { shrinkImage } from './lib/images';

export const uid7 = () => Math.random().toString(36).slice(2, 9);
export const move = <T,>(arr: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

/** Shrink and upload one photo. */
export const sendPhoto = async (f: File) => uploadImage(await shrinkImage(f, 1800, 0.82));

/** One photo (logo, banner, section picture…). */
export function Img({ value, onChange, label, wide }: { value: string; onChange: (u: string) => void; label: string; wide?: boolean }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  async function pick(fl: FileList | null) {
    if (!fl?.[0]) return;
    setBusy(true); setErr('');
    try { onChange(await sendPhoto(fl[0])); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className={'ad-img' + (wide ? ' wide' : '')}>
      <div className="ad-prev">{value ? <img src={value} alt="" /> : <span>مفيش صورة</span>}</div>
      <div className="ad-imgb">
        <b>{label}</b>
        <button type="button" className="sec" disabled={busy} onClick={() => file.current?.click()}>{busy ? '⏳ بيترفع…' : value ? '🔄 غيّر الصورة' : '📷 ارفع صورة'}</button>
        {value && <button type="button" className="lnk" onClick={() => onChange('')}>🗑️ شيل</button>}
        {err && <small className="err">{err}</small>}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/** Many photos: add several at once, reorder, remove. The first one is the cover. */
export function Imgs({ value, onChange }: { value: string[]; onChange: (u: string[]) => void }) {
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  async function pick(fl: FileList | File[] | null) {
    const list = [...(fl ?? [])].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    setErr(''); const added: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(`⏳ بيرفع ${i + 1} من ${list.length}…`);
      try { added.push(await sendPhoto(list[i])); } catch (e) { setErr((e as Error).message); break; }
    }
    if (added.length) onChange([...value, ...added]);
    setBusy('');
  }
  return (
    <div className="ad-imgs" tabIndex={-1} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files); }} onPaste={e => pick(e.clipboardData.files)}>
      <div className="ad-grid">
        {value.map((u, i) => (
          <div key={u + i} className={'ad-th' + (i === 0 ? ' cover' : '')}>
            <img src={u} alt="" />
            {i === 0 && <em>الغلاف</em>}
            <div>
              <button type="button" onClick={() => onChange(move(value, i, -1))} disabled={i === 0} aria-label="قبل">→</button>
              <button type="button" onClick={() => onChange(move(value, i, 1))} disabled={i === value.length - 1} aria-label="بعد">←</button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="شيل">✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="ad-add" disabled={!!busy} onClick={() => file.current?.click()}>{busy || '＋ صور'}</button>
      </div>
      <small className="mut">اسحب الصور هنا أو الصقها (Ctrl+V)، أو <button type="button" className="lnk" onClick={() => { const u = window.prompt('لينك الصورة (https://…)')?.trim(); if (u && /^https?:\/\//i.test(u)) onChange([...value, u]); }}>ضيف بلينك</button></small>
      {err && <small className="err">{err}</small>}
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/** «+ إضافة بنرات»: pick or drop many photos at once; they are added in the order chosen, with progress. */
export function AddMany({ label, onAdd }: { label: string; onAdd: (urls: string[]) => void }) {
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  async function pick(fl: FileList | File[] | null) {
    const list = [...(fl ?? [])].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    setErr(''); let done = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(`⏳ بيرفع ${i + 1} من ${list.length}…`);
      try { onAdd([await sendPhoto(list[i]!)]); done++; } catch (e) { setErr(`وقف عند الصورة ${i + 1} من ${list.length}: ${(e as Error).message}`); break; }
    }
    setBusy(done === list.length ? `✔ اترفع ${done} صورة` : '');
  }
  return (
    <div className="ad-img wide" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void pick(e.dataTransfer.files); }}>
      <div className="ad-imgb">
        <b>{label}</b>
        <button type="button" className="sec" disabled={!!busy} onClick={() => file.current?.click()}>{busy || '📷 اختار صور (تقدر تختار كذا واحدة)'}</button>
        <small className="mut">لو اخترت صور كتير استنى بعد ما تدوس ✓: الآيفون بياخد وقت يجهّزها، وبعدها هتشوف عداد الرفع. الصور بتظهر في القايمة واحدة واحدة، وفي الآخر دوس «حفظ ونشر».</small>
        {err && <small className="err">{err}</small>}
      </div>
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { setBusy('⏳ بيجهّز الصور…'); void pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
