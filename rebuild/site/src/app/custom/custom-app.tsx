'use client';
// تجهيز المنتجات بمقاسك: pick a product, type sizes, see a live drawing with warnings, review, send.
import { useEffect, useState } from 'react';
import { bumpVisit, placeCustomOrder, uploadRequestImage } from '@/lib/api';
import { CUSTOM_TEL, CUSTOM_WA } from '@/lib/config';
import { checkSizes, defaults, DRAW, GUIDE, KIND, num, quick, summary, warnings, type Kind, type Vals } from '@/lib/custom-draw';
import { svgToJpeg } from '@/lib/images';

const wa = (t: string) => `https://wa.me/${CUSTOM_WA}?text=${encodeURIComponent(t)}`;
const STEPS = <div className="stp"><span className="on">١ المقاسات</span><span>٢ بياناتك</span><span>٣ تأكيد</span></div>;

export function CustomApp({ initial }: { initial: Kind | null }) {
  const [k, setK] = useState<Kind | null>(initial);
  const [done, setDone] = useState<{ code: string; sum: string; draw: string; name: string } | null>(null);
  useEffect(() => { bumpVisit('custom'); }, []);
  const pick = (x: Kind | null) => {
    setK(x); setDone(null);
    history.replaceState(null, '', x ? '?k=' + x : location.pathname);
    scrollTo(0, 0);
  };
  return (
    <div className="cx">
      <div className="top"><b>🛠️ تجهيز المنتجات</b><a href="/">← المتجر</a></div>
      <div className="wrap">
        {done ? <Done {...done} again={() => pick(null)} /> : k ? <Form key={k} k={k} back={() => pick(null)} onDone={setDone} /> : <Picker pick={pick} />}
      </div>
    </div>
  );
}

function Picker({ pick }: { pick: (k: Kind) => void }) {
  const go = (k: Kind) => (e: React.MouseEvent) => { e.preventDefault(); pick(k); };
  return (
    <>
      <h1>جهّز منتجك بمقاسك</h1>
      <p className="s">اختار اللي عايز تجهّزه، اكتب المقاسات، وهتشوف رسمة شغلك قبل ما تأكّد.</p>
      <a className="pk" href="?k=steel" onClick={go('steel')}>
        <svg viewBox="0 0 112 90" aria-hidden="true"><rect width="112" height="90" fill="#0f2433" /><rect x="30" y="12" width="26" height="66" fill="#c9a77a" /><path d="M27 40V80H59V44" fill="none" stroke="#6aa5c9" strokeWidth="5" /><rect x="70" y="12" width="32" height="66" fill="#c9a77a" /><rect x="70" y="52" width="32" height="26" fill="#6aa5c9" /></svg>
        <div><b>استانلس حماية الباب</b><span>من الرطوبة والمياه — حدّد سمك وعرض الباب وارتفاع الاستانلس من الوش والضهر</span></div>
      </a>
      <a className="pk" href="?k=bamboo" onClick={go('bamboo')}>
        <svg viewBox="0 0 112 90" aria-hidden="true"><rect width="112" height="90" fill="#0f2433" /><path d="M22 36l22 -14h50l-22 14z" fill="#d8b98a" /><rect x="22" y="36" width="50" height="34" fill="#b58f5c" /><path d="M72 36l22 -14v34l-22 14z" fill="#a98543" /><path d="M47 36l22 -14M60 36l22 -14" stroke="#6b4a1f" strokeWidth="2" /></svg>
        <div><b>درج بامبو</b><span>طبيعي أو صناعي — متقسم أو بدون تقسيم — بمقاس العرض والطول والارتفاع</span></div>
      </a>
      <a className="pk" href="?k=delf" onClick={go('delf')}>
        <svg viewBox="0 0 112 90" aria-hidden="true"><rect width="112" height="90" fill="#0f2433" /><rect x="18" y="10" width="36" height="70" rx="2" fill="#cfd6dc" stroke="#6f7a84" strokeWidth="2" /><rect x="58" y="10" width="36" height="70" rx="2" fill="#cfd6dc" stroke="#6f7a84" strokeWidth="2" /><rect x="47" y="38" width="4" height="16" rx="2" fill="#a8741a" /><rect x="61" y="38" width="4" height="16" rx="2" fill="#a8741a" /><circle cx="24" cy="24" r="3" fill="#12202b" /><circle cx="24" cy="66" r="3" fill="#12202b" /></svg>
        <div><b>دلف الدريسنج روم</b><span>مفصلي أو جرار — مقبض من ناحية أو الاتنين أو بدون — تخريم مفصلات أو فتحة للعجلة</span></div>
      </a>
      <a className="cta l" href="/?track=">📦 تتبّع طلب تجهيز</a>
    </>
  );
}

