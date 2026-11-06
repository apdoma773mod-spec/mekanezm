'use client';
// Admin → product → 360° frames. Two ways in: one video of the product turning once (cut into frames here in the browser),
// or the ordered photos themselves. Frames are uploaded like any other product photo.
import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/admin-api';
import { Imgs } from './ui';

const FRAMES = 36;

function grab(v: HTMLVideoElement, t: number, max: number): Promise<Blob> {
  return new Promise((res, rej) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? res(b) : rej(new Error('تعذّر قراءة لقطة من الفيديو'))), 'image/jpeg', 0.82);
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

async function framesFromVideo(f: File, onProgress: (n: number) => void): Promise<string[]> {
  const url = URL.createObjectURL(f);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise<void>((ok, no) => { v.onloadeddata = () => ok(); v.onerror = () => no(new Error('الفيديو ده مش بيتفتح')); });
    if (!isFinite(v.duration) || v.duration < 1) throw new Error('الفيديو قصير جدًا');
    const out: string[] = [];
    for (let k = 0; k < FRAMES; k++) {
      // last frame is skipped on purpose: it equals the first one after a full turn
      out.push(await uploadImage(await grab(v, (v.duration * k) / FRAMES, 1400)));
      onProgress(k + 1);
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export function SpinEditor({ value, onChange }: { value: string[]; onChange: (u: string[]) => void }) {
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const vid = useRef<HTMLInputElement>(null);
  async function pickVideo(fl: FileList | null) {
    const f = fl?.[0];
    if (!f) return;
    setErr(''); setBusy('⏳ بيقطّع الفيديو…');
    try { onChange(await framesFromVideo(f, n => setBusy(`⏳ بيرفع ${n} من ${FRAMES}…`))); } catch (e) { setErr((e as Error).message); }
    setBusy('');
  }
  return (
    <section className="ad-s">
      <h3>🔄 صور 360° <small>اختياري — المنتج بيلف بالصباع في صفحته</small></h3>
      <p className="mut">
        صوّر المنتج وهو بيلف لفة كاملة على قاعدة دوّارة، والموبايل ثابت وخلفية سادة. ارفع <b>فيديو</b> واحد (هيتقطّع لـ{FRAMES} صورة لوحده)،
        أو ارفع الصور بنفسك بالترتيب (من 12 لـ 72 صورة، لفة كاملة). أقل من 8 صور مبتتعرضش.
      </p>
      <div className="ad-chips">
        <button type="button" disabled={!!busy} onClick={() => vid.current?.click()}>🎬 {value.length ? 'غيّر بفيديو جديد' : 'ارفع فيديو اللف'}</button>
        {value.length > 0 && <button type="button" disabled={!!busy} onClick={() => { if (window.confirm('تشيل كل صور الـ360 من المنتج ده؟')) onChange([]); }}>🗑️ شيل الـ360</button>}
      </div>
      {busy && <p className="mut" aria-live="polite">{busy}</p>}
      {err && <small className="err">{err}</small>}
      <input ref={vid} type="file" accept="video/*" hidden onChange={e => { pickVideo(e.target.files); e.target.value = ''; }} />
      <Imgs value={value} onChange={onChange} />
      {value.length > 0 && value.length < 8 && <p className="err">محتاج 8 صور على الأقل عشان اللف يشتغل (دلوقتي {value.length}).</p>}
    </section>
  );
}
