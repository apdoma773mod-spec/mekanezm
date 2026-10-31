'use client';
// Owner admin for the public site: products, sections, works, reviews, delivery + contact, and the look
// (colors, promo strip, banners, logo, texts, social links). Everything is saved to the same document the system uses.
import { useEffect, useMemo, useState } from 'react';
import { loadDoc, login, logout, publishNow, saveDoc, type Rec, type SiteDoc } from '@/lib/admin-api';
import { ProsTab, ReviewsTab, ShipTab, WorksTab } from './content';
import { ProductsTab } from './products';
import { Img, move, uid7 } from './ui';

type Sec = { id: string; name: string; img: string };
type Form = {
  promo: string; name: string; tagline: string; logo: string; hero: string;
  slides: string[]; trust: string[]; socials: Record<'fb' | 'ig' | 'tt' | 'yt', string>;
  theme: Record<'accent' | 'bg' | 'fg' | 'card', string>; sections: Sec[]; removed: string[];
};
const THEME_DEFAULT = { accent: '#3cba2c', bg: '#f3f4f6', fg: '#14201a', card: '#ffffff' } as const;
const THEME_LABEL = { accent: 'لون الأزرار والتمييز', bg: 'لون خلفية الصفحة', fg: 'لون الكلام', card: 'لون الكروت' } as const;
const PRESETS: [string, string][] = [['أخضر', '#3cba2c'], ['ذهبي', '#b8862b'], ['أزرق', '#1e6fd9'], ['تركواز', '#0f9d9a'], ['أحمر', '#d6342c'], ['بنفسجي', '#7c3aed'], ['أسود', '#222222']];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h);
const lum = (h: string) => { const v = full(h).slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };

const fromDoc = (d: Rec): Form => ({
  promo: String(d.promo ?? ''), name: String(d.name ?? ''), tagline: String(d.tagline ?? ''), logo: String(d.logo ?? ''), hero: String(d.hero ?? ''),
  slides: Array.isArray(d.slides) ? d.slides.filter((x: unknown) => typeof x === 'string') : [],
  trust: Array.isArray(d.trust) ? d.trust.filter((x: unknown) => typeof x === 'string') : [],
  socials: { fb: d.socials?.fb ?? '', ig: d.socials?.ig ?? '', tt: d.socials?.tt ?? '', yt: d.socials?.yt ?? '' },
  theme: { accent: d.theme?.accent ?? '', bg: d.theme?.bg ?? '', fg: d.theme?.fg ?? '', card: d.theme?.card ?? '' },
  sections: Array.isArray(d.sections) ? d.sections.map((s: Sec) => ({ id: s.id, name: String(s.name ?? ''), img: String(s.img ?? '') })) : [], removed: [],
});

/** Apply only the fields this screen owns onto the newest copy of the document. */
function applyForm(d: Rec, f: Form) {
  d.promo = f.promo.trim(); d.name = f.name.trim(); d.tagline = f.tagline.trim(); d.logo = f.logo; d.hero = f.hero;
  d.slides = f.slides; d.trust = f.trust.map(x => x.trim()).filter(Boolean);
  d.socials = { ...(d.socials ?? {}), ...Object.fromEntries(Object.entries(f.socials).map(([k, v]) => [k, v.trim()])) };
  const th: Rec = { ...(d.theme ?? {}) };
  for (const k of Object.keys(THEME_DEFAULT) as (keyof Form['theme'])[]) { if (HEX.test(f.theme[k])) th[k] = f.theme[k]; else delete th[k]; }
  d.theme = th;
  // sections: new ones are added, renamed/re-ordered ones updated, deleted ones removed (never one that still has products)
  const cur: Sec[] = Array.isArray(d.sections) ? d.sections : [];
  const used = new Set((d.products ?? []).map((p: Rec) => p.sec));
  const by = new Map(cur.map(s => [s.id, s]));
  const ordered = f.sections.map(s => ({ ...(by.get(s.id) ?? {}), id: s.id, name: s.name.trim() || by.get(s.id)?.name || 'قسم', img: s.img }));
  const rest = cur.filter(s => !f.sections.some(x => x.id === s.id) && !(f.removed.includes(s.id) && !used.has(s.id)));
  d.sections = [...ordered, ...rest];
}