function Form({ k, back, onDone }: { k: Kind; back: () => void; onDone: (d: { code: string; sum: string; draw: string; name: string }) => void }) {
  const [V, setV] = useState<Vals>(defaults(k));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [review, setReview] = useState(false);
  const [omsg, setOmsg] = useState('');
  const [busy, setBusy] = useState(false);
  const DK = 'mk_cust_' + k;

  useEffect(() => { try { const d = JSON.parse(localStorage.getItem(DK) || 'null'); if (d && typeof d === 'object') setV(v => ({ ...v, ...d })); } catch { /* */ } }, [DK]);
  const set = (key: string, val: string) => setV(v => { const n = { ...v, [key]: val }; try { localStorage.setItem(DK, JSON.stringify(n)); } catch { /* */ } return n; });

  const draw = DRAW[k](V);
  const W = warnings(k, V);

  const fld = (key: string, label: string, ph = '') => {
    const qk = quick(k, key);
    return (
      <div className="f">
        <label htmlFor={'i-' + key}>{label}</label>
        <input id={'i-' + key} value={V[key] ?? ''} inputMode="decimal" placeholder={ph} onChange={e => set(key, e.target.value)} />
        {qk && <div className="qk">{qk.map(x => <button type="button" key={x} onClick={() => set(key, String(x))}>{x}</button>)}</div>}
      </div>
    );
  };
  const chips = (key: string, opts: [string, string][]) => (
    <div className="ch" role="group">{opts.map(([v, t]) => <button type="button" key={v} className={V[key] === v ? 'on' : ''} aria-pressed={V[key] === v} onClick={() => set(key, v)}>{t}</button>)}</div>
  );

  function open() {
    const e = checkSizes(k, V) || (name.trim().length < 2 ? 'اكتب اسمك' : phone.replace(/\D/g, '').length < 8 ? 'اكتب رقم موبايلك عشان نكلّمك' : '');
    setMsg(e);
    if (!e) { setOmsg(''); setReview(true); }
  }
  async function send() {
    setBusy(true); setOmsg('⏳ جاري تجهيز الرسمة…');
    try {
      const blob = await svgToJpeg(draw);
      setOmsg('⏳ جاري رفع الرسمة…');
      const url = await uploadRequestImage(blob);
      setOmsg('⏳ جاري الإرسال…');
      const sum = summary(k, V);
      const r = await placeCustomOrder({ kind: k, name: name.trim(), phone: phone.trim(), spec: { k, ...V, q: Math.max(1, Math.round(num(V.q)) || 1) }, summary: sum, note: note.trim(), img: url });
      if (!r.ok || typeof r.data !== 'string') {
        setOmsg(r.message === 'invalid_phone' ? 'رقم الموبايل مش صحيح' : r.message === 'too_many_requests' ? 'في ضغط دلوقتي، جرّب بعد شوية' : 'ماتبعتش — جرّب تاني أو كلمنا على الواتساب');
        setBusy(false);
        return;
      }
      const ref = r.data.slice(0, 8);
      try { localStorage.setItem('mk_last_order', JSON.stringify({ ref, phone: phone.trim() })); localStorage.removeItem(DK); } catch { /* */ }
      onDone({ code: ref, sum, draw, name: name.trim() });
      scrollTo(0, 0);
    } catch {
      setOmsg('مفيش اتصال أو حصلت مشكلة — جرّب تاني');
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{KIND[k]}</h1>
      <p className="s">اختار المواصفات واكتب المقاسات — الرسمة بتتحدّث قدامك.</p>
      {STEPS}
      <details className="card"><summary>📏 إزاي أقيس؟</summary><p style={{ margin: '8px 0 0', lineHeight: 1.8 }}>{GUIDE[k]}</p></details>
      {k === 'steel' && (
        <div className="card"><h3>🔩 مقاسات قطعة الاستانلس (حماية الباب من الرطوبة والمياه)</h3>
          <div className="g">{fld('t', 'سُمك الباب (سم)', 'مثلاً 4')}{fld('w', 'عرض الباب (سم)', 'مثلاً 80')}{fld('hf', 'ارتفاع الاستانلس من الوش (سم)', 'مثلاً 15')}{fld('hb', 'ارتفاع الاستانلس من الضهر (سم)', 'مثلاً 15')}{fld('q', 'عدد القطع', '1')}</div>
        </div>
      )}
      {k === 'bamboo' && (
        <div className="card"><h3>🎍 درج البامبو</h3>
          <label>نوع البامبو</label>{chips('kind', [['طبيعي', 'طبيعي'], ['صناعي', 'صناعي']])}
          <label style={{ display: 'block', marginTop: 12 }}>التقسيم</label>{chips('split', [['no', 'بدون تقسيم'], ['yes', 'متقسم']])}
          {V.split === 'yes' && <div style={{ marginTop: 10 }}>{fld('dv', 'عدد الفواصل', 'مثلاً 2')}</div>}
          <div className="g" style={{ marginTop: 12 }}>{fld('w', 'العرض (سم)')}{fld('l', 'الطول (سم)')}{fld('h', 'الارتفاع (سم) — هو عمق الدرج')}{fld('q', 'العدد', '1')}</div>
          <div className="hint">المقاس برّه برّه (مقاس الفتحة اللي الدرج هيتركّب فيها).</div>
        </div>
      )}
      {k === 'delf' && (
        <div className="card"><h3>🚪 دلف الدريسنج روم (إطار ألمنيوم وزجاج)</h3>
          <label>نوع الدلفة</label>{chips('type', [['hinged', 'مفصلي'], ['slide', 'جرار']])}
          <div className="g" style={{ marginTop: 12 }}>{fld('w', 'عرض الدلفة (سم)')}{fld('h', 'ارتفاع الدلفة (سم)')}{fld('q', 'عدد الدلف', '1')}</div>
          <label style={{ display: 'block', marginTop: 12 }}>المقبض</label>{chips('handle', [['none', 'بدون مقبض'], ['one', 'مقبض من ناحية'], ['both', 'مقبض من الناحيتين']])}
          {V.handle === 'one' && <div style={{ marginTop: 8 }}><label>ناحية المقبض</label>{chips('hside', [['right', 'يمين'], ['left', 'شمال']])}</div>}
          {V.type === 'hinged' && (
            <div style={{ marginTop: 12 }}><label>تتخرّم الدلفة للمفصلات؟</label>{chips('drill', [['yes', 'أيوه، اخرّموها'], ['no', 'لأ']])}
              {V.drill === 'yes' && <div className="g" style={{ marginTop: 8 }}>{fld('hn', 'عدد المفصلات في الدلفة', '3')}<div className="f"><label>ناحية المفصلات</label>{chips('hinge', [['right', 'يمين'], ['left', 'شمال']])}</div></div>}
            </div>
          )}
          {V.type === 'slide' && (
            <div style={{ marginTop: 12 }}><label>تتخلّع الدلفة لفتحة العجلة؟</label>{chips('wheel', [['yes', 'أيوه'], ['no', 'لأ']])}<div className="hint">العجلة بنبيعها لوحدها وبتتركّب على الصايت.</div></div>
          )}
        </div>
      )}
      <div className="dr">{draw ? <div dangerouslySetInnerHTML={{ __html: draw }} /> : <div className="empty">اكتب المقاسات وهتظهر الرسمة هنا</div>}</div>
      {W.length > 0 && <div className="wn" aria-live="polite">{W.map(w => <div key={w.text}>⚠️ {w.text}{w.hn && <button type="button" onClick={() => set('hn', String(w.hn))}>اعتمد</button>}</div>)}</div>}
      <div className="card"><h3>بياناتك</h3>
        <div className="g">
          <div className="f"><label htmlFor="cn">اسمك</label><input id="cn" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" name="name" /></div>
          <div className="f"><label htmlFor="cp">رقم موبايلك (واتساب)</label><input id="cp" value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" name="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" /></div>
          <div className="f full"><label htmlFor="cnote">ملاحظات (اختياري)</label><textarea id="cnote" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300} /></div>
        </div>
      </div>
      <div className="msg" aria-live="polite">{msg}</div>
      <button className="cta" onClick={open}>راجع الطلب وأكّده</button>
      <button className="cta l" onClick={back}>← اختيار منتج تاني</button>
      <div className="cc"><a target="_blank" rel="noopener" href={wa('السلام عليكم، عندي سؤال عن تجهيز ' + KIND[k])}>💬 عندي سؤال</a><a href={'tel:' + CUSTOM_TEL}>📞 اتصل بنا</a></div>
      {review && (
        <div className="ov" onClick={e => e.target === e.currentTarget && !busy && setReview(false)}>
          <div role="dialog" aria-modal="true" aria-label="راجع طلبك">
            <h3 style={{ margin: '0 0 8px' }}>راجع طلبك</h3>
            <div className="dr" dangerouslySetInnerHTML={{ __html: draw }} />
            <div className="card sum">{summary(k, V)}{'\n\n'}👤 {name.trim()} — {phone.trim()}</div>
            <div className="msg">{omsg}</div>
            <button className="cta" onClick={send} disabled={busy}>✔ تأكيد وإرسال الطلب</button>
            <button className="cta l" onClick={() => setReview(false)} disabled={busy}>تعديل</button>
          </div>
        </div>
      )}
    </>
  );
}

