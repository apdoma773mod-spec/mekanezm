'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CatalogAi } from '@/components/catalog/ai-panel';
import { uploadSiteImage } from '@/components/modals/site-admin';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { buildFlipbook, buildProCatalog, COLOR_PRESETS, DEFAULT_ARTICLES, DEFAULT_CFG, FONTS, GIFT_MESSAGE, mergeCfg, STORY_TEXT, type AiInfo, type Article, type CatCfg, type CatInput, type CatProduct } from '@/lib/catalog-pro';
import { printHtml } from '@/lib/print';
import { useAllProductInfo, useAllProducts } from '@/lib/trade-queries';
import { fetchSite, saveSite } from '@/lib/web-queries';

/** 🌟 استوديو الكتالوج: كل اختيارات الشكل والمحتوى، معاينة كتاب بيتقلّب، PDF، ولينك للإرسال (هدية لشخص أو نسخة ميكانيزم). */
const box: React.CSSProperties = { border: '1px solid var(--border,#dfe7ea)', borderRadius: 14, padding: 12, marginBottom: 10, background: 'var(--card,#fff)' };
const lab: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted,#62767c)', margin: '8px 0 4px' };
const inp: React.CSSProperties = { width: '100%' };

/** Every group of settings is an icon: tap it and it opens (full width), tap again and it closes. One open at a time so the screen stays calm. */
const OpenSec = createContext<{ open: string; set: (t: string) => void }>({ open: '', set: () => {} });
function Sec({ title, children }: { title: string; children: ReactNode; open?: boolean }) {
  const { open, set } = useContext(OpenSec);
  const ref = useRef<HTMLElement>(null);
  const isOpen = open === title;
  useEffect(() => {
    if (isOpen) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isOpen]);
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u.exec(title);
  const icon = m?.[1] ?? '⚙️';
  const rest = m?.[2] ?? title;
  const name = rest.replace(/\s*[(:—].*$/, '') || rest;
  const extra = rest.slice(name.length).replace(/^\s*[(:—]\s*/, '').replace(/\)\s*$/, '');
  if (!isOpen)
    return (
      <button type="button" className="cat-tile" onClick={() => set(title)}>
        <span className="ic">{icon}</span>
        <b>{name}</b>
        {extra && <small>{extra}</small>}
      </button>
    );
  return (
    <section className="cat-open" ref={ref}>
      <button type="button" className="cat-open-h" onClick={() => set('')} aria-label="اقفل">
        <span className="ic">{icon}</span>
        <b>{rest}</b>
        <span className="x">✕</span>
      </button>
      <div className="cat-open-b">{children}</div>
    </section>
  );
}

const GIFT_TEMPLATES: { name: string; text: string }[] = [
  { name: 'رسمي', text: GIFT_MESSAGE },
  {
    name: 'شكر وتقدير',
    text: 'تحية طيبة وبعد،\nنتقدم إلى سيادتكم بخالص الشكر على ثقتكم الغالية، ويسعدنا أن نُهديكم كتالوج ميكانيزم الجديد، متمنين لكم دوام التوفيق والنجاح في كل أعمالكم.\nنحن في خدمتكم دائمًا.',
  },
  {
    name: 'بداية تعاون',
    text: 'تحية طيبة وبعد،\nيشرفنا أن نضع بين أيديكم كتالوج ميكانيزم، دليلكم لأحدث الحلول والإكسسوارات التي تُحسّن جودة العمل وتوفّر الوقت والجهد.\nونتطلع إلى بداية شراكة ناجحة تدوم طويلًا.',
  },
];

export function CatalogStudio() {
  const toast = useToast();
  const prods = useAllProducts({}).data ?? [];
  const site = useQuery({ queryKey: ['web', 'site-admin'], queryFn: fetchSite, staleTime: 60_000 });
  const [cfg, setCfg] = useState<CatCfg>(DEFAULT_CFG);
  const [loaded, setLoaded] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [stockOnly, setStockOnly] = useState(false);
  const [mode, setMode] = useState<'shop' | 'gift'>('shop');
  const [gift, setGift] = useState({ name: '', title: '', from: 'عبده', message: GIFT_MESSAGE });
  const [view, setView] = useState('');
  const [openSec, setOpenSec] = useState('');
  const [useQ, setUseQ] = useState('');
  const [busy, setBusy] = useState('');
  const [link, setLink] = useState('');
  const [siteLink, setSiteLink] = useState('');
  const [pubs, setPubs] = useState<{ id: string; at: string; current: boolean }[] | null>(null);
  const [stats, setStats] = useState<{ days: Record<string, Record<string, number>>; views: Record<string, number>; adds: Record<string, number>; q: Record<string, number> } | null>(null);
  const loadPubs = () => api.get<{ items: { id: string; at: string; current: boolean }[] }>('/web/catalog/list').then((r) => setPubs(r.items)).catch((e) => toast(errorMessage(e), 'bad'));
  const loadStats = () => api.get<{ stats: NonNullable<typeof stats> }>('/web/catalog/stats').then((r) => setStats(r.stats)).catch((e) => toast(errorMessage(e), 'bad'));
  const [pickSec, setPickSec] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const fileFor = useRef<string>('');

  useEffect(() => {
    const h = (e: MessageEvent) => e.data === 'catalog-close' && setView('');
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setView('');
    window.addEventListener('message', h);
    window.addEventListener('keydown', esc);
    api.get<{ current: string | null }>('/web/catalog/current').then((r) => r.current && setSiteLink(`${location.origin}/api/v1/web/public/catalog-latest`)).catch(() => {});
    return () => {
      window.removeEventListener('message', h);
      window.removeEventListener('keydown', esc);
    };
  }, []);

  useEffect(() => {
    if (loaded || !site.data) return;
    setCfg(mergeCfg((site.data.data as { catalogCfg?: Partial<CatCfg> }).catalogCfg));
    setLoaded(true);
  }, [site.data, loaded]);

  const data = site.data?.data;
  const qty = useMemo(() => new Map(prods.map((p) => [String(p.code), p.qty])), [prods]);
  const secName = useMemo(() => Object.fromEntries((data?.sections ?? []).map((s) => [s.id, s.name])), [data]);
  const infos = useAllProductInfo(cfg.source === 'stock').data;
  const byCode = useMemo(() => new Map(prods.map((p) => [String(p.code), p])), [prods]);
  const NEW_MS = 45 * 864e5;
  const all: CatProduct[] = useMemo(() => {
    const top = new Set((data?.products ?? []).filter((p) => p.top).map((p) => String(p.code)));
    if (cfg.source === 'stock') {
      const siteBy = new Map((data?.products ?? []).map((p) => [String(p.code), p]));
      return prods
        .map((p) => {
          const inf = infos?.[p.id];
          const sp = siteBy.get(String(p.code));
          const imgs = inf?.imgs?.length ? inf.imgs : sp?.imgs ?? [];
          return {
            code: String(p.code),
            name: sp?.name || p.name,
            desc: [sp?.desc || inf?.descr || '', inf?.specs || ''].filter(Boolean).join('\n'),
            imgs,
            dimImg: String((sp as unknown as Record<string, unknown> | undefined)?.dimImg ?? ''),
            section: p.category || 'منتجات متنوعة',
            inStock: p.qty > 0,
            featured: top.has(String(p.code)),
            isNew: Date.now() - new Date(p.createdAt).getTime() < NEW_MS,
            brand: inf?.brand || '',
            size: inf?.size || '',
            finish: inf?.finish || '',
            unit: p.unit,
          } satisfies CatProduct;
        })
        .filter((p) => p.imgs.length);
    }
    return (data?.products ?? [])
      .filter((p) => p.imgs?.length)
      .map((p) => {
        const sp = byCode.get(String(p.code));
        return {
          code: String(p.code || ''),
          name: p.name || String(p.code),
          desc: p.desc,
          imgs: p.imgs,
          dimImg: String((p as unknown as Record<string, unknown>).dimImg ?? ''),
          section: secName[p.sec] ?? '',
          inStock: (qty.get(String(p.code)) ?? 0) > 0,
          featured: !!p.top,
          isNew: sp ? Date.now() - new Date(sp.createdAt).getTime() < NEW_MS : false,
          video: p.video,
        } satisfies CatProduct;
      });
  }, [data, secName, qty, cfg.source, prods, infos, byCode, NEW_MS]);
  const secNames = useMemo(() => [...new Set(all.map((p) => p.section || 'منتجات متنوعة'))], [all]);
  const picked = all.filter((p) => !off.has(p.section || 'منتجات متنوعة') && (!stockOnly || p.inStock));
  const set = (x: Partial<CatCfg>) => setCfg((c) => ({ ...c, ...x }));
  const setArt = (id: string, x: Partial<Article>) => setCfg((c) => ({ ...c, articles: c.articles.map((a) => (a.id === id ? { ...a, ...x } : a)) }));
  const moveArt = (id: string, d: number) =>
    setCfg((c) => {
      const a = [...c.articles];
      const i = a.findIndex((x) => x.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= a.length) return c;
      [a[i], a[j]] = [a[j]!, a[i]!];
      return { ...c, articles: a };
    });
  const setFlag = (k: keyof CatCfg['flags'], v: boolean) => setCfg((c) => ({ ...c, flags: { ...c.flags, [k]: v } }));
  const abs = (u: string) => (u && u.startsWith('/') ? `${location.origin}${u}` : u);

  const input = (absolute: boolean): CatInput => {
    const f = absolute ? abs : (u: string) => u;
    const c: CatCfg = { ...cfg, secImgs: Object.fromEntries(Object.entries(cfg.secImgs).map(([k, v]) => [k, f(v)])), secUse: Object.fromEntries(Object.entries(cfg.secUse).map(([k, v]) => [k, f(v)])), prodUse: Object.fromEntries(Object.entries(cfg.prodUse).map(([k, v]) => [k, f(v)])), ai: Object.fromEntries(Object.entries(cfg.ai).map(([k, v]) => [k, { ...v, img: f(v.img) }])), photos: Object.fromEntries(Object.entries(cfg.photos).map(([k, v]) => [k, v.map(f)])), cover: { ...cfg.cover, imgs: cfg.cover.imgs.map(f) }, gift: mode === 'gift' && gift.name.trim() ? { ...gift } : undefined };
    return {
      shop: 'ميكانيزم',
      tagline: String((data as Record<string, unknown> | undefined)?.tagline ?? ''),
      phones: (data as { phones?: string[] } | undefined)?.phones ?? [],
      address: String((data as Record<string, unknown> | undefined)?.address ?? ''),
      cfg: c,
      products: picked.map((p) => ({ ...p, imgs: p.imgs.map(f), dimImg: p.dimImg ? f(p.dimImg) : '' })),
    };
  };

  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const saveNow = () => saveSite((d) => void ((d as Record<string, unknown>).catalogCfg = cfgRef.current)).then(() => undefined);
  const setAi = (code: string, v: AiInfo | null) =>
    setCfg((c) => {
      const ai = { ...c.ai };
      if (v) ai[code] = v;
      else delete ai[code];
      return { ...c, ai };
    });
  const save = async () => {
    setBusy('save');
    try {
      await saveSite((d) => void ((d as Record<string, unknown>).catalogCfg = cfg));
      toast('✔ اتحفظت إعدادات الكتالوج');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
    setBusy('');
  };
  const check = () => {
    if (!picked.length) {
      toast('مفيش منتجات منشورة على الموقع بصور بالشروط دي', 'bad');
      return false;
    }
    if (mode === 'gift' && !gift.name.trim()) {
      toast('اكتب اسم الشخص اللي هتهديله الكتالوج', 'bad');
      return false;
    }
    return true;
  };
  const publish = async (current: boolean) => {
    if (!check()) return;
    setBusy(current ? 'site' : 'pub');
    try {
      const { id } = await api.post<{ id: string }>('/web/catalog', { html: buildFlipbook(input(false), { pdfUrl: '__PDF__', hitUrl: '__HIT__' }), print: buildProCatalog(input(false), { autoPrint: true }), current });
      if (current) {
        setSiteLink(`${location.origin}/api/v1/web/public/catalog-latest`);
        toast('✔ الكتالوج اتنشر للعملاء على الموقع');
      } else {
        setLink(`${location.origin}/api/v1/web/public/catalog/${id}`);
        toast('✔ اتعمل اللينك');
      }
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
    setBusy('');
  };
  const unpublishSite = async () => {
    try {
      await api.delete('/web/catalog/current');
      setSiteLink('');
      toast('✔ اتشال الكتالوج من الموقع');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const upload = async (fs: FileList | null) => {
    const f = fs?.[0];
    if (!f) return;
    setBusy('up');
    try {
      const url = await uploadSiteImage(f);
      if (fileFor.current.startsWith('use:s:')) set({ secUse: { ...cfg.secUse, [fileFor.current.slice(6)]: url } });
      else if (fileFor.current.startsWith('use:p:')) set({ prodUse: { ...cfg.prodUse, [fileFor.current.slice(6)]: url } });
      else if (fileFor.current.startsWith('art:')) setArt(fileFor.current.slice(4), { img: url });
      else if (fileFor.current === 'showroom') set({ showroomImgs: [...cfg.showroomImgs, url].slice(0, 5) });
      else if (fileFor.current === 'cover') set({ cover: { ...cfg.cover, imgs: [url, ...cfg.cover.imgs].slice(0, 3) } });
      else set({ secImgs: { ...cfg.secImgs, [fileFor.current]: url } });
    } catch (e) {
      toast(`الصورة مارفعتش: ${errorMessage(e)}`, 'bad');
    }
    setBusy('');
  };

  if (site.isPending) return <p>⏳ بنحمّل بيانات الموقع…</p>;
  if (!data) return <p>مش قادر أفتح بيانات الموقع</p>;
  const waText = encodeURIComponent(`${mode === 'gift' && gift.name ? `الأستاذ ${gift.name}، ` : ''}ده كتالوج ميكانيزم، افتحه من الموبايل وقلّب صفحاته:\n${link}`);
  const Thumbs = ({ urls, on, pick }: { urls: string[]; on: string[]; pick: (u: string) => void }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {urls.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="" onClick={() => pick(u)} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', border: on.includes(u) ? '3px solid var(--primary,#087f8c)' : '2px solid #e1e8ea' }} />
      ))}
    </div>
  );
  const allImgs = [...new Set(all.flatMap((p) => p.imgs.filter((u) => u !== p.dimImg)))];

  return (
    <div id="catStudio">
      <style>{`
        #catStudio .cat-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;margin:10px 0}
        #catStudio .cat-tile{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-height:104px;padding:12px 6px;border:1px solid var(--border,#dfe7ea);border-radius:16px;background:var(--card,#fff);color:inherit;font:inherit;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0000000d}
        #catStudio .cat-tile:active{transform:scale(.97)}
        #catStudio .cat-tile .ic{font-size:30px;line-height:1.1}
        #catStudio .cat-tile b{font-size:13.5px;line-height:1.35}
        #catStudio .cat-tile small{font-size:11px;color:var(--muted,#62767c);line-height:1.3}
        #catStudio .cat-open{grid-column:1/-1;border:2px solid var(--blue,#087f8c);border-radius:16px;background:var(--card,#fff);overflow:hidden;scroll-margin-top:70px}
        #catStudio .cat-open-h{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;background:var(--tint,#e6f2f3);color:inherit;font:inherit;text-align:start;cursor:pointer}
        #catStudio .cat-open-h .ic{font-size:24px}
        #catStudio .cat-open-h b{flex:1;font-size:15px}
        #catStudio .cat-open-h .x{font-size:18px;opacity:.7}
        #catStudio .cat-open-b{padding:12px}
      `}</style>
      <p className="bz-note">اعمل كتالوج احترافي بصور كاملة وكتل ألوان وتبويبات للأقسام، وابعته بلينك للعميل أو هدية لشخص ببرقية. مفيش أسعار فيه.</p>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />

      <OpenSec.Provider value={{ open: openSec, set: (t) => setOpenSec((o) => (o === t ? '' : t)) }}>
      <div className="cat-tiles">
      <Sec title="🎁 النسخة: ليه الكتالوج ده؟" open>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={mode === 'shop' ? 'primary' : 'secondary'} onClick={() => setMode('shop')}>🏪 نسخة ميكانيزم العادية</button>
          <button type="button" className={mode === 'gift' ? 'primary' : 'secondary'} onClick={() => setMode('gift')}>🎁 هدية لشخص (ببرقية)</button>
        </div>
        {mode === 'gift' && (
          <>
            <label style={lab}>اسم الشخص</label>
            <input style={inp} value={gift.name} placeholder="مثلًا: م. أحمد السيد" onChange={(e) => setGift({ ...gift, name: e.target.value })} />
            <label style={lab}>صفته / شركته (اختياري)</label>
            <input style={inp} value={gift.title} placeholder="مثلًا: مدير المشتريات — شركة النور للأثاث" onChange={(e) => setGift({ ...gift, title: e.target.value })} />
            <label style={lab}>التوقيع</label>
            <input style={inp} value={gift.from} onChange={(e) => setGift({ ...gift, from: e.target.value })} />
            <label style={lab}>نص البرقية</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {GIFT_TEMPLATES.map((t) => (
                <button key={t.name} type="button" className="secondary" style={{ padding: '4px 12px' }} onClick={() => setGift({ ...gift, message: t.text })}>
                  ✍️ {t.name}
                </button>
              ))}
            </div>
            <textarea style={{ ...inp, minHeight: 150 }} value={gift.message} onChange={(e) => setGift({ ...gift, message: e.target.value })} />
          </>
        )}
      </Sec>

      <Sec title="🤖 الوصف والمقاسات + صور حقيقية من النت (ذكاء اصطناعي)" open>
        <CatalogAi products={picked} ai={cfg.ai} setAi={setAi} saveNow={saveNow} photos={cfg.photos} setPhotos={(code, v) => setCfg((c) => ({ ...c, photos: { ...c.photos, [code]: v } }))} />
      </Sec>

      <Sec title={`🎨 الألوان (${COLOR_PRESETS.length} ثيم جاهز — اضغط واحد وكل ألوان الكتالوج تتغير)`} open>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {COLOR_PRESETS.map((p) => {
            const on = cfg.colors.main === p.main && cfg.colors.dark === p.dark && cfg.colors.accent === p.accent && cfg.colors.alt === p.alt;
            return (
              <button key={p.name} type="button" onClick={() => set({ colors: { main: p.main, dark: p.dark, accent: p.accent, alt: p.alt } })} style={{ border: on ? '3px solid var(--primary,#087f8c)' : '1px solid #dfe7ea', borderRadius: 12, padding: 6, background: '#fff', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden' }}>
                  <i style={{ flex: 2, background: p.dark }} />
                  <i style={{ flex: 3, background: p.main }} />
                  <i style={{ flex: 1, background: p.alt }} />
                  <i style={{ flex: 1, background: p.accent }} />
                </div>
                <small style={{ display: 'block', marginTop: 4, color: '#14262b', fontWeight: 700 }}>{p.name}</small>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted,#62767c)', margin: '10px 0 2px' }}>أو اختار ألوانك بنفسك:</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {(
            [
              ['main', 'الأساسي (الكتل)'],
              ['dark', 'الغامق (الخلفيات)'],
              ['accent', 'الذهبي (الخطوط)'],
              ['alt', 'الأصفر المانجو (الشارات)'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} style={{ fontSize: 13 }}>
              {l}
              <br />
              <input type="color" value={cfg.colors[k]} onChange={(e) => set({ colors: { ...cfg.colors, [k]: e.target.value } })} style={{ width: 70, height: 36, padding: 0 }} />
            </label>
          ))}
        </div>
      </Sec>

      <Sec title="✨ الخط والستايل">
        <label style={lab}>الخط</label>
        <select value={cfg.style.font} onChange={(e) => set({ style: { ...cfg.style, font: e.target.value } })}>
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <label style={lab}>استدارة الزوايا: {cfg.style.radius}</label>
        <input type="range" min={0} max={40} value={cfg.style.radius} onChange={(e) => set({ style: { ...cfg.style, radius: +e.target.value } })} style={{ width: '100%' }} />
        <label style={lab}>شكل الغلاف</label>
        <select value={cfg.style.coverStyle} onChange={(e) => set({ style: { ...cfg.style, coverStyle: e.target.value as CatCfg['style']['coverStyle'] } })}>
          <option value="mosaic">٣ صور مائلة متداخلة</option>
          <option value="full">صورة واحدة كاملة</option>
          <option value="minimal">بسيط من غير صور</option>
        </select>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
          {(
            [
              ['pattern', 'الرسم الهندسي في الخلفيات'],
              ['showCode', 'شارة كود المنتج'],
              ['showFooter', 'شريط أسفل الصفحة'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={cfg.style[k]} onChange={(e) => set({ style: { ...cfg.style, [k]: e.target.checked } })} /> {l}
            </label>
          ))}
        </div>
      </Sec>

      <Sec title="🪪 الغلاف">
        <label style={lab}>العنوان الكبير</label>
        <input style={inp} value={cfg.cover.title} onChange={(e) => set({ cover: { ...cfg.cover, title: e.target.value } })} />
        <label style={lab}>العنوان الفرعي</label>
        <input style={inp} value={cfg.cover.subtitle} onChange={(e) => set({ cover: { ...cfg.cover, subtitle: e.target.value } })} />
        <label style={lab}>سطر إضافي تحت العنوان (اختياري، مثلًا: إصدار الشتاء)</label>
        <input style={inp} value={cfg.cover.note} onChange={(e) => set({ cover: { ...cfg.cover, note: e.target.value } })} />
        <label style={lab}>صور الغلاف (لحد ٣، اضغط تختار — لو مختارتش حاجة بتتاخد تلقائي)</label>
        <Thumbs urls={allImgs.slice(0, 40)} on={cfg.cover.imgs} pick={(u) => set({ cover: { ...cfg.cover, imgs: cfg.cover.imgs.includes(u) ? cfg.cover.imgs.filter((x) => x !== u) : [...cfg.cover.imgs, u].slice(-3) } })} />
        <button type="button" className="secondary" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => { fileFor.current = 'cover'; file.current?.click(); }}>
          📷 ارفع صورة للغلاف
        </button>
      </Sec>

      <Sec title="🖼️ صور افتتاح الأقسام">
        {secNames.map((n) => {
          const sp = all.filter((p) => (p.section || 'منتجات متنوعة') === n);
          const cur = cfg.secImgs[n] || sp[0]?.imgs[0] || '';
          return (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid #e8eef0', padding: '8px 0', flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cur ? <img src={cur} alt="" style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 8 }} /> : <span>—</span>}
              <b style={{ flex: 1, minWidth: 120 }}>{n}</b>
              <button type="button" className="secondary" onClick={() => setPickSec(pickSec === n ? '' : n)}>اختار صورة</button>
              <button type="button" className="secondary" disabled={!!busy} onClick={() => { fileFor.current = n; file.current?.click(); }}>📷 ارفع</button>
              {pickSec === n && (
                <div style={{ width: '100%' }}>
                  <Thumbs urls={[...new Set(sp.flatMap((p) => p.imgs.filter((u) => u !== p.dimImg)))]} on={[cfg.secImgs[n] ?? '']} pick={(u) => { set({ secImgs: { ...cfg.secImgs, [n]: u } }); setPickSec(''); }} />
                </div>
              )}
            </div>
          );
        })}
      </Sec>

      <Sec title="📄 شكل صفحة المنتج">
        <p className="bz-note" style={{ marginTop: 0 }}>صفحة المنتج: صورة المنتج كبيرة وواضحة، وجنبها صورته وهو راكب (مثلًا درج راكب عليه المجرى)، وتحتهم كارت واحد فيه الوصف والمواصفات والمقاسات.</p>
        <label style={lab}>📷 صورة «في الاستخدام» لكل قسم (بتظهر على كل منتجات القسم، مثلًا: درج للمجاري، دولاب للمفصلات)</label>
        {secNames.map((n) => {
          const u = cfg.secUse[n] ?? '';
          return (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid #e8eef0', padding: '6px 0', flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {u ? <img src={u} alt="" style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ width: 70, textAlign: 'center', color: '#9aa9ad' }}>—</span>}
              <b style={{ flex: 1, minWidth: 120 }}>{n}</b>
              <button type="button" className="secondary" disabled={!!busy} onClick={() => { fileFor.current = `use:s:${n}`; file.current?.click(); }}>📷 ارفع</button>
              {u && <button type="button" className="secondary" onClick={() => { const x = { ...cfg.secUse }; delete x[n]; set({ secUse: x }); }}>شيلها</button>}
            </div>
          );
        })}
        <label style={lab}>📷 صورة حقيقية لمنتج معيّن (بتغلب صورة القسم) — دوّر بالاسم أو الكود</label>
        <input style={inp} value={useQ} placeholder="مثلًا: مجرى 45 أو P1003" onChange={(e) => setUseQ(e.target.value)} />
        {(useQ.trim() ? all.filter((p) => `${p.name} ${p.code}`.includes(useQ.trim())).slice(0, 8) : all.filter((p) => cfg.prodUse[p.code])).map((p) => {
          const u = cfg.prodUse[p.code] ?? '';
          return (
            <div key={p.code} style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid #e8eef0', padding: '6px 0', flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imgs[0]} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {u ? <img src={u} alt="" style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--primary,#087f8c)' }} /> : null}
              <span style={{ flex: 1, minWidth: 140 }}>{p.name} <small style={{ color: '#62767c' }}>({p.code})</small></span>
              <button type="button" className="secondary" disabled={!!busy} onClick={() => { fileFor.current = `use:p:${p.code}`; file.current?.click(); }}>📷 {u ? 'غيّر' : 'ارفع'}</button>
              {u && <button type="button" className="secondary" onClick={() => { const x = { ...cfg.prodUse }; delete x[p.code]; set({ prodUse: x }); }}>شيلها</button>}
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
          {(
            [
              ['tabs', 'تبويبات الأقسام على الجنب'],
              ['stock', 'علامة «متوفر»'],
              ['specs', 'جدول المواصفات'],
              ['gallery', 'صور إضافية'],
              ['toc', 'فهرس'],
              ['search', 'خانة البحث'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={cfg.flags[k]} onChange={(e) => setFlag(k, e.target.checked)} /> {l}
            </label>
          ))}
        </div>
        <label style={lab}>جملة الطلب في آخر الصفحة</label>
        <input style={inp} value={cfg.cta} onChange={(e) => set({ cta: e.target.value })} />
      </Sec>

      <Sec title="📖 حكاية ميكانيزم">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={cfg.flags.story} onChange={(e) => setFlag('story', e.target.checked)} /> صفحة الحكاية في أول الكتالوج
        </label>
        <label style={lab}>العنوان</label>
        <input style={inp} value={cfg.story.title} onChange={(e) => set({ story: { ...cfg.story, title: e.target.value } })} />
        <label style={lab}>النص (كل سطر فقرة)</label>
        <textarea style={{ ...inp, minHeight: 220 }} value={cfg.story.text} onChange={(e) => set({ story: { ...cfg.story, text: e.target.value } })} />
        <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => set({ story: { ...cfg.story, text: STORY_TEXT } })}>↩️ رجّع النص الأصلي</button>
      </Sec>

      <Sec title={`📚 المقالات والإرشادات (${cfg.articles.filter((x) => x.on).length} مقال شغال)`} open>
        <p style={{ fontSize: 13, color: 'var(--muted,#62767c)', margin: '0 0 8px' }}>
          إرشادات تركيب، دليل اختيار الميكانيزم قبل التصميم، ومقالات من عندك. أي مقال بيتحط في الكتالوج كصفحات حلوة، والنص الطويل بيتقسّم على صفحات لوحده. تقدر تعدّل وتمسح وتضيف.
        </p>
        <details style={{ fontSize: 13, background: '#f4f8f9', borderRadius: 10, padding: '6px 10px', marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>إزاي أكتب المقال؟</summary>
          <div style={{ lineHeight: 1.9 }}>
            سطر عادي = فقرة. <b>## عنوان</b> = عنوان فرعي. <b>1. نص</b> = خطوة مرقّمة. <b>- نص</b> = نقطة. <b>&gt; نص</b> = مربع نصيحة.
          </div>
        </details>
        {cfg.articles.map((a, i) => (
          <div key={a.id} style={{ border: '1px solid #dfe7ea', borderRadius: 12, padding: 10, marginBottom: 10, opacity: a.on ? 1 : 0.6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={a.on} onChange={(e) => setArt(a.id, { on: e.target.checked })} /> شغال
              </label>
              <input style={{ flex: 1, minWidth: 160, fontWeight: 800 }} value={a.title} placeholder="عنوان المقال" onChange={(e) => setArt(a.id, { title: e.target.value })} />
              <button type="button" className="secondary" disabled={i === 0} onClick={() => moveArt(a.id, -1)}>↑</button>
              <button type="button" className="secondary" disabled={i === cfg.articles.length - 1} onClick={() => moveArt(a.id, 1)}>↓</button>
              <button type="button" className="secondary" onClick={() => window.confirm('تمسح المقال ده؟') && setCfg((c) => ({ ...c, articles: c.articles.filter((x) => x.id !== a.id) }))}>🗑️</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <select value={a.kind} onChange={(e) => setArt(a.id, { kind: e.target.value })}>
                {['مقال', 'دليل الاختيار', 'تركيب', 'نصيحة', 'إرشادات', 'معلومة'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <select value={a.sec} onChange={(e) => setArt(a.id, { sec: e.target.value })}>
                <option value="">في أول الكتالوج</option>
                {secNames.map((n) => (
                  <option key={n} value={n}>بعد منتجات: {n}</option>
                ))}
                <option value="__end">في آخر الكتالوج</option>
              </select>
            </div>
            <textarea style={{ ...inp, minHeight: 170, marginTop: 6 }} value={a.body} placeholder="اكتب نص المقال هنا…" onChange={(e) => setArt(a.id, { body: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.img && <img src={a.img} alt="" style={{ width: 70, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
              <button type="button" className="secondary" disabled={!!busy} onClick={() => { fileFor.current = 'art:' + a.id; file.current?.click(); }}>📷 {a.img ? 'غيّر الصورة' : 'صورة في أول المقال'}</button>
              <button type="button" className="secondary" onClick={() => setPickSec(pickSec === 'art:' + a.id ? '' : 'art:' + a.id)}>اختار من صور المنتجات</button>
              {a.img && <button type="button" className="secondary" onClick={() => setArt(a.id, { img: '' })}>شيل الصورة</button>}
            </div>
            {pickSec === 'art:' + a.id && (
              <div style={{ marginTop: 6 }}>
                <Thumbs urls={allImgs.slice(0, 60)} on={[a.img ?? '']} pick={(u) => { setArt(a.id, { img: u }); setPickSec(''); }} />
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={() => setCfg((c) => ({ ...c, articles: [...c.articles, { id: 'a-' + Date.now().toString(36), on: true, kind: 'مقال', title: '', body: '', sec: '' }] }))}>➕ مقال جديد</button>
          <button type="button" className="secondary" onClick={() => window.confirm('ترجّع المقالات الافتراضية؟ هتتمسح تعديلاتك على المقالات.') && setCfg((c) => ({ ...c, articles: DEFAULT_ARTICLES }))}>↩️ رجّع المقالات الافتراضية</button>
        </div>
      </Sec>

      <Sec title="🗃️ حجم الكتالوج ومصدر المنتجات" open>
        <label style={lab}>المنتجات منين؟</label>
        <select value={cfg.source} onChange={(e) => set({ source: e.target.value as CatCfg['source'] })}>
          <option value="site">المنشورة على الموقع (بأوصافها وصورها)</option>
          <option value="stock">كل أصناف المخزن اللي ليها صور (للكتالوج الكبير)</option>
        </select>
        <label style={lab}>شكل عرض المنتجات</label>
        <select value={cfg.density} onChange={(e) => set({ density: e.target.value as CatCfg['density'] })}>
          <option value="auto">تلقائي: صفحة لكل منتج لو العدد صغير، وشبكة كروت لو كبير</option>
          <option value="full">صفحة كاملة لكل منتج</option>
          <option value="grid">شبكة كروت (والمنتجات المميزة ⭐ صفحة كاملة)</option>
        </select>
        <label style={lab}>عدد الكروت في الصفحة</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([4, 6, 9] as const).map((n) => (
            <button key={n} type="button" className={cfg.gridN === n ? 'primary' : 'secondary'} onClick={() => set({ gridN: n })}>
              {n} في الصفحة
            </button>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted,#62767c)' }}>
          المنتجات اللي ليها نفس الاسم بمقاسات مختلفة (مجرى ٣٠ / ٣٥ / ٤٠…) بتتجمع في كارت واحد بجدول مقاسات وأكواد. المنتج المميز ⭐ في الموقع بياخد صفحة كاملة.
        </p>
      </Sec>

      <Sec title="🧩 صفحات وإضافات احترافية">
        <div style={{ display: 'grid', gap: 8 }}>
          {(
            [
              ['qr', '📱 كود QR على كل منتج (يفتح واتساب والكود جاهز)'],
              ['icons', '🔇 أيقونات المميزات تلقائي (سوفت كلوز، سحب كامل، حمولة، بلد الصنع…)'],
              ['families', '📏 تجميع المقاسات في كارت واحد بجدول'],
              ['index', '🔤 فهرس المنتجات الأبجدي في الآخر'],
              ['codes', '#️⃣ فهرس الأكواد في الآخر'],
              ['secColors', '🎨 لون مختلف لكل قسم (التبويبات والشارات)'],
              ['showroom', '🏬 صفحة «معرضنا» بصور المعرض'],
              ['backQr', '💬 QR واتساب على الغلاف الأخير'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={cfg.extras[k]} onChange={(e) => set({ extras: { ...cfg.extras, [k]: e.target.checked } })} /> {l}
            </label>
          ))}
        </div>
        <label style={lab}>صور المعرض (لحد ٥)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {cfg.showroomImgs.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" title="اضغط تشيلها" onClick={() => set({ showroomImgs: cfg.showroomImgs.filter((x) => x !== u) })} style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }} />
          ))}
          <button type="button" className="secondary" disabled={!!busy || cfg.showroomImgs.length >= 5} onClick={() => { fileFor.current = 'showroom'; file.current?.click(); }}>📷 ارفع صورة من المعرض</button>
        </div>
        <label style={lab}>كلمة تحت اسم كل قسم في صفحة الافتتاح</label>
        {secNames.map((n) => (
          <div key={n} style={{ marginBottom: 6 }}>
            <small style={{ fontWeight: 700 }}>{n}</small>
            <input style={inp} value={cfg.secTexts[n] ?? ''} placeholder="مثلًا: حلول تنظيم وتخزين لكل ركن في المطبخ" onChange={(e) => set({ secTexts: { ...cfg.secTexts, [n]: e.target.value } })} />
          </div>
        ))}
      </Sec>

      <Sec title="📊 إحصائيات الكتالوج (العملاء بيعملوا إيه)">
        <button type="button" className="secondary" onClick={() => void loadStats()}>🔄 اعرض الإحصائيات</button>
        {stats && (() => {
          const days = Object.entries(stats.days).sort((x, y) => y[0].localeCompare(x[0])).slice(0, 14);
          const sum = (k: string) => Object.values(stats.days).reduce((t, d) => t + (d[k] ?? 0), 0);
          const top = (m: Record<string, number>) => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 10);
          const nm = (c: string) => all.find((p) => p.code === c)?.name ?? '';
          return (
            <div style={{ fontSize: 13.5, marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 6 }}>
                {[['open', '👀 مرات الفتح'], ['view', '📄 مشاهدة منتجات'], ['add', '➕ أضافوا للطلب'], ['cart', '💬 طلبات اتبعتت'], ['q', '🔍 عمليات بحث'], ['zoom', '🔍 تكبير صور']].map(([k, l]) => (
                  <div key={k} style={{ ...box, marginBottom: 0, textAlign: 'center' }}>
                    <b style={{ fontSize: 22, display: 'block' }}>{sum(k!)}</b>
                    {l}
                  </div>
                ))}
              </div>
              <b style={{ display: 'block', marginTop: 10 }}>أكتر المنتجات مشاهدة</b>
              {top(stats.views).map(([c, n]) => (<div key={c}>{n} × {c} {nm(c)}</div>))}
              <b style={{ display: 'block', marginTop: 10 }}>أكتر المنتجات اللي اتضافت للطلب</b>
              {top(stats.adds).map(([c, n]) => (<div key={c}>{n} × {c} {nm(c)}</div>))}
              <b style={{ display: 'block', marginTop: 10 }}>العملاء بيدوروا على إيه</b>
              {top(stats.q).map(([q, n]) => (<div key={q}>{n} × «{q}»</div>))}
              <b style={{ display: 'block', marginTop: 10 }}>آخر الأيام</b>
              {days.map(([d, m]) => (<div key={d}>{d}: فتح {m.open ?? 0} · مشاهدة {m.view ?? 0} · طلبات {m.cart ?? 0}</div>))}
            </div>
          );
        })()}
      </Sec>

      <Sec title="🗂️ الكتالوجات اللي اتنشرت">
        <button type="button" className="secondary" onClick={() => void loadPubs()}>🔄 اعرض اللي اتنشر</button>
        {pubs && (pubs.length ? pubs : []).map((x) => {
          const url = `${location.origin}/api/v1/web/public/catalog/${x.id}`;
          return (
            <div key={x.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #e8eef0', padding: '8px 0' }}>
              <span style={{ flex: 1, minWidth: 140 }}>{new Date(x.at).toLocaleString('ar-EG')} {x.current && <b style={{ color: '#0e7a3f' }}>· 🌐 على الموقع</b>}</span>
              <a className="secondary" style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={url} target="_blank" rel="noreferrer">↗️ افتح</a>
              <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(url).then(() => toast('✔ اتنسخ'))}>📋</button>
              {!x.current && <button type="button" className="secondary" onClick={() => void api.put('/web/catalog/current', { id: x.id }).then(() => { toast('✔ بقى هو اللي على الموقع'); setSiteLink(`${location.origin}/api/v1/web/public/catalog-latest`); void loadPubs(); }).catch((e) => toast(errorMessage(e), 'bad'))}>🌐 خليه على الموقع</button>}
              <button type="button" className="secondary" onClick={() => window.confirm('تمسح الكتالوج ده؟ اللينك بتاعه هيقف.') && void api.delete(`/web/catalog/${x.id}`).then(() => void loadPubs()).catch((e) => toast(errorMessage(e), 'bad'))}>🗑️</button>
            </div>
          );
        })}
        {pubs && !pubs.length && <p>لسه مفيش كتالوجات منشورة.</p>}
      </Sec>

      <Sec title="📦 إيه اللي يطلع في الكتالوج؟">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {secNames.map((n) => (
            <label key={n} style={{ display: 'flex', gap: 5, alignItems: 'center', border: '1px solid #dfe7ea', borderRadius: 99, padding: '4px 10px' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={!off.has(n)}
                onChange={(e) => {
                  const s = new Set(off);
                  if (e.target.checked) s.delete(n);
                  else s.add(n);
                  setOff(s);
                }}
              />{' '}
              {n}
            </label>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} /> المتوفر بس
        </label>
        <p style={{ fontSize: 13, color: 'var(--muted,#62767c)' }}>
          هيطلع <b>{picked.length}</b> منتج من {all.length} منشورين على الموقع بصور. المنتج الجديد لازم يتنشر على الموقع الأول عشان يظهر هنا.
        </p>
      </Sec>

      </div>
      </OpenSec.Provider>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--card,#fff)', borderTop: '1px solid #dfe7ea', padding: '10px 0', display: 'flex', gap: 8, flexWrap: 'wrap', zIndex: 5 }}>
        <button type="button" className="primary" id="catOpen" onClick={() => check() && setView(buildFlipbook(input(true), { close: true }))}>📖 افتح الكتالوج</button>
        <button type="button" className="secondary" disabled={!!busy} onClick={() => void save()}>💾 احفظ الإعدادات</button>
        <button type="button" className="secondary" onClick={() => check() && printHtml(buildProCatalog(input(true)))}>🖨️ PDF / طباعة</button>
        <button type="button" className="secondary" id="catPub" disabled={!!busy} onClick={() => void publish(false)}>{busy === 'pub' ? '⏳…' : '🔗 لينك للإرسال'}</button>
        <button type="button" className="primary" id="catSite" disabled={!!busy} onClick={() => void publish(true)}>{busy === 'site' ? '⏳…' : '🌐 انشره للعملاء على الموقع'}</button>
      </div>

      {siteLink && (
        <div style={{ ...box, background: '#eef6ff', marginTop: 10 }}>
          <b>🌐 منشور للعملاء:</b> زرار الكتالوج على الموقع بيفتح آخر كتالوج نشرته (بنفس التقليب، وفيه تحميل PDF).
          <input readOnly value={siteLink} dir="ltr" style={{ ...inp, marginTop: 6 }} onFocus={(e) => e.target.select()} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <a className="secondary" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={siteLink} target="_blank" rel="noreferrer">↗️ افتحه</a>
            <button type="button" className="secondary" onClick={() => void unpublishSite()}>🚫 شيله من الموقع</button>
          </div>
        </div>
      )}

      {link && (
        <div style={{ ...box, background: '#e9f7ef', marginTop: 10 }}>
          <b>✔ لينك للإرسال جاهز:</b>
          <input readOnly value={link} dir="ltr" style={{ ...inp, marginTop: 6 }} onFocus={(e) => e.target.select()} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(link).then(() => toast('✔ اتنسخ'))}>📋 انسخ</button>
            <a className="secondary" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">💬 ابعته واتساب</a>
            <a className="secondary" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={link} target="_blank" rel="noreferrer">↗️ افتحه</a>
          </div>
        </div>
      )}

      {view && (
        <div id="catViewer" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#12191b' }}>
          <iframe title="الكتالوج" srcDoc={view} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', width: '100%', height: 'calc(100% - env(safe-area-inset-bottom, 0px))', border: 0, background: '#12191b' }} />
          <button type="button" id="catClose" aria-label="إغلاق الكتالوج" onClick={() => setView('')} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', right: 10, width: 40, height: 40, borderRadius: 99, border: '2px solid #fff', background: '#000c', color: '#fff', fontSize: 20, fontWeight: 900, lineHeight: 1, cursor: 'pointer', zIndex: 2, padding: 0 }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
