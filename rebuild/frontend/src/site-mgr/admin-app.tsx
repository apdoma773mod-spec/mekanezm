'use client';
// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
// Owner admin for the public site: products, sections, works, reviews, delivery + contact, and the look
// (colors, promo strip, banners, logo, texts, social links). Everything is saved to the same document the system uses.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadDoc, publishNow, saveDoc, SITE_URL, type Rec, type SiteDoc } from './api';
import Link from 'next/link';
import { PendingReviews } from '@/components/modals/site-admin';
import { ProsTab, ReviewsTab, ShipTab, WorksTab } from './content';
import { ProductsTab } from './products';
import { ImportTab } from './import';
import { AddMany, Img, move, uid7 } from './ui';
import { DEFAULTS, HEX, THEME_KEYS, WOOD_AREAS, WOOD_KEYS, woodById, type ThemeMap } from './lib/theme';
import { ThemeTab } from './theme-tab';
import { SectionsTab } from './sections-tab';
import { Ico } from './icons';

type Sec = { id: string; name: string; img: string };
type Form = {
  promo: string; name: string; tagline: string; logo: string; hero: string;
  slides: string[]; trust: string[]; socials: Record<'fb' | 'ig' | 'tt' | 'yt', string>;
  theme: ThemeMap; sections: Sec[]; removed: string[];
};
const THEME_DEFAULT = DEFAULTS;

const fromDoc = (d: Rec): Form => ({
  promo: String(d.promo ?? ''), name: String(d.name ?? ''), tagline: String(d.tagline ?? ''), logo: String(d.logo ?? ''), hero: String(d.hero ?? ''),
  slides: Array.isArray(d.slides) ? d.slides.filter((x: unknown) => typeof x === 'string') : [],
  trust: Array.isArray(d.trust) ? d.trust.filter((x: unknown) => typeof x === 'string') : [],
  socials: { fb: d.socials?.fb ?? '', ig: d.socials?.ig ?? '', tt: d.socials?.tt ?? '', yt: d.socials?.yt ?? '' },
  theme: Object.fromEntries([...THEME_KEYS, ...WOOD_KEYS].map(k => [k, String(d.theme?.[k] ?? '')])) as ThemeMap,
  sections: Array.isArray(d.sections) ? d.sections.map((s: Sec) => ({ id: s.id, name: String(s.name ?? ''), img: String(s.img ?? '') })) : [], removed: [],
});

/** Apply only the fields this screen owns onto the newest copy of the document. */
function applyForm(d: Rec, f: Form) {
  d.promo = f.promo.trim(); d.name = f.name.trim(); d.tagline = f.tagline.trim(); d.logo = f.logo; d.hero = f.hero;
  d.slides = f.slides; d.trust = f.trust.map(x => x.trim()).filter(Boolean);
  d.socials = { ...(d.socials ?? {}), ...Object.fromEntries(Object.entries(f.socials).map(([k, v]) => [k, v.trim()])) };
  const th: Rec = { ...(d.theme ?? {}) };
  for (const k of THEME_KEYS) { if (HEX.test(f.theme[k])) th[k] = f.theme[k]; else delete th[k]; }
  // wood settings: only a known finish / level / area list is kept
  const wid = f.theme.woodId ?? '', wlv = f.theme.woodLvl ?? '', wat = (f.theme.woodAt ?? '').split(',').filter(a => WOOD_AREAS.some(x => x[0] === a)).join(',');
  if (woodById(wid)) th.woodId = wid; else delete th.woodId;
  if (/^[123]$/.test(wlv)) th.woodLvl = wlv; else delete th.woodLvl;
  if (wat) th.woodAt = wat; else delete th.woodAt;
  d.theme = th;
  // sections: new ones are added, renamed/re-ordered ones updated, deleted ones removed (never one that still has products)
  const cur: Sec[] = Array.isArray(d.sections) ? d.sections : [];
  const used = new Set((d.products ?? []).map((p: Rec) => p.sec));
  const by = new Map(cur.map(s => [s.id, s]));
  const ordered = f.sections.map(s => ({ ...(by.get(s.id) ?? {}), id: s.id, name: s.name.trim() || by.get(s.id)?.name || 'قسم', img: s.img }));
  const rest = cur.filter(s => !f.sections.some(x => x.id === s.id) && !(f.removed.includes(s.id) && !used.has(s.id)));
  d.sections = [...ordered, ...rest];
}

