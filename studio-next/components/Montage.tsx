'use client';
import { useState } from 'react';
import { fmt } from '@/lib/montage/audio';
import { analyze } from '@/lib/montage/ai';
import { silenceGaps, mergeGaps, CUT_LEVELS } from '@/lib/montage/vad';
import { retime, sanitizeCuts, allGaps, type Analysis } from '@/lib/montage/takes';

// المرحلة ٣-ب: رفع فيديو ← فهم الكلام بالذكاء ← الجمل ← السكتات والإعادات اللي هتتشال.
export default function Montage() {
  const [msg, setMsg] = useState(''), [D, setD] = useState<Analysis | null>(null), [cut, setCut] = useState(2), [takes, setTakes] = useState(true), [, tick] = useState(0);
  const gaps = D ? mergeGaps(allGaps(D, silenceGaps(D.vad || [], D.dur || 0, cut, D.seg), takes)) : [];
  const removed = gaps.reduce((s, g) => s + g[1] - g[0], 0);
  const toggle = (i: number) => { if (!D) return; const g = D.seg[i]; g.man = true; g.cut = !g.cut; tick(n => n + 1); };
  return (
    <div className="p">
      <h2>🎬 مونتاج ذكي</h2>
      <input type="file" accept="video/*" data-testid="file" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const d = await analyze(f, setMsg); retime(d); sanitizeCuts(d); setD(d); setMsg(''); }
        catch (x: any) { setMsg(x.message === 'LOGIN' ? '⚠️ لازم تدخل الأول' : '⚠️ ' + x.message); }
      }} />
      {msg && <p className="mu">{msg}</p>}
      {D && <>
        {D.title && <h3>{D.title}</h3>}
        <label>شيل السكتات <select value={cut} onChange={e => setCut(+e.target.value)}>{CUT_LEVELS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label> <input type="checkbox" checked={takes} onChange={e => setTakes(e.target.checked)} /> شيل الإعادات والتهتهة</label>
        <p data-testid="sum">المدة {fmt(D.dur || 0)} — {D.seg.length} جملة — هيتشال {gaps.length} مكان ({removed.toFixed(1)} ثانية) ← الناتج {fmt((D.dur || 0) - removed)}</p>
        <ol data-testid="segs">{D.seg.map((g, i) => <li key={i} onClick={() => toggle(i)} style={{ cursor: 'pointer', opacity: takes && g.cut ? .4 : 1, textDecoration: takes && g.cut ? 'line-through' : 'none' }}>{fmt(g.s)} — {g.t}</li>)}</ol>
      </>}
    </div>
  );
}
