'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { uploadSiteImage } from '@/components/modals/site-admin';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { buildFlipbook, buildProCatalog, COLOR_PRESETS, DEFAULT_CFG, FONTS, GIFT_MESSAGE, mergeCfg, STORY_TEXT, type CatCfg, type CatInput, type CatProduct } from '@/lib/catalog-pro';
import { printHtml } from '@/lib/print';
import { useAllProducts } from '@/lib/trade-queries';
import { fetchSite, saveSite } from '@/lib/web-queries';

/** 🌟 استوديو الكتالوج: كل اختيارات الشكل والمحتوى، معاينة كتاب بيتقلّب، PDF، ولينك للإرسال (هدية لشخص أو نسخة ميكانيزم). */
const box: React.CSSProperties = { border: '1px solid var(--border,#dfe7ea)', borderRadius: 14, padding: 12, marginBottom: 10, background: 'var(--card,#fff)' };
const lab: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted,#62767c)', margin: '8px 0 4px' };
const inp: React.CSSProperties = { width: '100%' };

function Sec({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} style={box}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>{title}</summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
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
  const [busy, setBusy] = useState('');
  const [link, setLink] = useState('');
  const [siteLink, setSiteLink] = useState('');
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
  const all: CatProduct[] = useMemo(
    () =>
      (data?.products ?? [])
        .filter((p) => p.imgs?.length)
        .map((p) => ({
          code: String(p.code || ''),
          name: p.name || String(p.code),
          desc: p.desc,
          imgs: p.imgs,
          dimImg: String((p as unknown as Record<string, unknown>).dimImg ?? ''),
          section: secName[p.sec] ?? '',
          inStock: (qty.get(String(p.code)) ?? 0) > 0,
        })),
    [data, secName, qty],
  );
  const secNames = useMemo(() => [...new Set(all.map((p) => p.section || 'منتجات متنوعة'))], [all]);
  const picked = all.filter((p) => !off.has(p.section || 'منتجات متنوعة') && (!stockOnly || p.inStock));
  const set = (x: Partial<CatCfg>) => setCfg((c) => ({ ...c, ...x }));
  const setFlag = (k: keyof CatCfg['flags'], v: boolean) => setCfg((c) => ({ ...c, flags: { ...c.flags, [k]: v } }));
  const abs = (u: string) => (u && u.startsWith('/') ? `${location.origin}${u}` : u);

  const input = (absolute: boolean): CatInput => {
    const f = absolute ? abs : (u: string) => u;
    const c: CatCfg = { ...cfg, secImgs: Object.fromEntries(Object.entries(cfg.secImgs).map(([k, v]) => [k, f(v)])), cover: { ...cfg.cover, imgs: cfg.cover.imgs.map(f) }, gift: mode === 'gift' && gift.name.trim() ? { ...gift } : undefined };
    return {
      shop: 'ميكانيزم',
      tagline: String((data as Record<string, unknown> | undefined)?.tagline ?? ''),
      phones: (data as { phones?: string[] } | undefined)?.phones ?? [],
      address: String((data as Record<string, unknown> | undefined)?.address ?? ''),
      cfg: c,
      products: picked.map((p) => ({ ...p, imgs: p.imgs.map(f), dimImg: p.dimImg ? f(p.dimImg) : '' })),
    };
  };

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
      const { id } = await api.post<{ id: string }>('/web/catalog', { html: buildFlipbook(input(false), { pdfUrl: '__PDF__' }), print: buildProCatalog(input(false), { autoPrint: true }), current });
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
      if (fileFor.current === 'cover') set({ cover: { ...cfg.cover, imgs: [url, ...cfg.cover.imgs].slice(0, 3) } });
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
      <p className="bz-note">اعمل كتالوج احترافي بصور كاملة وكتل ألوان وتبويبات للأقسام، وابعته بلينك للعميل أو هدية لشخص ببرقية. مفيش أسعار فيه.</p>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />

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
        <label style={lab}>التصميم</label>
        <select value={cfg.layout} onChange={(e) => set({ layout: e.target.value as CatCfg['layout'] })}>
          <option value="auto">تلقائي (بينوّع بين التصاميم التلاتة)</option>
          <option value="1">١ — صورة كاملة وكتلة لون بزاوية</option>
          <option value="2">٢ — كتلة داكنة وصورة طالعة منها وشريط صور</option>
          <option value="3">٣ — نصف صورة ولوح داكن</option>
        </select>
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
          <iframe title="الكتالوج" srcDoc={view} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#12191b' }} />
          <button type="button" id="catClose" aria-label="إغلاق الكتالوج" onClick={() => setView('')} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', right: 10, width: 40, height: 40, borderRadius: 99, border: '2px solid #fff', background: '#000c', color: '#fff', fontSize: 20, fontWeight: 900, lineHeight: 1, cursor: 'pointer', zIndex: 2, padding: 0 }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