function Color({ k, v, set }: { k: keyof Form['theme']; v: string; set: (s: string) => void }) {
  const eff = HEX.test(v) ? full(v) : THEME_DEFAULT[k];
  return (
    <div className="ad-color">
      <label>{THEME_LABEL[k]}</label>
      <div>
        <input type="color" value={eff} onChange={e => set(e.target.value)} aria-label={THEME_LABEL[k]} />
        <input dir="ltr" value={v} placeholder={THEME_DEFAULT[k]} onChange={e => set(e.target.value.trim())} maxLength={7} />
        {v && <button type="button" className="lnk" onClick={() => set('')}>الافتراضي</button>}
      </div>
      {k === 'accent' && HEX.test(v) && lum(v) > 0.55 && <small className="err">اللون فاتح — الكلام الأبيض على الأزرار هيبقى صعب القراءة.</small>}
    </div>
  );
}

type Tab = 'products' | 'sections' | 'works' | 'look' | 'banner' | 'text' | 'reviews' | 'pros' | 'ship' | 'more';
const GLOBAL: Tab[] = ['look', 'banner', 'text', 'sections']; // these share the bottom «حفظ ونشر» bar; the others save inside their own screen

export function AdminApp() {
  const [stage, setStage] = useState<'login' | 'load' | 'edit'>('login');
  const [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<SiteDoc | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [snap, setSnap] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [saved, setSaved] = useState('');

  const dirty = useMemo(() => !!f && JSON.stringify(f) !== snap, [f, snap]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  /** A screen saved something: keep the newest document, refresh the look form if it has no unsaved changes, and publish. */
  const onDoc = (d: SiteDoc) => {
    setDoc(d);
    if (!dirty) { const form = fromDoc(d.data); setF(form); setSnap(JSON.stringify(form)); }
    setSaved('✔ اتحفظ ونزل على الموقع'); publishNow();
  };

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !pw) return setMsg('اكتب الإيميل وكلمة السر');
    setBusy(true); setMsg('جاري الدخول…');
    try {
      await login(email.trim(), pw); setPw(''); setStage('load');
      const d = await loadDoc(); const form = fromDoc(d.data);
      setDoc(d); setF(form); setSnap(JSON.stringify(form)); setStage('edit'); setMsg('');
    } catch (err) {
      const m = (err as Error).message;
      setMsg(/invalid|credentials/i.test(m) ? 'الإيميل أو كلمة السر غلط' : m); setStage('login');
    }
    setBusy(false);
  }
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => (x ? { ...x, [k]: v } : x));

  async function save() {
    if (!f) return;
    setBusy(true); setSaved('⏳ جاري الحفظ…');
    try {
      const d = await saveDoc(x => applyForm(x, f));
      setDoc(d); const form = fromDoc(d.data); setF(form); setSnap(JSON.stringify(form));
      setSaved('✔ اتحفظ — بيظهر على الموقع حالاً'); publishNow();
    } catch (err) { setSaved('✗ ' + (err as Error).message); }
    setBusy(false);
  }
  function backup() {
    if (!doc) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc.data)], { type: 'application/json' }));
    a.download = 'site-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  if (stage !== 'edit' || !f || !doc) {
    return (
      <form className="ad-login" onSubmit={enter}>
        <h1>🔐 إدارة الموقع</h1>
        <p>ادخل بنفس إيميل وكلمة سر سيستم ميكانيزم.</p>
        <label>الإيميل<input type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>كلمة السر<input type="password" name="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
        <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg}</p>
        <button className="pri" disabled={busy || stage === 'load'}>{stage === 'load' ? 'بيحمّل…' : 'دخول'}</button>
      </form>
    );
  }

  const TABS: [Tab, string][] = [['products', '📦 المنتجات'], ['sections', '🗂️ الأقسام'], ['works', '🏗️ أعمالنا'], ['look', '🎨 الألوان والشريط'], ['banner', '🖼️ البنرات'], ['text', '📝 النصوص'], ['reviews', '⭐ الآراء'], ['pros', '🧰 الفنيين'], ['ship', '🚚 التوصيل والتواصل'], ['more', '⚙️ أدوات']];
  const count = (id: string) => (doc.data.products ?? []).filter((p: Rec) => p.sec === id).length;
  return (
    <div className="ad">
      <header className="ad-h">
        <h1>⚙️ إدارة الموقع</h1>
        <div><a href="/" target="_blank" rel="noopener">↗ افتح الموقع</a><button type="button" className="lnk" onClick={() => { logout(); location.reload(); }}>خروج</button></div>
      </header>
      <nav className="ad-tabs" aria-label="الأقسام">{TABS.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSaved(''); }}>{t}</button>)}</nav>

      {tab === 'products' && <ProductsTab doc={doc} onDoc={onDoc} />}
      {tab === 'works' && <WorksTab doc={doc} onDoc={onDoc} />}
      {tab === 'pros' && <ProsTab doc={doc} onDoc={onDoc} />}
      {tab === 'reviews' && <ReviewsTab doc={doc} onDoc={onDoc} />}
      {tab === 'ship' && <ShipTab key={doc.version} doc={doc} onDoc={onDoc} />}

      {tab === 'look' && <>
        <section className="ad-s">
          <h2>🎨 الألوان</h2>
          <div className="ad-presets">{PRESETS.map(([n, c]) => <button key={c} type="button" style={{ background: c }} className={f.theme.accent.toLowerCase() === c ? 'on' : ''} onClick={() => up('theme', { ...f.theme, accent: c })}>{n}</button>)}</div>
          {(Object.keys(THEME_DEFAULT) as (keyof Form['theme'])[]).map(k => <Color key={k} k={k} v={f.theme[k]} set={s => up('theme', { ...f.theme, [k]: s })} />)}
          <div className="ad-sw" style={{ background: HEX.test(f.theme.bg) ? f.theme.bg : THEME_DEFAULT.bg, color: HEX.test(f.theme.fg) ? f.theme.fg : THEME_DEFAULT.fg }}>
            <div style={{ background: HEX.test(f.theme.card) ? f.theme.card : THEME_DEFAULT.card }}><b>معاينة</b><span>كارت منتج</span><i style={{ background: HEX.test(f.theme.accent) ? f.theme.accent : THEME_DEFAULT.accent }}>🛒 أضف للطلب</i></div>
          </div>
        </section>
        <section className="ad-s">
          <h2>📣 الشريط المتحرك</h2>
          <label>الكلام اللي بيمشي <small>(سيبه فاضي لو مش عايز شريط)</small>
            <textarea rows={2} maxLength={200} value={f.promo} onChange={e => up('promo', e.target.value)} placeholder="مثلاً: اطلب الآن على الواتساب • توصيل لكل المحافظات" />
          </label>
          <div className="ad-tk" style={{ background: HEX.test(f.theme.accent) ? f.theme.accent : THEME_DEFAULT.accent }}>{f.promo || 'معاينة الشريط'}</div>
          <small className="mut">الشريط بيمشي من الشمال لليمين، فأول الجملة هو اللي بيدخل الأول.</small>
        </section>
      </>}

      {tab === 'banner' && <>
        <section className="ad-s">
          <h2>🖼️ بنرات الصفحة الرئيسية</h2>
          <p className="mut">الصور اللي بتتقلّب فوق في الرئيسية. لو مفيش صور، الموقع بيستخدم الصورة الرئيسية وصور المنتجات.</p>
          {f.slides.map((u, i) => (
            <div key={u + i} className="ad-row">
              <Img value={u} onChange={nu => up('slides', nu ? f.slides.map((x, k) => (k === i ? nu : x)) : f.slides.filter((_, k) => k !== i))} label={`بنر ${i + 1}`} wide />
              <div className="ad-mv"><button type="button" onClick={() => up('slides', move(f.slides, i, -1))} disabled={i === 0} aria-label="فوق">↑</button><button type="button" onClick={() => up('slides', move(f.slides, i, 1))} disabled={i === f.slides.length - 1} aria-label="تحت">↓</button></div>
            </div>
          ))}
          <Img value="" onChange={u => u && up('slides', [...f.slides, u])} label="+ إضافة بنر جديد" wide />
        </section>
        <section className="ad-s">
          <h2>🏷️ اللوجو والصورة الرئيسية</h2>
          <Img value={f.logo} onChange={u => up('logo', u)} label="لوجو الهيدر (صورة عريضة)" wide />
          <Img value={f.hero} onChange={u => up('hero', u)} label="الصورة الرئيسية (صفحة «مين إحنا»)" wide />
        </section>
      </>}

      {tab === 'text' && <>
        <section className="ad-s">
          <h2>📝 اسم الموقع</h2>
          <label>الاسم<input value={f.name} maxLength={60} onChange={e => up('name', e.target.value)} /></label>
          <label>الجملة التعريفية<input value={f.tagline} maxLength={120} onChange={e => up('tagline', e.target.value)} /></label>
        </section>
        <section className="ad-s">
          <h2>✅ نقط الثقة</h2>
          <p className="mut">جمل قصيرة بتظهر في الرئيسية (مثلاً: «توصيل لكل المحافظات»).</p>
          {f.trust.map((t, i) => <div key={i} className="ad-line"><input value={t} maxLength={60} onChange={e => up('trust', f.trust.map((x, k) => (k === i ? e.target.value : x)))} /><button type="button" className="lnk" onClick={() => up('trust', f.trust.filter((_, k) => k !== i))} aria-label="شيل">🗑️</button></div>)}
          {f.trust.length < 8 && <button type="button" className="sec" onClick={() => up('trust', [...f.trust, ''])}>+ نقطة جديدة</button>}
        </section>
        <section className="ad-s">
          <h2>🔗 السوشيال ميديا</h2>
          {([['fb', 'فيسبوك'], ['ig', 'إنستجرام'], ['tt', 'تيك توك'], ['yt', 'يوتيوب']] as const).map(([k, t]) => (
            <label key={k}>{t}<input dir="ltr" inputMode="url" placeholder="https://…" value={f.socials[k]} onChange={e => up('socials', { ...f.socials, [k]: e.target.value })} />
              {f.socials[k] && !/^https?:\/\//i.test(f.socials[k].trim()) && <small className="err">لازم اللينك يبدأ بـ https://</small>}</label>
          ))}
        </section>
      </>}

      {tab === 'sections' && (
        <section className="ad-s">
          <div className="ad-top"><h2>🗂️ الأقسام</h2><button className="pri" onClick={() => up('sections', [...f.sections, { id: uid7(), name: 'قسم جديد', img: '' }])}>＋ قسم جديد</button></div>
          <p className="mut">غيّر اسم القسم أو صورته أو ترتيبه. القسم الفاضي (من غير منتجات) مبيظهرش على الموقع. القسم اللي فيه منتجات مينفعش يتحذف.</p>
          {f.sections.map((s, i) => (
            <div key={s.id} className="ad-sec">
              <Img value={s.img} onChange={u => up('sections', f.sections.map((x, k) => (k === i ? { ...x, img: u } : x)))} label="صورة القسم" />
              <div className="ad-sn">
                <input value={s.name} maxLength={50} aria-label="اسم القسم" onChange={e => up('sections', f.sections.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <small className="mut">{count(s.id)} منتج</small>
                {!count(s.id) && <button type="button" className="lnk" onClick={() => setF(x => (x ? { ...x, sections: x.sections.filter((_, k) => k !== i), removed: [...x.removed, s.id] } : x))}>🗑️ احذف القسم</button>}
              </div>
              <div className="ad-mv"><button type="button" onClick={() => up('sections', move(f.sections, i, -1))} disabled={i === 0} aria-label="فوق">↑</button><button type="button" onClick={() => up('sections', move(f.sections, i, 1))} disabled={i === f.sections.length - 1} aria-label="تحت">↓</button></div>
            </div>
          ))}
        </section>
      )}

      {tab === 'more' && (
        <section className="ad-s ad-more">
          <h2>⚙️ أدوات</h2>
          <button type="button" className="sec" onClick={backup}>💾 نزّل نسخة احتياطية من كل بيانات الموقع</button>
          <p className="mut">اعمل نسخة احتياطية قبل أي تعديل كبير.</p>
          <p>المنتج ليه نسخة يمين ونسخة شمال؟ افتحه من «📦 المنتجات» واختار «اتجاه الفتح». الموقع بيشرح للعميل إزاي يختار، وبيوديه للنسخة التانية.</p>
          <p><a href="/guide/left-or-right" target="_blank" rel="noopener">↗ شوف شرح يمين وشمال على الموقع</a></p>
        </section>
      )}

      {GLOBAL.includes(tab) && (
        <div className="ad-bar">
          <span className={saved.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{saved || (dirty ? 'فيه تعديلات لسه متحفظتش' : 'كل حاجة محفوظة')}</span>
          <button className="pri" disabled={busy || !dirty} onClick={save}>💾 حفظ ونشر</button>
        </div>
      )}
    </div>
  );
}
