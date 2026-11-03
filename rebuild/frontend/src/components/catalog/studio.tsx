'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { uploadSiteImage } from '@/components/modals/site-admin';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { buildFlipbook, buildProCatalog, COLOR_PRESETS, DEFAULT_CFG, GIFT_MESSAGE, mergeCfg, STORY_TEXT, type CatCfg, type CatInput, type CatProduct } from '@/lib/catalog-pro';
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
  const [pickSec, setPickSec] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const fileFor = useRef<string>('');

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
  const publish = async () => {
    if (!check()) return;
    setBusy('pub');
    try {
      const { id } = await api.post<{ id: string }>('/web/catalog', { html: buildFlipbook(input(false)) });
      setLink(`${location.origin}/api/v1/web/public/catalog/${id}`);
      toast('✔ اتعمل اللينك');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
    setBusy('');
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

      <Sec title="🎨 الألوان">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLOR_PRESETS.map((p) => (
            <button key={p.name} type="button" className="secondary" style={{ padding: '4px 10px', display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => set({ colors: { main: p.main, dark: p.dark, accent: p.accent } })}>
              <i style={{ width: 14, height: 14, borderRadius: 4, background: p.main, display: 'inline-block' }} />
              <i style={{ width: 14, height: 14, borderRadius: 4, background: p.dark, display: 'inline-block' }} />
              <i style={{ width: 14, height: 14, borderRadius: 4, background: p.accent, display: 'inline-block' }} /> {p.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {(
            [
              ['main', 'اللون الأساسي (الكتل)'],
              ['dark', 'اللون الغامق (الخلفيات)'],
              ['accent', 'لون التمييز (الذهبي)'],
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

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--card,#fff)', borderTop: '1px solid #dfe7ea', padding: '10px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="secondary" disabled={!!busy} onClick={() => void save()}>💾 احفظ الإعدادات</button>
        <button type="button" className="primary" id="catPreview" onClick={() => check() && setView(buildFlipbook(input(true)))}>👀 معاينة الكتاب</button>
        <button type="button" className="secondary" onClick={() => check() && printHtml(buildProCatalog(input(true)))}>🖨️ PDF / طباعة</button>
        <button type="button" className="primary" id="catPub" disabled={!!busy} onClick={() => void publish()}>{busy === 'pub' ? '⏳…' : '🔗 اعمل لينك للإرسال'}</button>
      </div>

      {link && (
        <div style={{ ...box, background: '#e9f7ef', marginTop: 10 }}>
          <b>✔ اللينك جاهز:</b>
          <input readOnly value={link} dir="ltr" style={{ ...inp, marginTop: 6 }} onFocus={(e) => e.target.select()} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(link).then(() => toast('✔ اتنسخ'))}>📋 انسخ</button>
            <a className="secondary" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">💬 ابعته واتساب</a>
            <a className="secondary" style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cfdcdf' }} href={link} target="_blank" rel="noreferrer">↗️ افتحه</a>
          </div>
        </div>
      )}

      {view && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#000c', display: 'flex', flexDirection: 'column' }}>
          <button type="button" className="secondary" onClick={() => setView('')} style={{ margin: 8, alignSelf: 'flex-start' }}>✕ إغلاق المعاينة</button>
          <iframe title="معاينة الكتالوج" srcDoc={view} sandbox="allow-scripts" style={{ flex: 1, border: 0, background: '#fff' }} />
        </div>
      )}
    </div>
  );
}
