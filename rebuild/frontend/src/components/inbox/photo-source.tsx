'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { WaPhotoRow } from '@/lib/inbox-queries';
import { useAllProducts } from '@/lib/trade-queries';

interface Read {
  company: string;
  phones: string[];
  note: string;
  knownSourceId: string | null;
  products: { name: string; brand: string; code: string; price: number; unit: string; productId?: string }[];
}

/**
 * 📇 صورة من مورد/شركة (حتى لو مش بنشتغل معاه): الذكاء الاصطناعي بيقرا الشركة وأرقامها والمنتجات والأسعار،
 * وبتتحفظ «مصدر» للبحث والمقارنة، أو «مورد» يتسجّل في الموردين. المنتج اللي تربطه بصنف عندك بيدخل في أسعار السوق.
 */
export function SourceFromPhoto({ p }: { p: WaPhotoRow }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [st, setSt] = useState<'idle' | 'busy' | 'saving' | Read>('idle');
  const d = typeof st === 'object' ? st : null;
  const prods = useAllProducts({}, !!d);
  const [asSupplier, setAsSupplier] = useState(false);

  const read = async () => {
    setSt('busy');
    try {
      setSt(await api.post<Read>(`/inbox/wa-photos/${p.id}/read-source`, {}));
    } catch (e) {
      setSt('idle');
      toast(`✘ ${errorMessage(e)}`, 'bad');
    }
  };
  const setD = (x: Partial<Read>) => d && setSt({ ...d, ...x });
  const setItem = (i: number, x: Partial<Read['products'][number]>) => d && setD({ products: d.products.map((it, k) => (k === i ? { ...it, ...x } : it)) });
  const save = async () => {
    if (!d) return;
    if (!d.company.trim()) return toast('اكتب اسم المورد أو الشركة', 'bad');
    const body = { name: d.company.trim(), phones: d.phones, note: d.note, asSupplier, products: d.products.filter((x) => x.name.trim()) };
    setSt('saving');
    try {
      const r = await api.post<{ items: number; supplierCreated: boolean; linked: number }>(`/inbox/wa-photos/${p.id}/save-source`, body);
      toast(`✔ اتحفظ${r.supplierCreated ? ' واتسجّل مورد' : ''} — ${r.items} منتج${r.linked ? `، و${r.linked} دخلوا مقارنة الأسعار` : ''}`);
      qc.setQueriesData<WaPhotoRow[]>({ queryKey: ['inbox', 'wa-photos'] }, (old) => old?.filter((x) => x.id !== p.id));
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['sources'] });
      void qc.invalidateQueries({ queryKey: ['market'] });
    } catch (e) {
      setSt(d);
      toast(`✘ ${errorMessage(e)}`, 'bad');
    }
  };

  if (st === 'idle')
    return (
      <button type="button" className="secondary" onClick={() => void read()}>
        📇 مصدر / مورد
      </button>
    );
  if (st === 'busy') return <div className="vsseen">⏳ بنقرا الصورة: الشركة والأرقام والمنتجات والأسعار…</div>;
  if (st === 'saving') return <div className="vsseen">⏳ بيتحفظ…</div>;
  const inp = { width: '100%', marginTop: 4 } as const;
  return (
    <div className="card" style={{ width: '100%', background: '#f3f7fb' }}>
      <b>📇 مصدر / مورد من الصورة</b>
      {d!.knownSourceId && <div style={{ fontSize: 13, color: '#0e7a3f' }}>✔ المصدر ده متسجّل قبل كده — المنتجات هتتضاف عليه</div>}
      <label style={{ display: 'block', marginTop: 6, fontSize: 13 }}>اسم المورد / الشركة</label>
      <input value={d!.company} onChange={(e) => setD({ company: e.target.value })} style={inp} />
      <label style={{ display: 'block', marginTop: 6, fontSize: 13 }}>الأرقام (كل رقم في سطر)</label>
      <textarea dir="ltr" value={d!.phones.join('\n')} onChange={(e) => setD({ phones: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 54 }} />
      <div style={{ marginTop: 8, fontSize: 13 }}>المنتجات اللي في الصورة ({d!.products.length}):</div>
      {prods.data && (
        <datalist id={`srcP-${p.id}`}>
          {prods.data.slice(0, 3000).map((x) => (
            <option key={x.id} value={`${x.name} #${x.code}`} />
          ))}
        </datalist>
      )}
      {d!.products.map((it, i) => (
        <div key={i} style={{ borderTop: '1px solid #dde6ee', padding: '6px 0', display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} style={{ flex: 1 }} />
            <input type="number" inputMode="decimal" value={it.price || ''} placeholder="السعر" onChange={(e) => setItem(i, { price: Number(e.target.value) || 0 })} style={{ width: 90 }} />
            <button type="button" className="secondary" title="شيله" onClick={() => setD({ products: d!.products.filter((_, k) => k !== i) })}>
              ✕
            </button>
          </div>
          <input
            list={`srcP-${p.id}`}
            placeholder="🔗 اربطه بصنف عندي (اختياري — يدخل في مقارنة الأسعار)"
            onChange={(e) => {
              const code = /#(\S+)$/.exec(e.target.value)?.[1];
              const hit = code ? prods.data?.find((x) => x.code === code) : undefined;
              setItem(i, { productId: hit?.id });
            }}
            style={{ fontSize: 13 }}
          />
          {it.productId && <small style={{ color: '#0e7a3f' }}>✔ مربوط</small>}
        </div>
      ))}
      <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setD({ products: [...d!.products, { name: '', brand: '', code: '', price: 0, unit: '' }] })}>
        ＋ منتج
      </button>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <input type="checkbox" style={{ width: 22, height: 22 }} checked={asSupplier} onChange={(e) => setAsSupplier(e.target.checked)} />
        <span>
          سجّله <b>مورد</b> في الموردين كمان
          <br />
          <small style={{ color: 'var(--muted)' }}>من غيرها بيتحفظ «مصدر» بس للبحث والمقارنة</small>
        </span>
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={() => void save()}>
          💾 احفظ
        </button>
        <button type="button" className="secondary" onClick={() => setSt('idle')}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/** 🚫 الرقم ده مايجيليش منه حاجة تاني (بيتضاف لكلمات الواتساب على طول) */
export function BlockSender({ p }: { p: WaPhotoRow }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!p.phone) return null;
  const go = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ ignored: number }>(`/inbox/wa-photos/${p.id}/block`, {});
      toast(`✔ ${p.name || p.phone} مش هيجيلك منه حاجة تاني${r.ignored > 1 ? ` — واتشال ${r.ignored} حاجة منه` : ''}`);
      qc.setQueriesData<WaPhotoRow[]>({ queryKey: ['inbox', 'wa-photos'] }, (old) => old?.filter((x) => !(x.phone && x.phone.replace(/\D/g, '').slice(-10) === p.phone.replace(/\D/g, '').slice(-10))));
      void qc.invalidateQueries({ queryKey: ['inbox'] });
    } catch (e) {
      toast(`✘ ${errorMessage(e)}`, 'bad');
    }
    setBusy(false);
    setAsk(false);
  };
  if (!ask)
    return (
      <button type="button" className="secondary" onClick={() => setAsk(true)}>
        🚫 متجيليش منه
      </button>
    );
  return (
    <div className="card" style={{ width: '100%', background: '#fff3f1' }}>
      مش عايز صور ولا رسايل تاني من <b>{p.name || p.phone}</b> على السيستم؟
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" className="primary" disabled={busy} onClick={() => void go()}>
          {busy ? '⏳' : '🚫 أيوه، امنعه'}
        </button>
        <button type="button" className="secondary" onClick={() => setAsk(false)}>
          لأ
        </button>
      </div>
    </div>
  );
}
