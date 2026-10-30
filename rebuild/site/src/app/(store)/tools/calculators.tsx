'use client';
// Quick calculators for carpenters and customers. Each answer links to matching products.
import Link from 'next/link';
import { useState } from 'react';
import { hingesFor } from '@/lib/custom-draw';

const n = (s: string) => Number(String(s).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, '')) || 0;
const S = (q: string) => `/search?q=${encodeURIComponent(q)}`;

function Box({ id, emoji, title, children }: { id: string; emoji: string; title: string; children: React.ReactNode }) {
  return <section className="calc" id={id}><h2>{emoji} {title}</h2>{children}</section>;
}
function Num({ label, v, set, unit = 'سم' }: { label: string; v: string; set: (s: string) => void; unit?: string }) {
  return <label>{label} <small>({unit})</small><input inputMode="decimal" value={v} onChange={e => set(e.target.value)} placeholder="0" /></label>;
}

function Hinges() {
  const [h, setH] = useState('200'), [w, setW] = useState('50');
  const [heavy, setHeavy] = useState(false);
  const H = n(h), W = n(w);
  const base = H ? hingesFor(H) : 0, extra = H && (heavy || W > 60) ? 1 : 0;
  return (
    <Box id="hinges" emoji="🔩" title="كام مفصلة للضلفة؟">
      <div className="cin"><Num label="طول الضلفة" v={h} set={setH} /><Num label="عرض الضلفة" v={w} set={setW} /></div>
      <label className="ck"><input type="checkbox" checked={heavy} onChange={e => setHeavy(e.target.checked)} /> الضلفة تقيلة أو عليها مراية / زجاج</label>
      {H > 0 && <p className="ans"><b>{base + extra}</b> مفصلات للضلفة{extra ? ` (${base} + ١ عشان ${heavy ? 'التقل' : 'العرض'})` : ''}</p>}
      <Link className="more" href={S('مفصله')}>شوف المفصلات</Link>
    </Box>
  );
}

function Slides() {
  const [d, setD] = useState('55');
  const D = n(d);
  const L = D >= 27 ? Math.min(70, Math.floor((D - 2) / 5) * 5) : 0;
  return (
    <Box id="slides" emoji="🗃️" title="طول المجرى المناسب">
      <div className="cin"><Num label="عمق الدولاب من جوه" v={d} set={setD} /></div>
      {D > 0 && (L ? <p className="ans">خد مجرى <b>{L} سم</b><small>أطول مقاس يدخل وفاضل مسافة صغيرة من ورا</small></p> : <p className="ans">العمق صغير — كلّمنا نشوفلك مجرى قصير مخصوص</p>)}
      <Link className="more" href={S('مجر')}>شوف المجر</Link>
    </Box>
  );
}

function DrawerWidth() {
  const [o, setO] = useState('56');
  const O = n(o);
  return (
    <Box id="drawer" emoji="📐" title="عرض الدرج مع مجرى البلي">
      <div className="cin"><Num label="عرض الفتحة من جوه" v={o} set={setO} /></div>
      {O > 0 && <p className="ans">عرض الدرج من بره = <b>{Math.round((O - 2.5) * 10) / 10} سم</b><small>مجرى البلي العادي محتاج حوالي ١.٢٥ سم من كل جنب — اتأكد من المكتوب على المجرى</small></p>}
    </Box>
  );
}

function Sliding() {
  const [w, setW] = useState('240');
  const W = n(w);
  const doors = W <= 0 ? 0 : W <= 180 ? 2 : W <= 270 ? 3 : 4;
  return (
    <Box id="sliding" emoji="🚪" title="دولاب جرار: كام ضلفة وطول المجرى">
      <div className="cin"><Num label="عرض الدولاب من جوه" v={w} set={setW} /></div>
      {W > 0 && <p className="ans">طول المجرى فوق وتحت = <b>{W} سم</b> · عدد الضلف المناسب: <b>{doors}</b><small>عرض الضلفة بيتحسب مع التداخل بين الضلف — ابعتلنا المقاس ونحسبهولك بالظبط</small></p>}
      <Link className="more" href={S('جرار')}>شوف الجرارات</Link>
    </Box>
  );
}

function Corner() {
  const [w, setW] = useState('90'), [d, setD] = useState('55'), [h, setH] = useState('60'), [door, setDoor] = useState('45');
  const fails = [n(w) < 90 && 'عرض الوحدة أقل من ٩٠ سم', n(d) < 50 && 'العمق أقل من ٥٠ سم', n(h) < 54 && 'الارتفاع من جوه أقل من ٥٤ سم', n(door) < 45 && 'الضلفة أقل من ٤٥ سم'].filter(Boolean) as string[];
  return (
    <Box id="corner" emoji="🌀" title="الماجيك كورنر هيدخل في الركنة؟">
      <div className="cin"><Num label="عرض وحدة الركنة" v={w} set={setW} /><Num label="العمق من جوه" v={d} set={setD} /><Num label="الارتفاع من جوه" v={h} set={setH} /><Num label="عرض الضلفة" v={door} set={setDoor} /></div>
      {fails.length ? <p className="ans no">مش هيدخل: {fails.join('، ')}</p> : <p className="ans">✅ المقاسات مناسبة لماجيك كورنر (وحدة ٩٠–١٠٠ سم)</p>}
      <Link className="more" href={S('ماجيك')}>شوف الماجيك كورنر</Link>
    </Box>
  );
}

export function Calculators() {
  return <div className="calcs"><Hinges /><Slides /><DrawerWidth /><Sliding /><Corner /></div>;
}