/** a group inside a screen: closed by default, tap the header to open/close */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <section className={'ad-fold' + (on ? ' on' : '')}>
      <button type="button" className="ad-fold-h" onClick={() => setOn(!on)} aria-expanded={on}><b>{title}</b><span className="x">{on ? '✕' : '▾'}</span></button>
      {on && <div className="ad-fold-b">{children}</div>}
    </section>
  );
}
type Tab = '' | 'products' | 'sections' | 'works' | 'look' | 'banner' | 'text' | 'reviews' | 'pros' | 'ship' | 'import' | 'more';
const GLOBAL: Tab[] = ['look', 'banner', 'text', 'sections']; // these share the bottom «حفظ ونشر» bar; the others save inside their own screen

const DOC_CACHE = 'mk_site_doc_v1';

export function AdminApp() {
  const [stage, setStage] = useState<'load' | 'edit' | 'err'>('load');
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<SiteDoc | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [snap, setSnap] = useState('');
  const [tab, setTabRaw] = useState<Tab>('');
  // آخر شاشة كنت فيها بتفضل مفتوحة
  const setTab = (t: Tab) => setTabRaw(t);
  // ⚡ opens at once: the last copy of the site data is kept on the phone and shown immediately, the fresh copy loads behind it
  // (saving always re-reads the newest version on the server first, so an old copy on the phone can never overwrite anything)
  const dirtyRef = useRef(false);
  const show = (d: SiteDoc) => { const form = fromDoc(d.data); setDoc(d); setF(form); setSnap(JSON.stringify(form)); setStage('edit'); };
  const reload = () => {
    setMsg('');
    let cached: SiteDoc | null = null;
    try { const raw = localStorage.getItem(DOC_CACHE); if (raw) cached = JSON.parse(raw) as SiteDoc; } catch { /* no copy */ }
    if (cached?.data) show(cached); else setStage('load');
    loadDoc()
      .then(d => {
        if (cached && cached.version === d.version) return;
        if (cached && dirtyRef.current) { setDoc(d); return; } // keep what is being typed; saving uses the newest version anyway
        show(d);
      })
      .catch(e => { if (!cached) { setMsg((e as Error).message); setStage('err'); } });
  };
  useEffect(reload, []);
  useEffect(() => { if (doc) try { localStorage.setItem(DOC_CACHE, JSON.stringify(doc)); } catch { /* full: skip */ } }, [doc]);
  const [saved, setSaved] = useState('');

  const dirty = useMemo(() => !!f && JSON.stringify(f) !== snap, [f, snap]);
  dirtyRef.current = dirty;
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

  // Each uploaded banner is saved to the site at once (one after the other): before, they only lived in this screen until «حفظ» was pressed, so a closed page or a retry lost them
  const slideQ = useRef<Promise<void>>(Promise.resolve());
  const addSlides = (us: string[]) => {
    setF(x => (x ? { ...x, slides: [...x.slides, ...us] } : x));
    slideQ.current = slideQ.current.then(async () => {
      try {
        const d = await saveDoc(x => { const cur = Array.isArray(x.slides) ? (x.slides as string[]) : []; x.slides = [...cur, ...us.filter(u => !cur.includes(u))]; });
        setDoc(d);
        setSnap(sn => { try { const o = JSON.parse(sn) as Form; o.slides = Array.isArray(d.data.slides) ? (d.data.slides as string[]) : []; return JSON.stringify(o); } catch { return sn; } });
        setSaved('✔ البنر اتحفظ ونزل على الموقع'); publishNow();
      } catch (err) { setSaved('✗ البنر اترفع بس ماتحفظش: ' + (err as Error).message + ' — دوس حفظ'); }
    });
  };
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
      <div className="ad-login">
        <h1>🌐 إدارة الموقع</h1>
        {stage === 'err' ? <><p className="err">مقدرتش أفتح بيانات الموقع: {msg}</p><button type="button" className="pri" onClick={reload}>🔄 حاول تاني</button></> : <p className="mut">⏳ بيحمّل بيانات الموقع…</p>}
      </div>
    );
  }

  const TABS: [Exclude<Tab, ''>, string][] = [['products', 'المنتجات'], ['sections', 'الأقسام'], ['works', 'أعمالنا'], ['look', 'الألوان والشريط'], ['banner', 'البنرات'], ['text', 'النصوص'], ['reviews', 'الآراء'], ['pros', 'الفنيين'], ['ship', 'التوصيل والتواصل'], ['import', 'استيراد'], ['more', 'أدوات']];
  const count = (id: string) => (doc.data.products ?? []).filter((p: Rec) => p.sec === id).length;
  const body = (tab: Tab) => (
    <>
      {tab === 'products' && <ProductsTab doc={doc} onDoc={onDoc} />}
      {tab === 'works' && <WorksTab doc={doc} onDoc={onDoc} />}
      {tab === 'pros' && <ProsTab doc={doc} onDoc={onDoc} />}
      {tab === 'reviews' && <><section className="ad-s"><h2>📨 آراء مستنية موافقتك</h2><PendingReviews onChanged={reload} /></section><ReviewsTab doc={doc} onDoc={onDoc} /></>}
      {tab === 'import' && <ImportTab doc={doc} onDoc={onDoc} backup={backup} />}
      {tab === 'ship' && <ShipTab key={doc.version} doc={doc} onDoc={onDoc} />}

      {tab === 'look' && <>
        <Fold title="🎨 الألوان">
          <ThemeTab theme={f.theme} set={t => up('theme', t)} />
        </Fold>
        <Fold title="📣 الشريط المتحرك">
          <label>الكلام اللي بيمشي <small>(سيبه فاضي لو مش عايز شريط)</small>
            <textarea rows={2} maxLength={200} value={f.promo} onChange={e => up('promo', e.target.value)} placeholder="مثلاً: اطلب الآن على الواتساب • توصيل لكل المحافظات" />
          </label>
          <div className="ad-tk" style={{ background: HEX.test(f.theme.accent) ? f.theme.accent : THEME_DEFAULT.accent }}>{f.promo || 'معاينة الشريط'}</div>
          <small className="mut">الشريط بيمشي من الشمال لليمين، فأول الجملة هو اللي بيدخل الأول.</small>
        </Fold>
      </>}

      {tab === 'banner' && <>
        <Fold title="🖼️ بنرات الصفحة الرئيسية">
          <p className="mut">الصور اللي بتتقلّب فوق في الرئيسية. لو مفيش صور، الموقع بيستخدم الصورة الرئيسية وصور المنتجات.</p>
          {f.slides.map((u, i) => (
            <div key={u + i} className="ad-row">
              <Img value={u} onChange={nu => up('slides', nu ? f.slides.map((x, k) => (k === i ? nu : x)) : f.slides.filter((_, k) => k !== i))} label={`بنر ${i + 1}`} wide />
              <div className="ad-mv"><button type="button" onClick={() => up('slides', move(f.slides, i, -1))} disabled={i === 0} aria-label="فوق">↑</button><button type="button" onClick={() => up('slides', move(f.slides, i, 1))} disabled={i === f.slides.length - 1} aria-label="تحت">↓</button></div>
            </div>
          ))}
          <AddMany label={`+ إضافة بنرات جديدة (${f.slides.length} حالياً)`} onAdd={addSlides} />
        </Fold>
        <Fold title="🏷️ اللوجو والصورة الرئيسية">
          <Img value={f.logo} onChange={u => up('logo', u)} label="لوجو الهيدر (صورة عريضة)" wide />
          <Img value={f.hero} onChange={u => up('hero', u)} label="الصورة الرئيسية (صفحة «مين إحنا»)" wide />
        </Fold>
      </>}

      {tab === 'text' && <>
        <Fold title="📝 اسم الموقع">
          <label>الاسم<input value={f.name} maxLength={60} onChange={e => up('name', e.target.value)} /></label>
          <label>الجملة التعريفية<input value={f.tagline} maxLength={120} onChange={e => up('tagline', e.target.value)} /></label>
        </Fold>
        <Fold title="✅ نقط الثقة">
          <p className="mut">جمل قصيرة بتظهر في الرئيسية (مثلاً: «توصيل لكل المحافظات»).</p>
          {f.trust.map((t, i) => <div key={i} className="ad-line"><input value={t} maxLength={60} onChange={e => up('trust', f.trust.map((x, k) => (k === i ? e.target.value : x)))} /><button type="button" className="lnk" onClick={() => up('trust', f.trust.filter((_, k) => k !== i))} aria-label="شيل">🗑️</button></div>)}
          {f.trust.length < 8 && <button type="button" className="sec" onClick={() => up('trust', [...f.trust, ''])}>+ نقطة جديدة</button>}
        </Fold>
        <Fold title="🔗 السوشيال ميديا">
          {([['fb', 'فيسبوك'], ['ig', 'إنستجرام'], ['tt', 'تيك توك'], ['yt', 'يوتيوب']] as const).map(([k, t]) => (
            <label key={k}>{t}<input dir="ltr" inputMode="url" placeholder="https://…" value={f.socials[k]} onChange={e => up('socials', { ...f.socials, [k]: e.target.value })} />
              {f.socials[k] && !/^https?:\/\//i.test(f.socials[k].trim()) && <small className="err">لازم اللينك يبدأ بـ https://</small>}</label>
          ))}
        </Fold>
      </>}

      {tab === 'sections' && <SectionsTab sections={f.sections} count={count} onChange={s => up('sections', s)} onRemove={id => setF(x => (x ? { ...x, sections: x.sections.filter(s => s.id !== id), removed: [...x.removed, id] } : x))} />}

      {tab === 'more' && (
        <section className="ad-s ad-more">
          <h2>⚙️ أدوات</h2>
          <button type="button" className="sec" onClick={backup}>💾 نزّل نسخة احتياطية من كل بيانات الموقع</button>
          <p className="mut">اعمل نسخة احتياطية قبل أي تعديل كبير.</p>
          <p>المنتج ليه نسخة يمين ونسخة شمال؟ افتحه من «📦 المنتجات» واختار «اتجاه الفتح». الموقع بيشرح للعميل إزاي يختار، وبيوديه للنسخة التانية.</p>
          <p><a href={SITE_URL + '/guide/left-or-right'} target="_blank" rel="noopener">↗ شوف شرح يمين وشمال على الموقع</a></p>
        </section>
      )}
    </>
  );
  return (
    <div className="ad">
      <header className="ad-h">
        <h1>إدارة الموقع</h1>
        <div className="ad-links"><a href={SITE_URL} target="_blank" rel="noopener">↗ افتح الموقع</a><Link href="/weborders">🛒 طلبات الموقع</Link><Link href="/catalog">📖 الكتالوج</Link></div>
      </header>
      <div className="ad-tiles">
        {TABS.map(([k, t]) => tab === k ? (
          <section key={k} className="ad-open">
            <button type="button" className="ad-open-h" onClick={() => { setTab(''); setSaved(''); }} aria-label="اقفل"><Ico n={k} size={26} /><b>{t}</b><span className="x">✕</span></button>
            <div className="ad-open-b">{body(k)}</div>
          </section>
        ) : (
          <button key={k} type="button" className="ad-tile" onClick={() => { setTab(k); setSaved(''); }}><Ico n={k} size={30} /><b>{t}</b></button>
        ))}
      </div>
      {GLOBAL.includes(tab) && (
        <div className="ad-bar">
          <span className={saved.startsWith('✗') ? 'err' : 'mut'} aria-live="polite">{saved || (dirty ? 'فيه تعديلات لسه متحفظتش' : 'كل حاجة محفوظة')}</span>
          <button className="pri" disabled={busy || !dirty} onClick={save}>💾 حفظ ونشر</button>
        </div>
      )}
    </div>
  );
}
