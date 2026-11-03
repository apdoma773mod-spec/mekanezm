'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { CatProduct } from '@/lib/catalog-pro';

interface Hit {
  url: string;
  thumb: string;
  title: string;
  site: string;
}

/** 🖼️ صور حقيقية تقريبية للمنتج من النت: بحث صور جوجل، تختار لحد ٣، وبتتنزّل وتتحفظ عندنا */
export function WebPhotos({ p, have, onSave }: { p: CatProduct; have: string[]; onSave: (urls: string[]) => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(`${p.name}${p.brand ? ` ${p.brand}` : ''}`);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState('');

  const search = async () => {
    setBusy('search');
    try {
      const r = await api.post<{ items: Hit[] }>('/web/catalog/ai/photos', { name: p.name, brand: p.brand ?? '', q });
      setHits(r.items);
      setPick([]);
      if (!r.items.length) toast('مفيش صور للبحث ده — غيّر الكلام وجرّب تاني', 'bad');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
    setBusy('');
  };
  const save = async () => {
    setBusy('save');
    const got: string[] = [];
    for (const u of pick) {
      try {
        got.push((await api.post<{ url: string }>('/web/catalog/ai/photos/save', { url: u })).url);
      } catch (e) {
        toast(errorMessage(e), 'bad');
      }
    }
    if (got.length) {
      await onSave([...have, ...got].slice(-4));
      toast(`✔ اتحفظت ${got.length} صورة — هتظهر في صفحة المنتج في الكتالوج`);
      setOpen(false);
      setHits(null);
    }
    setBusy('');
  };

  if (!open)
    return (
      <button type="button" className="secondary" onClick={() => { setOpen(true); if (!hits) void search(); }}>
        🖼️ صور من النت{have.length ? ` (${have.length})` : ''}
      </button>
    );
  return (
    <div style={{ width: '100%', background: '#f6f9fb', borderRadius: 12, padding: 10, marginTop: 6 }}>
      {have.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <small style={{ color: '#62767c' }}>الصور المحفوظة (اضغط على صورة تشيلها):</small>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {have.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="" title="اضغط تشيلها" onClick={() => void onSave(have.filter((x) => x !== u))} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid #0e7a3f' }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} style={{ flex: 1 }} />
        <button type="button" className="secondary" disabled={!!busy} onClick={() => void search()}>
          {busy === 'search' ? '⏳' : '🔍 دوّر'}
        </button>
      </div>
      <small style={{ color: '#62767c', display: 'block', margin: '4px 0' }}>اختار لحد ٣ صور شبه المنتج (اكتب الاسم بالإنجليزي كمان لو النتايج قليلة، زي: magic corner)</small>
      {hits && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 6 }}>
          {hits.map((h) => {
            const on = pick.includes(h.url);
            return (
              <button
                key={h.url}
                type="button"
                title={`${h.title} — ${h.site}`}
                onClick={() => setPick(on ? pick.filter((x) => x !== h.url) : [...pick, h.url].slice(-3))}
                style={{ padding: 0, border: on ? '3px solid var(--primary,#087f8c)' : '1px solid #dfe7ea', borderRadius: 10, overflow: 'hidden', background: '#fff', cursor: 'pointer', position: 'relative' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }} />
                <small style={{ display: 'block', fontSize: 10, color: '#62767c', padding: '2px 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{h.site}</small>
                {on && <b style={{ position: 'absolute', top: 4, right: 4, background: 'var(--primary,#087f8c)', color: '#fff', borderRadius: 99, padding: '0 7px' }}>✔</b>}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" className="primary" disabled={!pick.length || !!busy} onClick={() => void save()}>
          {busy === 'save' ? '⏳ بتتحفظ…' : `💾 احفظ (${pick.length})`}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          قفل
        </button>
      </div>
    </div>
  );
}
