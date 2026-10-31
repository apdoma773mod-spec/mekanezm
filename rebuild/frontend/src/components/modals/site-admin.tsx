'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { fetchSite, saveSite, type SiteData, type SiteDoc } from '@/lib/web-queries';
import { useProduct } from '@/lib/trade-queries';
import { useModal } from './modal-host';

/** 🌐 محتوى الموقع (openSiteAdmin القديمة) + 🌐 «على الموقع» للصنف (openSiteProduct). */
const SHOP_URL = 'https://apdoma773mod-spec.github.io/mekanezm/shop.html';
const uid7 = () => Math.random().toString(36).slice(2, 9);
const TABS = [
  ['works', '🏗️ أعمالنا'],
  ['reviews', '⭐ آراء العملاء'],
  ['delivery', '🚚 التوصيل والاستبدال'],
  ['contact', '📞 التواصل'],
  ['seo', '🔍 جوجل'],
] as const;
type Tab = (typeof TABS)[number][0];

/** A picked photo is shrunk to 1400 px and stored as a file; the site shows it by its link. */
export async function uploadSiteImage(f: File): Promise<string> {
  const data = await fileToDataUrl(f, 1400);
  return (await api.post<{ url: string }>('/work/files', { data, ext: 'jpg' })).url;
}

function ImgsEditor({ imgs, onChange }: { imgs: string[]; onChange: (v: string[]) => void }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const pick = async (fs: File[]) => {
    const out = [...imgs];
    for (let k = 0; k < fs.length; k++) {
      setMsg(`⏳ جاري رفع الصورة ${k + 1} من ${fs.length}…`);
      try {
        out.push(await uploadSiteImage(fs[k]));
        onChange([...out]);
      } catch (e) {
        toast(`صورة مارفعتش: ${errorMessage(e)}`, 'bad');
      }
    }
    setMsg('');
  };
  return (
    <div>
      <div className="sp-imgs">
        {imgs.length ? (
          imgs.map((u, i) => (
            <div key={u + i} className={i ? '' : 'main'}>
              <img src={u} alt="" loading="lazy" />
              <button type="button" className="x" onClick={() => onChange(imgs.filter((_, k) => k !== i))}>
                ✕
              </button>
              {i ? (
                <button type="button" className="m" title="خليها الصورة الأساسية" onClick={() => onChange([imgs[i], ...imgs.filter((_, k) => k !== i)])}>
                  ⭐
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <small style={{ color: 'var(--muted)' }}>مفيش صور لسه</small>
        )}
      </div>
      <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => file.current?.click()}>
        ＋ إضافة صور
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])];
          e.target.value = '';
          if (fs.length) void pick(fs);
        }}
      />
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{msg}</div>
    </div>
  );
}

