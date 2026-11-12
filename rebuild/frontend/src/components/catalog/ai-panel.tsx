'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { AiInfo, CatProduct } from '@/lib/catalog-pro';
import { WebPhotos } from './web-photos';

interface AiOut extends AiInfo {
  textError?: string;
  imgError?: string;
}

/**
 * 🤖 صورة للقطعة وهي راكبة + وصف + مقاسات التركيب من مواقع الشركات (Gemini) — لمنتج واحد أو لكل المنتجات مرة واحدة.
 * النتيجة بتتحفظ في إعدادات الكتالوج (cfg.ai) وصفحة المنتج بتستخدمها لوحدها.
 */
export function CatalogAi({ products, ai, setAi, saveNow, photos, setPhotos }: { products: CatProduct[]; ai: Record<string, AiInfo>; setAi: (code: string, v: AiInfo | null) => void; saveNow: () => Promise<void>; photos: Record<string, string[]>; setPhotos: (code: string, v: string[]) => void }) {
  const toast = useToast();
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [keyIn, setKeyIn] = useState('');
  const [serper, setSerper] = useState(false);
  const [serperIn, setSerperIn] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [open, setOpen] = useState('');
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    api.get<{ set: boolean; cf?: boolean; serper?: boolean }>('/web/catalog/ai/key').then((r) => { setKeySet(r.set); setSerper(!!r.serper); }).catch(() => setKeySet(false));
  }, []);

  const saveKey = async () => {
    try {
      const r = await api.put<{ set: boolean }>('/web/catalog/ai/key', { key: keyIn.trim() });
      setKeySet(r.set);
      setKeyIn('');
      toast(r.set ? '✔ اتحفظ المفتاح' : 'اتشال المفتاح');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  // النتيجة: got = اتعمل حاجة واتحفظت للمنتج (حتى لو جزء منها فشل، زي الصورة)
  const saveSerper = async () => {
    try {
      const r = await api.put<{ serper: boolean }>('/web/catalog/ai/serper', { key: serperIn });
      setSerper(r.serper);
      setSerperIn('');
      toast('✔ صور النت اشتغلت');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const one = async (p: CatProduct, single = false): Promise<{ got: boolean; err: boolean }> => {
    setBusy((b) => ({ ...b, [p.code]: true }));
    setErrs((x) => ({ ...x, [p.code]: '' }));
    try {
      const req = () => api.post<AiOut & { pending?: boolean }>('/web/catalog/ai/product', { code: p.code, name: p.name, section: p.section ?? '', desc: (p.desc ?? '').slice(0, 3000), img: p.imgs.find((u) => u !== p.dimImg) ?? '' });
      // السيرفر بيكمّل الشغل في الخلفية لو طوّل: نسأله تاني لحد ما يخلص
      let r = await req();
      for (let n = 0; r.pending && n < 8; n++) {
        await new Promise((x) => setTimeout(x, 10000));
        r = await req();
      }
      const old = ai[p.code];
      const got: AiInfo = { desc: r.desc || old?.desc || '', features: r.features.length ? r.features : (old?.features ?? []), specs: r.specs.length ? r.specs : (old?.specs ?? []), img: r.img || old?.img || '', sources: r.sources, searched: r.desc || r.specs.length ? !!r.searched : old?.searched, at: new Date().toISOString() };
      const err = [r.textError && `الوصف والمقاسات: ${r.textError}`, r.imgError && `الصورة: ${r.imgError}`].filter(Boolean).join(' — ');
      if (err) setErrs((x) => ({ ...x, [p.code]: err }));
      const has = !!(r.desc || r.img || r.specs.length);
      if (has) setAi(p.code, got);
      setOpen(p.code);
      if (single && has) {
        await new Promise((x) => setTimeout(x, 80));
        await saveNow().then(() => toast('✔ اتعمل واتحفظ — هيظهر في صفحة المنتج في الكتالوج')).catch((e) => toast(errorMessage(e), 'bad'));
      }
      return { got: has, err: !!err };
    } catch (e) {
      setErrs((x) => ({ ...x, [p.code]: errorMessage(e) }));
      return { got: false, err: true };
    } finally {
      setBusy((b) => ({ ...b, [p.code]: false }));
    }
  };

  const todo = products.filter((p) => !ai[p.code]);
  const all = async () => {
    stop.current = false;
    const list = todo;
    setRun({ done: 0, total: list.length });
    let fails = 0;
    let made = 0;
    for (let i = 0; i < list.length && !stop.current; i++) {
      const r = await one(list[i]!);
      const ok = r.got;
      if (ok) made++;
      else fails++;
      setRun({ done: i + 1, total: list.length });
      // لو ٣ ورا بعض فشلوا (غالبًا الحصة خلصت) نقف
      if (fails >= 3 && !ok) {
        toast('وقفنا: ٣ منتجات فشلوا، شوف السبب تحت المنتج', 'bad');
        break;
      }
      if (ok) fails = 0;
      if ((i + 1) % 3 === 0) {
        await new Promise((r) => setTimeout(r, 80));
        await saveNow().catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 80));
    await saveNow().catch(() => {});
    setRun(null);
    if (made) toast(`✔ اتعمل لـ ${made} منتج واتحفظ — هيظهر في صفحات المنتجات في الكتالوج`);
    else toast('مفيش حاجة اتعملت — شوف السبب المكتوب تحت المنتجات', 'bad');
  };

  const t = q.trim();
  const shown = (t ? products.filter((p) => `${p.name} ${p.code}`.includes(t)) : products).slice(0, 30);
  const sm = { fontSize: 13, color: 'var(--muted,#62767c)' } as const;

  if (keySet === null) return <p>⏳</p>;
  return (
    <div>
      <p className="bz-note" style={{ marginTop: 0 }}>
        الأداة بتبص على صورة المنتج واسمه وبتعمل لوحدها <b>وصف احترافي</b> و<b>مقاسات التركيب</b>، وبتجيبلك <b>صور حقيقية شبه المنتج من النت</b> تختار منها من مواقع الشركات (عرض العلبة، مقاس الضلفة، العمق، الحمولة…). كل حاجة بتظهر في صفحة المنتج في الكتالوج على طول.
      </p>
      {!keySet ? (
        <div style={{ background: '#fff8e6', border: '1px solid #f5d38a', borderRadius: 12, padding: 12 }}>
          <b>محتاج مفتاح Gemini مرة واحدة بس (مجاني):</b>
          <ol style={{ margin: '6px 0', paddingInlineStart: 20, fontSize: 14, lineHeight: 1.9 }}>
            <li>افتح <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> بحساب جوجل بتاعك.</li>
            <li>دوس «Create API key» وانسخ المفتاح.</li>
            <li>الزقه هنا ودوس حفظ.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" autoComplete="off" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} placeholder="الزق المفتاح هنا" style={{ flex: 1 }} />
            <button type="button" className="primary" disabled={!keyIn.trim()} onClick={() => void saveKey()}>💾 حفظ</button>
          </div>
        </div>
      ) : (
        <>
          {!serper ? (
            <div style={{ background: '#eef6ff', border: '1px solid #b9d6f5', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <b>🖼️ صور حقيقية للمنتج من النت (٢٥٠٠ بحث ببلاش، من غير فيزا) — مرة واحدة بس:</b>
              <ol style={{ margin: '6px 0', paddingInlineStart: 20, fontSize: 14, lineHeight: 1.9 }}>
                <li>افتح <a href="https://serper.dev/signup" target="_blank" rel="noreferrer">serper.dev/signup</a> وادخل بحساب جوجل.</li>
                <li>من القايمة دوس «API Key» وانسخ المفتاح.</li>
                <li>الزقه هنا ودوس حفظ.</li>
              </ol>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="password" autoComplete="off" value={serperIn} onChange={(e) => setSerperIn(e.target.value)} placeholder="الزق مفتاح Serper هنا" style={{ flex: 1 }} />
                <button type="button" className="primary" disabled={!serperIn.trim()} onClick={() => void saveSerper()}>💾 حفظ</button>
              </div>
            </div>
          ) : (
            <p style={{ ...sm, margin: '0 0 8px' }}>🖼️ صور النت شغالة ✔ — دوس «🖼️ صور من النت» على أي منتج واختار الصور الشبهه</p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {run ? (
              <>
                <b>⏳ شغالين: {run.done} / {run.total}</b>
                <button type="button" className="secondary" onClick={() => (stop.current = true)}>⏹️ وقّف</button>
              </>
            ) : (
              <button type="button" className="primary" disabled={!todo.length} onClick={() => void all()}>
                ✨ اعمل لكل المنتجات اللي لسه ({todo.length})
              </button>
            )}
            <span style={sm}>اتعمل لـ {products.length - todo.length} من {products.length}</span>
          </div>
          <p style={{ ...sm, margin: '6px 0' }}>كل منتج بياخد حوالي نص دقيقة. الحصة المجانية لجوجل محدودة في اليوم، فلو وقف كمّل بكرة من نفس المكان.</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 دوّر على منتج بالاسم أو الكود" style={{ width: '100%', margin: '6px 0' }} />
          {shown.map((p) => {
            const a = ai[p.code];
            return (
              <div key={p.code} style={{ borderTop: '1px solid #e8eef0', padding: '8px 0' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imgs[0]} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a?.img ? <img src={a.img} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--primary,#087f8c)' }} /> : null}
                  <span style={{ flex: 1, minWidth: 140 }}>
                    {p.name} <small style={sm}>({p.code})</small> {a ? <b style={{ color: '#0e7a3f' }}>✔</b> : null}
                  </span>
                  <button type="button" className={a ? 'secondary' : 'primary'} disabled={!!busy[p.code] || !!run} onClick={() => void one(p, true)}>
                    {busy[p.code] ? '⏳ بيشتغل…' : a ? '🔁 اعمل تاني' : '✨ اعمل'}
                  </button>
                  {serper && (
                    <WebPhotos
                      p={p}
                      have={photos[p.code] ?? []}
                      onSave={async (v) => {
                        setPhotos(p.code, v);
                        await new Promise((x) => setTimeout(x, 80));
                        await saveNow().catch((e) => toast(errorMessage(e), 'bad'));
                      }}
                    />
                  )}
                  {a && (
                    <button type="button" className="secondary" onClick={() => setOpen(open === p.code ? '' : p.code)}>
                      👁️ شوف
                    </button>
                  )}
                </div>
                {errs[p.code] && <p style={{ color: '#b4382b', fontSize: 13, margin: '4px 0 0' }}>⚠️ {errs[p.code]}</p>}
                {a && open === p.code && (
                  <div style={{ background: '#f6f9fb', borderRadius: 12, padding: 10, marginTop: 6, fontSize: 14, lineHeight: 1.8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a.img && <img src={a.img} alt="" style={{ width: '100%', maxWidth: 420, borderRadius: 12, display: 'block', marginBottom: 6 }} />}
                    {a.desc && <p style={{ margin: '0 0 6px' }}>{a.desc}</p>}
                    {a.features.length > 0 && <ul style={{ margin: '0 0 6px', paddingInlineStart: 18 }}>{a.features.map((f) => <li key={f}>{f}</li>)}</ul>}
                    {a.specs.length > 0 && (
                      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 420 }}>
                        <tbody>
                          {a.specs.map((s) => (
                            <tr key={s.k}>
                              <td style={{ color: '#62767c', padding: '2px 4px', borderBottom: '1px solid #e3eaee' }}>{s.k}</td>
                              <td style={{ fontWeight: 800, padding: '2px 4px', borderBottom: '1px solid #e3eaee' }}>{s.v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {a.sources && a.sources.length > 0 && <p style={{ ...sm, margin: '6px 0 0' }}>المصادر: {a.sources.length} موقع</p>}
                    {a.searched === false && (a.specs.length > 0 || a.desc) && <p style={{ color: '#b26a00', fontSize: 13, margin: '6px 0 0' }}>⚠️ المقاسات دي من معلومات الذكاء الاصطناعي من غير بحث على النت (البحث محتاج تفعيل الدفع في جوجل) — راجعها قبل النشر.</p>}
                    <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setAi(p.code, null)}>🗑️ شيل اللي اتعمل للمنتج ده</button>
                  </div>
                )}
              </div>
            );
          })}
          {!t && products.length > 30 && <p style={sm}>بيظهر أول ٣٠ — دوّر بالاسم أو الكود تلاقي الباقي.</p>}
          <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => { setKeyIn(''); void api.put('/web/catalog/ai/key', { key: '' }).then(() => setKeySet(false)).catch((e) => toast(errorMessage(e), 'bad')); }}>
            🔑 غيّر المفتاح
          </button>
        </>
      )}
    </div>
  );
}
