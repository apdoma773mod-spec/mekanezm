'use client';
// الأقسام: مربعات صغيرة (صورة + اسم + عدد المنتجات). دوس على مربع يتفتح للتعديل، دوس تاني يتقفل.
import { useRef, useState } from 'react';
import { Img, move, uid7 } from './ui';

export type Sec = { id: string; name: string; img: string };

export function SectionsTab({ sections, count, onChange, onRemove }: { sections: Sec[]; count: (id: string) => number; onChange: (s: Sec[]) => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState('');
  const ref = useRef<HTMLElement>(null);
  const set = (i: number, v: Partial<Sec>) => onChange(sections.map((x, k) => (k === i ? { ...x, ...v } : x)));
  const add = () => { const id = uid7(); onChange([...sections, { id, name: 'قسم جديد', img: '' }]); setOpen(id); setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); };
  const go = (i: number, d: number) => onChange(move(sections, i, d));
  return (
    <div className="ad-secs">
      <div className="ad-secs-top">
        <span className="mut">{sections.length} قسم · دوس على القسم تعدّله</span>
        <button type="button" className="pri" onClick={add}>＋ قسم جديد</button>
      </div>
      <div className="ad-secs-grid">
        {sections.map((s, i) => {
          const n = count(s.id);
          if (open !== s.id)
            return (
              <button key={s.id} type="button" className="ad-sc" onClick={() => setOpen(s.id)}>
                <span className="no">{i + 1}</span>
                <span className="th">{s.img ? <img src={s.img} alt="" /> : <em>📦</em>}</span>
                <b>{s.name || 'من غير اسم'}</b>
                <small>{n} منتج{!n && ' · مخفي'}</small>
              </button>
            );
          return (
            <section key={s.id} className="ad-sc-open" ref={ref}>
              <button type="button" className="ad-sc-h" onClick={() => setOpen('')} aria-label="اقفل"><span className="no">{i + 1}</span><b>{s.name || 'من غير اسم'}</b><span className="x">✕</span></button>
              <div className="ad-sc-b">
                <label>اسم القسم<input value={s.name} maxLength={50} onChange={e => set(i, { name: e.target.value })} /></label>
                <Img value={s.img} onChange={u => set(i, { img: u })} label="صورة القسم" wide />
                <p className="mut">{n ? `فيه ${n} منتج` : 'مفيهوش منتجات، فمش هيظهر على الموقع'}</p>
                <div className="ad-sc-acts">
                  <button type="button" className="sec" disabled={i === 0} onClick={() => go(i, -1)}>→ قدّمه</button>
                  <button type="button" className="sec" disabled={i === sections.length - 1} onClick={() => go(i, 1)}>أخّره ←</button>
                  {!n && <button type="button" className="lnk" onClick={() => { onRemove(s.id); setOpen(''); }}>🗑️ احذف</button>}
                </div>
                <button type="button" className="pri" onClick={() => setOpen('')}>تمام</button>
              </div>
            </section>
          );
        })}
      </div>
      <p className="mut">القسم اللي فيه منتجات مينفعش يتحذف. بعد ما تخلّص دوس «حفظ ونشر».</p>
    </div>
  );
}