const rowStyle = { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' } as const;

export function SiteAdmin({ tab: first = 'works', onClose }: { tab?: Tab; onClose: () => void }) {
  const toast = useToast();
  const { open } = useModal();
  const [tab, setTab] = useState<Tab>(first);
  const [doc, setDoc] = useState<SiteDoc | null>(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ kind: 'work' | 'review'; i: number } | null>(null);
  const reload = () =>
    fetchSite()
      .then(setDoc)
      .catch((e) => setErr(errorMessage(e)));
  useEffect(() => {
    void reload();
  }, []);

  const save = async (mut: (d: SiteData) => void, ok = '✔ اتحفظ على الموقع') => {
    try {
      setDoc(await saveSite(mut));
      toast(ok);
      return true;
    } catch (e) {
      toast(errorMessage(e), 'bad');
      return false;
    }
  };

  if (err) return <Modal title="🌐 محتوى الموقع" onClose={onClose}><ErrorBox message={err} onRetry={() => { setErr(''); void reload(); }} /></Modal>;
  if (!doc) return <Modal title="🌐 محتوى الموقع" onClose={onClose}><Loading /></Modal>;
  const d = doc.data;

  if (edit?.kind === 'work') return <WorkEditor w={edit.i > -1 ? d.works![edit.i] : { id: uid7(), title: '', desc: '', imgs: [] }} onBack={() => setEdit(null)} save={save} />;
  if (edit?.kind === 'review') return <ReviewEditor r={edit.i > -1 ? d.reviews![edit.i] : { id: uid7(), name: '', area: '', stars: 5, text: '' }} onBack={() => setEdit(null)} save={save} />;

  const del = async (key: 'works' | 'reviews', i: number) => {
    if (!window.confirm('حذف من الموقع؟')) return;
    await save((x) => {
      (x[key] as unknown[]).splice(i, 1);
    }, 'اتحذف');
  };

  return (
    <Modal title="🌐 محتوى الموقع" onClose={onClose} wide>
      <div className="btnrow" style={{ marginBottom: 12 }}>
        <button type="button" className="secondary" data-spn onClick={() => open({ kind: 'siteProduct' })}>
          ➕ منتج جديد
        </button>
        {TABS.map(([k, t]) => (
          <button key={k} type="button" className={k === tab ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'works' && (
        <>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>صور مطابخ ودريسنج ركّبتوا فيها منتجاتكم — أكتر حاجة بتبني ثقة العميل.</p>
          {(d.works ?? []).map((w, i) => (
            <div key={w.id} style={rowStyle}>
              {w.imgs?.[0] ? <img src={w.imgs[0]} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{w.title}</b>
                <br />
                <small style={{ color: 'var(--muted)' }}>{(w.imgs ?? []).length} صور</small>
              </div>
              <button type="button" className="secondary" onClick={() => setEdit({ kind: 'work', i })}>
                تعديل
              </button>
              <button type="button" className="secondary danger" onClick={() => del('works', i)}>
                حذف
              </button>
            </div>
          ))}
          {!(d.works ?? []).length && <div className="empty">لسه مفيش أعمال</div>}
          <button type="button" className="primary" style={{ marginTop: 12 }} onClick={() => setEdit({ kind: 'work', i: -1 })}>
            ＋ شغلانة جديدة
          </button>
        </>
      )}

      {tab === 'reviews' && (
        <>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>اكتب آراء عملاء حقيقيين (بإذنهم). بتظهر في الصفحة الرئيسية.</p>
          {(d.reviews ?? []).map((r, i) => (
            <div key={r.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{r.name}</b> <span style={{ color: '#f5a623' }}>{'★'.repeat(+r.stars || 5)}</span>
                <br />
                <small style={{ color: 'var(--muted)' }}>{String(r.text || '').slice(0, 80)}</small>
              </div>
              <button type="button" className="secondary" onClick={() => setEdit({ kind: 'review', i })}>
                تعديل
              </button>
              <button type="button" className="secondary danger" onClick={() => del('reviews', i)}>
                حذف
              </button>
            </div>
          ))}
          {!(d.reviews ?? []).length && <div className="empty">لسه مفيش آراء</div>}
          <button type="button" className="primary" style={{ marginTop: 12 }} onClick={() => setEdit({ kind: 'review', i: -1 })}>
            ＋ رأي جديد
          </button>
        </>
      )}

      {tab === 'delivery' && <DeliveryTab key={doc.version} d={d} save={save} />}
      {tab === 'contact' && <ContactTab key={doc.version} d={d} save={save} />}

      {tab === 'seo' && (
        <>
          <p style={{ lineHeight: 1.9, marginTop: 0 }}>كل منتج على الموقع بقى ليه رابط خاص (زي <span dir="ltr">shop.html?p=...</span>) فيه اسمه ووصفه وصورته — جوجل يقدر يقرأه ويظهره في البحث.</p>
          <p style={{ lineHeight: 1.9 }}>عشان جوجل يعرف كل الروابط: نزّل الملف ده وارفعه جنب shop.html، وبعدين قدّمه في Google Search Console — وكرّرها كل ما تضيف منتجات كتير جديدة.</p>
          <div className="btnrow">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const day = new Date().toISOString().slice(0, 10);
                const urls = [SHOP_URL, ...d.products.map((p) => `${SHOP_URL}?p=${encodeURIComponent(p.id)}`)];
                const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
                a.download = 'sitemap.xml';
                a.click();
                toast('✔ اتنزل sitemap.xml — ارفعه جنب shop.html');
              }}
            >
              ⬇️ تنزيل sitemap.xml
            </button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
            المنتجات المنشورة دلوقتي: <b>{d.products.length}</b>
          </p>
        </>
      )}
      <p style={{ margin: '14px 0 0' }}>
        <a href={SHOP_URL} target="_blank" rel="noopener">
          ↗️ افتح الموقع
        </a>
      </p>
    </Modal>
  );
}

type Save = (mut: (d: SiteData) => void, ok?: string) => Promise<boolean>;

function WorkEditor({ w: w0, onBack, save }: { w: NonNullable<SiteData['works']>[number]; onBack: () => void; save: Save }) {
  const toast = useToast();
  const [w, setW] = useState(w0);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const t = w.title.trim();
    if (!t) return toast('اكتب العنوان', 'bad');
    if (!w.imgs.length) return toast('ضيف صورة واحدة على الأقل', 'bad');
    setBusy(true);
    const ok = await save((d) => {
      d.works = d.works ?? [];
      const k = d.works.findIndex((x) => x.id === w.id);
      const v = { ...w, title: t, desc: (w.desc ?? '').trim() };
      if (k > -1) d.works[k] = v;
      else d.works.unshift(v);
    }, '✔ اتحفظ');
    setBusy(false);
    if (ok) onBack();
  };
  return (
    <Modal title={`🏗️ ${w0.title ? 'تعديل شغلانة' : 'شغلانة جديدة'}`} onClose={onBack}>
      <div className="form">
        <div className="field full">
          <label>العنوان</label>
          <input value={w.title} placeholder="مثلاً: مطبخ أكريليك — الشيخ زايد" onChange={(e) => setW({ ...w, title: e.target.value })} />
        </div>
        <div className="field full">
          <label>وصف قصير (اختياري)</label>
          <input value={w.desc ?? ''} placeholder="مثلاً: مفصلات بلوم + مجر سفلي سوفت كلوز" onChange={(e) => setW({ ...w, desc: e.target.value })} />
        </div>
        <div className="field full">
          <label>الصور (أول صورة هي الغلاف)</label>
          <ImgsEditor imgs={w.imgs} onChange={(imgs) => setW((x) => ({ ...x, imgs }))} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={busy} onClick={go}>
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          رجوع
        </button>
      </div>
    </Modal>
  );
}

function ReviewEditor({ r: r0, onBack, save }: { r: NonNullable<SiteData['reviews']>[number]; onBack: () => void; save: Save }) {
  const toast = useToast();
  const [r, setR] = useState(r0);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!r.name.trim() || !r.text.trim()) return toast('اكتب الاسم والرأي', 'bad');
    setBusy(true);
    const ok = await save((d) => {
      d.reviews = d.reviews ?? [];
      const k = d.reviews.findIndex((x) => x.id === r.id);
      const v = { ...r, name: r.name.trim(), area: (r.area ?? '').trim(), text: r.text.trim() };
      if (k > -1) d.reviews[k] = v;
      else d.reviews.unshift(v);
    }, '✔ اتحفظ');
    setBusy(false);
    if (ok) onBack();
  };
  return (
    <Modal title={`⭐ ${r0.name ? 'تعديل رأي' : 'رأي جديد'}`} onClose={onBack}>
      <div className="form">
        <div className="field">
          <label>اسم العميل</label>
          <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </div>
        <div className="field">
          <label>المنطقة (اختياري)</label>
          <input value={r.area ?? ''} onChange={(e) => setR({ ...r, area: e.target.value })} />
        </div>
        <div className="field">
          <label>التقييم</label>
          <select value={r.stars} onChange={(e) => setR({ ...r, stars: +e.target.value })}>
            {[5, 4, 3].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>الرأي</label>
          <textarea rows={4} value={r.text} style={{ padding: 11, border: '1px solid var(--border)', borderRadius: 10 }} onChange={(e) => setR({ ...r, text: e.target.value })} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={busy} onClick={go}>
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          رجوع
        </button>
      </div>
    </Modal>
  );
}

function DeliveryTab({ d, save }: { d: SiteData; save: Save }) {
  const [note, setNote] = useState(d.deliveryNote ?? '');
  const [loc, setLoc] = useState({ fee: d.shipLocal?.fee ?? '', days: d.shipLocal?.days ?? '', note: d.shipLocal?.note ?? '' });
  const [gov, setGov] = useState({ fee: d.shipGov?.fee ?? '', days: d.shipGov?.days ?? '', note: d.shipGov?.note ?? '' });
  const [rows, setRows] = useState(d.delivery?.length ? d.delivery : [{ area: '', fee: '', days: '' }]);
  const [pol, setPol] = useState(d.policy ?? '');
  const [busy, setBusy] = useState(false);
  const upd = (i: number, k: 'area' | 'fee' | 'days', v: string) => setRows((R) => R.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <div className="field">
        <label>جملة عن التوصيل (اختياري)</label>
        <input value={note} placeholder="مثلاً: بنوصّل لكل المحافظات خلال 2-4 أيام" onChange={(e) => setNote(e.target.value)} />
      </div>
      <h3 style={{ margin: '14px 0 6px' }}>🚚 زرار «محتاجه شحن؟» في صفحة المنتج</h3>
      <div className="form">
        <div className="field">
          <label>🛵 توصيل القاهرة والجيزة — المصاريف</label>
          <input value={loc.fee} placeholder="مثلاً: من 50 لـ 100 ج.م حسب المنطقة" onChange={(e) => setLoc({ ...loc, fee: e.target.value })} />
        </div>
        <div className="field">
          <label>المدة</label>
          <input value={loc.days} placeholder="مثلاً: في نفس اليوم أو تاني يوم" onChange={(e) => setLoc({ ...loc, days: e.target.value })} />
        </div>
        <div className="field full">
          <label>ملاحظة</label>
          <input value={loc.note} placeholder="مثلاً: مندوب بيوصّلك لحد باب البيت" onChange={(e) => setLoc({ ...loc, note: e.target.value })} />
        </div>
        <div className="field">
          <label>📦 شحن للمحافظات — المصاريف</label>
          <input value={gov.fee} placeholder="مثلاً: حسب الوزن والمحافظة" onChange={(e) => setGov({ ...gov, fee: e.target.value })} />
        </div>
        <div className="field">
          <label>المدة</label>
          <input value={gov.days} placeholder="مثلاً: من 2 لـ 4 أيام" onChange={(e) => setGov({ ...gov, days: e.target.value })} />
        </div>
        <div className="field full">
          <label>ملاحظة</label>
          <input value={gov.note} placeholder="مثلاً: مع شركات شحن موثوقة — الدفع عند الاستلام" onChange={(e) => setGov({ ...gov, note: e.target.value })} />
        </div>
      </div>
      <h3 style={{ margin: '14px 0 6px' }}>المناطق</h3>
      {rows.map((x, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1.3fr) auto', gap: 6, marginBottom: 6 }}>
          <input placeholder="المنطقة" value={x.area} onChange={(e) => upd(i, 'area', e.target.value)} />
          <input placeholder="المصاريف" inputMode="decimal" value={x.fee} onChange={(e) => upd(i, 'fee', e.target.value)} />
          <input placeholder="المدة (مثلاً يوم)" value={x.days} onChange={(e) => upd(i, 'days', e.target.value)} />
          <button type="button" className="secondary danger" onClick={() => setRows((R) => R.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => setRows((R) => [...R, { area: '', fee: '', days: '' }])}>
        ＋ منطقة
      </button>
      <div className="field" style={{ marginTop: 14 }}>
        <label>🔁 سياسة الاستبدال والاسترجاع</label>
        <textarea
          rows={5}
          value={pol}
          style={{ padding: 11, border: '1px solid var(--border)', borderRadius: 10 }}
          placeholder="مثلاً: الاستبدال خلال 14 يوم من الاستلام والمنتج بحالته وبالكرتونة..."
          onChange={(e) => setPol(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="primary"
        style={{ marginTop: 12 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await save((x) => {
            x.delivery = rows.map((r) => ({ area: r.area.trim(), fee: String(r.fee).trim(), days: r.days.trim() })).filter((r) => r.area);
            x.deliveryNote = note;
            x.policy = pol.trim();
            x.shipLocal = loc;
            x.shipGov = gov;
          });
          setBusy(false);
        }}
      >
        حفظ
      </button>
    </>
  );
}

const SOC = [
  ['fb', 'فيسبوك', 'https://facebook.com/...'],
  ['ig', 'انستجرام', 'https://instagram.com/...'],
  ['tt', 'تيكتوك', 'https://tiktok.com/@...'],
  ['yt', 'يوتيوب', 'https://youtube.com/@...'],
] as const;

function ContactTab({ d, save }: { d: SiteData; save: Save }) {
  const P = Array.isArray(d.phones) ? d.phones : [];
  const [wa, setWa] = useState(d.phone ?? '');
  const [p1, setP1] = useState(P[0] ?? '');
  const [p2, setP2] = useState(P[1] ?? '');
  const [hours, setHours] = useState(d.hours ?? '');
  const [map, setMap] = useState(d.mapUrl ?? '');
  const [cat, setCat] = useState(d.catalog !== false);
  const [busy, setBusy] = useState(false);
  const so = (d.socials ?? {}) as Record<string, string>;
  const [soc, setSoc] = useState<Record<string, string>>(Object.fromEntries(SOC.map(([k]) => [k, so[k] ?? ''])));
  const [soBusy, setSoBusy] = useState(false);
  return (
    <>
      <div className="form">
        <div className="field full">
          <label>رقم الواتساب الأساسي (اللي عليه الكتالوج)</label>
          <input dir="ltr" value={wa} onChange={(e) => setWa(e.target.value)} />
        </div>
        <div className="field">
          <label>رقم المحل 1</label>
          <input dir="ltr" value={p1} onChange={(e) => setP1(e.target.value)} />
        </div>
        <div className="field">
          <label>رقم المحل 2</label>
          <input dir="ltr" value={p2} onChange={(e) => setP2(e.target.value)} />
        </div>
        <div className="field full">
          <label>ساعات العمل</label>
          <input value={hours} placeholder="مثلاً: يومياً من 10 الصبح لـ 10 بالليل — الجمعة إجازة" onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field full">
          <label>لينك المحل على خرائط جوجل (اختياري)</label>
          <input dir="ltr" value={map} placeholder="https://maps.app.goo.gl/..." onChange={(e) => setMap(e.target.value)} />
        </div>
        <div className="field full">
          <label className="chk">
            <input type="checkbox" checked={cat} onChange={(e) => setCat(e.target.checked)} /> زرار «📒 شوف كتالوجنا على واتساب» في الموقع
          </label>
        </div>
      </div>
      <button
        type="button"
        className="primary"
        style={{ marginTop: 12 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await save((x) => {
            x.phone = wa.trim() || x.phone;
            x.phones = [p1.trim(), p2.trim()].filter(Boolean);
            x.hours = hours.trim();
            x.mapUrl = map.trim();
            x.catalog = cat;
          });
          setBusy(false);
        }}
      >
        حفظ
      </button>
      <div id="soBox" style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 8px' }}>📱 حسابات السوشيال</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 8px' }}>بتظهر في الموقع كأيقونات — سيب الخانة فاضية لو مفيش حساب</p>
        <div className="form">
          {SOC.map(([k, n, ph]) => (
            <div key={k} className="field">
              <label>{n}</label>
              <input id={`so_${k}`} dir="ltr" value={soc[k]} placeholder={ph} onChange={(e) => setSoc({ ...soc, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="primary"
          id="soSave"
          style={{ marginTop: 10 }}
          disabled={soBusy}
          onClick={async () => {
            const o: Record<string, string> = {};
            for (const [k] of SOC) {
              let v = (soc[k] ?? '').trim();
              if (v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
              if (v) o[k] = v;
            }
            setSoBusy(true);
            await save((x) => {
              x.socials = o;
            }, '✔ الحسابات اتحفظت على الموقع');
            setSoBusy(false);
          }}
        >
          💾 حفظ الحسابات
        </button>
      </div>
    </>
  );
}

const ytId = (u: string) => /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/.exec(u || '')?.[1] ?? '';

/**
 * 🌐 The old full-screen site product editor (index.html «spOpen»): name/section/code, photos (drop, order with arrows, ⭐ main),
 * short text + «＋ مواصفة» rows, video, visible/⭐ switches, the live card «👀 شكله في الموقع», «💾 حفظ ونشر».
 * Without `id` it is «➕ منتج جديد على الموقع»: the stock product is created first (price/cost/qty/unit), then published.
 */
export function SiteProduct({ id, onClose }: { id?: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const prod = useProduct(id ?? null);
  const [doc, setDoc] = useState<SiteDoc | null>(null);
  const [f, setF] = useState<{
    on: boolean;
    name: string;
    txt: string;
    sp: [string, string][];
    sec: string;
    imgs: string[];
    top: boolean;
    video: string;
    spid?: string;
    wasOn: boolean;
    code: string;
    price: string;
    cost: string;
    qty: string;
    unit: string;
  } | null>(null);
  const [busy, setBusy] = useState(0);
  const [saving, setSaving] = useState(false);
  const [up, setUp] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = prod.data;
  const isNew = !id;

  useEffect(() => {
    if (!isNew && !p) return;
    fetchSite()
      .then((s) => {
        setDoc(s);
        const sp = p ? s.data.products.find((x) => String(x.code || '') === String(p.code)) : undefined;
        // old splitDesc: lines «المقاس: 50 سم» are specs, the rest is the short description
        const txt: string[] = [];
        const rows: [string, string][] = [];
        (sp?.desc ?? '').split('\n').forEach((l) => {
          const t = l.trim();
          if (!t) return;
          const m = t.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
          if (m) rows.push([m[1]!.trim(), m[2]!.trim()]);
          else txt.push(t);
        });
        setF({
          on: true,
          wasOn: !!sp,
          name: sp?.name ?? p?.name ?? '',
          txt: txt.join('\n'),
          sp: rows.length ? rows : [['المقاس', ''], ['الخامة', '']],
          sec: sp?.sec ?? '',
          imgs: sp ? (sp.imgs?.length ? [...sp.imgs] : sp.img ? [sp.img] : []) : [],
          top: !!sp?.top,
          video: sp?.video ?? '',
          spid: sp?.id,
          code: p ? String(p.code) : '',
          price: '',
          cost: '',
          qty: '0',
          unit: 'قطعة',
        });
      })
      .catch((e) => toast(`محتاج نت عشان تفتح بيانات الموقع: ${errorMessage(e)}`, 'bad'));
  }, [p, isNew, toast]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const shell = (inner: React.ReactNode) => (
    <div id="spEd">
      <div className="sx">{inner}</div>
    </div>
  );
  if ((!isNew && prod.isPending) || !doc || !f) return shell(<div className="sb"><Loading /></div>);
  if (!isNew && !p?.code)
    return shell(
      <div className="sb">
        <p>الصنف ده مالوش كود — اكتب كود الأول (الموقع والطلبات بيشتغلوا بالكود)</p>
        <button type="button" className="secondary" onClick={onClose}>
          رجوع
        </button>
      </div>,
    );
  const secs = doc.data.sections;
  const set = (x: Partial<typeof f>) => setF({ ...f, ...x });
  const joined = [f.txt.trim()]
    .concat(f.sp.filter((x) => x[0].trim() && x[1].trim()).map((x) => `${x[0].trim()}: ${x[1].trim()}`))
    .filter(Boolean)
    .join('\n');
  const inStock = isNew ? Number(f.qty) > 0 : (p?.qty ?? 0) > 0;
  const secName = secs.find((x) => x.id === f.sec)?.name;

  const upload = async (list: FileList | File[] | null) => {
    const fs = [...(list ?? [])].filter((x) => /^image\//.test(x.type));
    if (!fs.length) return;
    setBusy((n) => n + 1);
    const got: string[] = [];
    for (let k = 0; k < fs.length; k++) {
      setUp(`⏳ برفع صورة ${k + 1} من ${fs.length}…`);
      try {
        got.push(await uploadSiteImage(fs[k]!));
        setF((x) => (x ? { ...x, imgs: [...x.imgs.filter((u) => !got.includes(u)), ...got] } : x));
      } catch (e) {
        toast(`صورة مارفعتش: ${errorMessage(e)}`, 'bad');
      }
    }
    setUp('');
    setBusy((n) => n - 1);
  };

  const newSection = async () => {
    const n = window.prompt('اسم القسم الجديد');
    if (!n?.trim()) return;
    const sid = uid7();
    try {
      setDoc(await saveSite((d) => void d.sections.push({ id: sid, name: n.trim() })));
      set({ sec: sid });
      toast('✔ القسم اتعمل');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const go = async () => {
    if (busy) return toast('استنى الصور تخلص رفع', 'bad');
    if (!f.name.trim()) return toast('اكتب اسم المنتج', 'bad');
    if (f.on && !f.sec) return toast('اختار القسم', 'bad');
    if (f.on && !f.imgs.length && !window.confirm('المنتج من غير صور — تكمّل؟')) return;
    setSaving(true);
    try {
      let code = f.code.trim();
      if (isNew) {
        const np = await api
          .post<{ product: { code: string } }>('/products', { code: code || undefined, name: f.name.trim(), category: secName ?? '', unit: f.unit.trim() || 'قطعة', price: Number(f.price) || 0, cost: Number(f.cost) || 0, qty: Number(f.qty) || 0 })
          .then((r) => r.product);
        code = np.code;
        void qc.invalidateQueries({ queryKey: ['products'] });
      }
      await saveSite((d) => {
        const i = d.products.findIndex((x) => String(x.code || '') === code);
        if (!f.on) {
          if (i > -1) d.products.splice(i, 1);
          return;
        }
        const o = i > -1 ? d.products[i]! : { id: f.spid || uid7(), code, name: '', sec: '', imgs: [] as string[] };
        Object.assign(o, { name: f.name.trim(), desc: joined, sec: f.sec, imgs: f.imgs, img: f.imgs[0] ?? '', top: f.top });
        if (f.video.trim()) o.video = f.video.trim();
        else delete o.video;
        if (i > -1) d.products[i] = o;
        else d.products.push(o);
      });
      toast(f.on ? '✔ اتحفظ واتنشر على الموقع' : '✔ اتشال من الموقع');
      onClose();
    } catch (e) {
      setSaving(false);
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };

  const mv = (i: number, j: number) => {
    const a = [...f.imgs];
    [a[i], a[j]] = [a[j]!, a[i]!];
    set({ imgs: a });
  };
  const vid = ytId(f.video);

  return shell(
    <>
      <div className="sh">
        <button type="button" className="secondary" id="seX" style={{ padding: '8px 12px' }} onClick={onClose}>
          → رجوع
        </button>
        <h2>{isNew ? '➕ منتج جديد على الموقع' : `🌐 ${p!.name}`}</h2>
        <span className={`pill ${f.wasOn ? 'on' : 'off'}`}>{f.wasOn ? '● منشور على الموقع' : '○ مش على الموقع'}</span>
      </div>
      <div className="sb">
        <div>
          <div className="sec">
            <h3>📝 البيانات الأساسية</h3>
            <label className="l">اسم المنتج على الموقع</label>
            <input id="eName" value={f.name} placeholder="مثلاً: مجرى سفلي سوفت كلوز 50 سم" onChange={(e) => set({ name: e.target.value })} />
            <div className="g2">
              <div>
                <label className="l">القسم</label>
                <select id="eSec" value={f.sec} onChange={(e) => (e.target.value === '__new' ? void newSection() : set({ sec: e.target.value }))}>
                  <option value="">— اختار القسم —</option>
                  {secs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__new">＋ قسم جديد…</option>
                </select>
              </div>
              <div>
                <label className="l">الكود</label>
                <input id="eCode" dir="ltr" value={f.code} disabled={!isNew} placeholder={isNew ? 'سيبه فاضي = كود أوتوماتيك' : ''} onChange={(e) => set({ code: e.target.value })} />
              </div>
            </div>
            {isNew ? (
              <div className="g2">
                <div>
                  <label className="l">سعر البيع (في السيستم بس — مش بيظهر في الموقع)</label>
                  <input id="ePrice" type="number" inputMode="decimal" min={0} step="0.01" value={f.price} onChange={(e) => set({ price: e.target.value })} />
                </div>
                <div>
                  <label className="l">سعر الشراء (اختياري)</label>
                  <input id="eCost" type="number" inputMode="decimal" min={0} step="0.01" value={f.cost} onChange={(e) => set({ cost: e.target.value })} />
                </div>
                <div>
                  <label className="l">الكمية اللي عندك</label>
                  <input id="eQty" type="number" inputMode="decimal" min={0} step="1" value={f.qty} onChange={(e) => set({ qty: e.target.value })} />
                </div>
                <div>
                  <label className="l">الوحدة</label>
                  <input id="eUnit" value={f.unit} onChange={(e) => set({ unit: e.target.value })} />
                </div>
              </div>
            ) : (
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                في المخزن: <b>{p!.qty} {p!.unit}</b> — الموقع بيعرض «متوفر» أو «اطلبه» بس، من غير أسعار.
              </p>
            )}
          </div>
          <div className="sec">
            <h3>
              📷 الصور <small>أول صورة هي اللي بتظهر في الكارت — رتّبهم بالأسهم</small>
            </h3>
            <div
              className={`drop${over ? ' over' : ''}`}
              id="eDrop"
              onClick={() => fileRef.current?.click()}
              onDragEnter={(e) => (e.preventDefault(), setOver(true))}
              onDragOver={(e) => (e.preventDefault(), setOver(true))}
              onDragLeave={(e) => (e.preventDefault(), setOver(false))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                void upload(e.dataTransfer.files);
              }}
            >
              📷 دوس هنا تضيف صور، أو اسحبها وارميها هنا
              <br />
              <small style={{ fontWeight: 400 }}>ممكن تختار كذا صورة مرة واحدة — بتتصغّر وتترفع لوحدها</small>
            </div>
            <input
              ref={fileRef}
              type="file"
              id="eFile"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = '';
              }}
            />
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{up}</div>
            <div className="ig" id="eImgs">
              {f.imgs.length ? (
                f.imgs.map((u, i) => (
                  <div key={u + i} className={`it${i ? '' : ' main'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" loading="lazy" />
                    <div className="ctl">
                      <button type="button" title="شيل" style={{ color: '#c0392b' }} onClick={() => set({ imgs: f.imgs.filter((_, k) => k !== i) })}>
                        ✕
                      </button>
                      <span>
                        {i > 0 && (
                          <button type="button" title="قدّم" onClick={() => mv(i - 1, i)}>
                            ▶
                          </button>
                        )}
                        {i < f.imgs.length - 1 && (
                          <button type="button" title="أخّر" onClick={() => mv(i, i + 1)}>
                            ◀
                          </button>
                        )}
                      </span>
                    </div>
                    {i ? (
                      <button type="button" style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 11, borderRadius: 8, padding: '1px 6px', border: 0, background: '#fffe' }} onClick={() => set({ imgs: [f.imgs[i]!, ...f.imgs.filter((_, k) => k !== i)] })}>
                        ⭐ أساسية
                      </button>
                    ) : (
                      <span className="tag">الأساسية</span>
                    )}
                  </div>
                ))
              ) : (
                <small style={{ color: 'var(--muted)' }}>لسه مفيش صور</small>
              )}
            </div>
          </div>
          <div className="sec">
            <h3>📋 الوصف والمواصفات</h3>
            <label className="l">وصف قصير (بيظهر في صفحة المنتج)</label>
            <textarea id="eTxt" rows={3} value={f.txt} placeholder="مثلاً: مجرى سفلي بقفل هادي، تحميل لحد 35 كيلو، مناسب للمطابخ والدريسنج" onChange={(e) => set({ txt: e.target.value })} />
            <label className="l">المواصفات</label>
            <div id="eSpecs">
              {f.sp.map((x, i) => (
                <div key={i} className="spec">
                  <input value={x[0]} placeholder="مثلاً: المقاس" onChange={(e) => set({ sp: f.sp.map((y, j) => (j === i ? [e.target.value, y[1]] : y)) })} />
                  <input value={x[1]} placeholder="مثلاً: 50 سم" onChange={(e) => set({ sp: f.sp.map((y, j) => (j === i ? [y[0], e.target.value] : y)) })} />
                  <button type="button" onClick={() => set({ sp: f.sp.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary" id="eAddSp" style={{ marginTop: 4 }} onClick={() => set({ sp: [...f.sp, ['', '']] })}>
              ＋ مواصفة
            </button>
          </div>
          <div className="sec">
            <h3>
              🎬 فيديو <small>اختياري — يوتيوب أو لينك فيديو</small>
            </h3>
            <input id="eVid" dir="ltr" value={f.video} placeholder="https://youtube.com/watch?v=..." onChange={(e) => set({ video: e.target.value })} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {vid && <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="" style={{ marginTop: 8, width: 220, borderRadius: 10 }} />}
          </div>
          <div className="sec">
            <h3>👁️ الظهور</h3>
            <div className="tg">
              <div>
                <b>يظهر على الموقع</b>
                <small>لو قفلته المنتج بيختفي من الموقع ويفضل في السيستم</small>
              </div>
              <label className="sw">
                <input type="checkbox" id="eOn" checked={f.on} onChange={(e) => set({ on: e.target.checked })} />
                <span />
              </label>
            </div>
            <div className="tg">
              <div>
                <b>⭐ منتج مميز</b>
                <small>يظهر في «الأكثر طلباً» في أول الموقع</small>
              </div>
              <label className="sw">
                <input type="checkbox" id="eTop" checked={f.top} onChange={(e) => set({ top: e.target.checked })} />
                <span />
              </label>
            </div>
          </div>
        </div>
        <div className="pv">
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>👀 شكله في الموقع</div>
          <div className="pvc" id="ePv">
            <div className="im">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.imgs[0] ? <img src={f.imgs[0]} alt="" /> : '🔧'}
            </div>
            <div className="bd">
              <small>{secName ?? 'القسم'}</small>
              <b>{f.name || 'اسم المنتج'}</b>
              <small style={{ color: inStock ? '#1e7a3c' : '#b7791f' }}>● {inStock ? 'متوفر' : 'اطلبه — هيوصلك لما يتوفر'}</small>
              {f.top && <small style={{ display: 'block', color: '#b7791f' }}>⭐ مميز</small>}
              <div className="ask">💬 اسأل عن السعر</div>
            </div>
          </div>
          <div className="pvd" id="ePvD">
            {joined || 'الوصف والمواصفات هيظهروا هنا'}
          </div>
        </div>
      </div>
      <div className="sf">
        <button type="button" className="primary" id="eSave" disabled={saving || busy > 0} onClick={go}>
          {saving ? '⏳ بنحفظ…' : `💾 حفظ ${f.wasOn || isNew ? 'ونشر' : 'وانشر على الموقع'}`}
        </button>
        <button type="button" className="secondary" id="eCancel" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </>,
  );
}
