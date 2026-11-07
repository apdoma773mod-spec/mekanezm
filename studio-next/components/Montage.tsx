'use client';
import { useState } from 'react';
import { pcmFromFile, fmt } from '@/lib/montage/audio';
import { vad, silenceGaps, CUT_LEVELS, type Span } from '@/lib/montage/vad';

// المرحلة ٣-أ: رفع فيديو ← سحب الصوت ← أماكن الكلام ← السكتات اللي هتتشال. (الذكاء والقوالب والتصدير في المراحل الجاية)
export default function Montage() {
  const [msg, setMsg] = useState(''), [dur, setDur] = useState(0), [sp, setSp] = useState<Span[]>([]), [cut, setCut] = useState(2);
  const gaps = silenceGaps(sp, dur, cut);
  const removed = gaps.reduce((s, g) => s + g[1] - g[0], 0);
  return (
    <div className="p">
      <h2>🎬 مونتاج ذكي</h2>
      <input type="file" accept="video/*" data-testid="file" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const pcm = await pcmFromFile(f, setMsg); setDur(pcm.length / 16000); setSp(vad(pcm)); setMsg(''); } catch (x: any) { setMsg('⚠️ ' + x.message); }
      }} />
      {msg && <p className="mu">{msg}</p>}
      {dur > 0 && <>
        <label>شيل السكتات <select value={cut} onChange={e => setCut(+e.target.value)}>{CUT_LEVELS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <p data-testid="sum">المدة {fmt(dur)} — كلام {sp.length} مقطع — هيتشال {gaps.length} سكتة ({removed.toFixed(1)} ثانية) ← الناتج {fmt(dur - removed)}</p>
      </>}
    </div>
  );
}
