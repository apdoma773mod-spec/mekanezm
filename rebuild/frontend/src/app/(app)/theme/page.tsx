'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_THEME, FONT_CHOICES, type InvoiceDto, type SettingsMap, type ThemeSettings } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { fontStack, todayYmd } from '@/lib/format';
import { fileToDataUrl } from '@/lib/image';
import { invoiceA4Html, printHtml } from '@/lib/print';
import { keys, useSaveSetting, useSettings } from '@/lib/queries';

const PRESETS: [string, string, string][] = [
  ['ميكانيزم', '#087f8c', '#d5a928'],
  ['أزرق', '#1e5fbf', '#f59e0b'],
  ['أخضر', '#1f8a4c', '#e0a800'],
  ['بنفسجي', '#6b3fa0', '#e0a800'],
  ['أحمر', '#b3261e', '#222222'],
  ['أسود وذهبي', '#1c1c1c', '#d5a928'],
];

const SAMPLE: InvoiceDto = {
  id: 'preview',
  kind: 'SALE',
  no: 'MK-0000',
  status: 'ACTIVE',
  company: 'MK',
  date: todayYmd(),
  contactId: null,
  person: 'عميل تجربة',
  phone: '01000000000',
  address: '',
  note: '',
  subtotal: 450,
  discount: 0,
  shipping: 0,
  total: 450,
  paid: 300,
  remaining: 150,
  payMethod: 'CASH',
  items: [
    { id: '1', productId: null, code: null, name: 'مفصلة هيدروليك', unit: 'قطعة', qty: 10, price: 30, total: 300 },
    { id: '2', productId: null, code: null, name: 'مقبض ألومنيوم', unit: 'قطعة', qty: 5, price: 30, total: 150 },
  ],
  createdBy: null,
  updatedBy: null,
  voidedAt: null,
  voidReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function ThemeEditor({ settings }: { settings: SettingsMap }) {
  const qc = useQueryClient();
  const toast = useToast();
  const save = useSaveSetting('theme');
  const [T, setT] = useState<ThemeSettings>(settings.theme);
  const dirty = useRef(false);

  // Live preview like the old system: the whole app re-colors while you pick, then it saves by itself.
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => {
    dirty.current = true;
    setT((prev) => {
      const next = { ...prev, [k]: v };
      qc.setQueryData<SettingsMap>(keys.settings, (old) => (old ? { ...old, theme: next } : old));
      return next;
    });
  };
  const setMany = (patch: Partial<ThemeSettings>) => {
    dirty.current = true;
    setT((prev) => {
      const next = { ...prev, ...patch };
      qc.setQueryData<SettingsMap>(keys.settings, (old) => (old ? { ...old, theme: next } : old));
      return next;
    });
  };

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      save.mutate(T, {
        onSuccess: () => toast('اتحفظ المظهر'),
        onError: (err) => toast(errorMessage(err), 'bad'),
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [T]); // eslint-disable-line react-hooks/exhaustive-deps -- save/toast are stable; only T changes trigger a save

  const upload = (k: 'logo' | 'bgImg', maxSide: number) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set(k, await fileToDataUrl(file, maxSide));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'مقدرتش أقرا الصورة', 'bad');
    }
  };

  const fontOptions = FONT_CHOICES.map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

  return (
    <>
      <PageHeader
        title="المظهر والتخصيص"
        subtitle="غيّر الألوان والخط واللوجو والخلفية وشكل الفاتورة"
        action={
          <button type="button" className="secondary danger" onClick={() => setMany(DEFAULT_THEME)}>
            رجوع للافتراضي
          </button>
        }
      />
      <div className="grid2">
        <div className="card">
          <h3>لوجو ميكانيزم</h3>
          <div className="settings">
            <div className="logoBox">{T.logo ? <img src={T.logo} alt="اللوجو" /> : 'مفيش لوجو'}</div>
            <div className="btnrow">
              <label className="primary" style={{ cursor: 'pointer' }}>
                رفع لوجو
                <input type="file" accept="image/*" hidden onChange={upload('logo', 800)} />
              </label>
              <button type="button" className="secondary danger" onClick={() => set('logo', '')}>
                إزالة اللوجو
              </button>
            </div>
            <label className="chk">
              <input type="checkbox" checked={T.logoHeader} onChange={(e) => set('logoHeader', e.target.checked)} /> إظهار اللوجو أعلى النظام
            </label>
            <label className="chk">
              <input type="checkbox" checked={T.logoInv} onChange={(e) => set('logoInv', e.target.checked)} /> إظهار اللوجو في الفاتورة
            </label>
            <label className="chk">
              <input type="checkbox" checked={T.watermark} onChange={(e) => set('watermark', e.target.checked)} /> علامة مائية باهتة بالفاتورة
            </label>
          </div>
        </div>

        <div className="card">
          <h3>ألوان النظام</h3>
          <div className="settings">
            <div className="presets">
              {PRESETS.map(([name, primary, accent]) => (
                <button key={name} type="button" className="preset" onClick={() => setMany({ primary, accent })}>
                  <i style={{ background: primary }} />
                  <i style={{ background: accent }} />
                  {name}
                </button>
              ))}
            </div>
            <div className="form">
              <div className="field">
                <label htmlFor="thPrimary">اللون الأساسي</label>
                <input id="thPrimary" type="color" value={T.primary} onChange={(e) => set('primary', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="thAccent">اللون المميز</label>
                <input id="thAccent" type="color" value={T.accent} onChange={(e) => set('accent', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="thBg">لون الخلفية</label>
                <input id="thBg" type="color" value={T.bg} onChange={(e) => set('bg', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="thText">لون النصوص</label>
                <input id="thText" type="color" value={T.text} onChange={(e) => set('text', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>خلفية النظام</h3>
          <div className="settings">
            <div className="logoBox">{T.bgImg ? <img src={T.bgImg} alt="الخلفية" /> : 'خلفية سادة (بدون صورة)'}</div>
            <div className="btnrow">
              <label className="primary" style={{ cursor: 'pointer' }}>
                رفع صورة خلفية
                <input type="file" accept="image/*" hidden onChange={upload('bgImg', 1600)} />
              </label>
              <button type="button" className="secondary danger" onClick={() => set('bgImg', '')}>
                إزالة الصورة
              </button>
            </div>
            <div className="field">
              <label htmlFor="thClarity">وضوح صورة الخلفية</label>
              <input id="thClarity" type="range" min={10} max={100} value={T.bgClarity} onChange={(e) => set('bgClarity', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3>مسافة أعلى الشاشة</h3>
          <div className="settings">
            <div className="field">
              <label htmlFor="thTopGap">نزّل الأيقونات لتحت (لو متغطيّة بأزرار التطبيق)</label>
              <select id="thTopGap" value={T.topGap} onChange={(e) => set('topGap', Number(e.target.value))}>
                <option value={0}>بدون مسافة</option>
                <option value={30}>مسافة صغيرة</option>
                <option value={62}>مسافة متوسطة</option>
                <option value={90}>مسافة كبيرة</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>الخط</h3>
          <div className="settings">
            <div className="field">
              <label htmlFor="thFont">خط النظام</label>
              <select id="thFont" value={T.font} onChange={(e) => set('font', e.target.value as ThemeSettings['font'])}>
                {fontOptions}
              </select>
            </div>
            <div className="field">
              <label htmlFor="thInvFont">خط الفاتورة</label>
              <select id="thInvFont" value={T.invFont} onChange={(e) => set('invFont', e.target.value as ThemeSettings['invFont'])}>
                <option value="same">نفس خط النظام</option>
                {fontOptions}
              </select>
            </div>
            <div className="sample" style={{ fontFamily: fontStack(T.font) }}>
              ميكانيزم لتجهيزات المطابخ والدريسنج روم — ١٢٣٤٥٦ ج.م
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>ألوان الفاتورة</h3>
        <div className="settings">
          <label className="chk">
            <input type="checkbox" checked={T.invSync} onChange={(e) => set('invSync', e.target.checked)} /> نفس ألوان النظام
          </label>
          {!T.invSync && (
            <div className="form">
              <div className="field">
                <label htmlFor="thInvHeader">لون رأس الفاتورة</label>
                <input id="thInvHeader" type="color" value={T.invHeader} onChange={(e) => set('invHeader', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="thInvAccent">لون الخط المميز</label>
                <input id="thInvAccent" type="color" value={T.invAccent} onChange={(e) => set('invAccent', e.target.value)} />
              </div>
            </div>
          )}
          <button type="button" className="primary" onClick={() => printHtml(invoiceA4Html(SAMPLE, { ...settings, theme: T }))}>
            معاينة الفاتورة
          </button>
        </div>
      </div>
    </>
  );
}

function ThemeScreen() {
  const settings = useSettings();
  if (settings.isPending) return <Loading />;
  if (settings.isError) return <ErrorBox message={errorMessage(settings.error)} onRetry={() => settings.refetch()} />;
  return <ThemeEditor settings={settings.data} />;
}

export default function ThemePage() {
  return (
    <AdminOnly>
      <ThemeScreen />
    </AdminOnly>
  );
}