function Done({ code: id, sum, draw, name, again }: { code: string; sum: string; draw: string; name: string; again: () => void }) {
  const save = async () => {
    try {
      const b = await svgToJpeg(draw), f = new File([b], `mekanezm-${id}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'طلب تجهيز ميكانيزم ' + id });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); }
    } catch { /* cancelled */ }
  };
  return (
    <>
      <h1>وصلنا طلبك ✔</h1>
      <p className="s">هنراجع المقاسات ونكلّمك على الواتساب نأكّد السعر وميعاد التجهيز.</p>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ color: '#667', fontSize: 13 }}>رقم طلبك</div>
        <div className="ref">{id}</div>
        <div className="hint">احتفظ بالرقم عشان تتابع مراحل الشغل</div>
        <a className="cta" style={{ marginTop: 10, fontSize: 15 }} href={'/?track=' + encodeURIComponent(id)}>📦 تتبّع طلبك</a>
      </div>
      <div className="dr" dangerouslySetInnerHTML={{ __html: draw }} />
      <div className="card sum">{sum}</div>
      <a className="cta g2" target="_blank" rel="noopener" href={wa(`السلام عليكم، أنا ${name} بعتّ طلب تجهيز من الموقع:\n${sum}`)}>💬 كلّمنا على الواتساب كمان</a>
      <button className="cta l" onClick={save}>⬇️ احفظ الرسمة كصورة</button>
      <button className="cta l" onClick={again}>تجهيز منتج تاني</button>
      <a className="cta l" href="/">← رجوع للمتجر</a>
    </>
  );
}
