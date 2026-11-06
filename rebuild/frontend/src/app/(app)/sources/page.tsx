'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';

interface Book {
  sources: { id: string; name: string; phones: string[]; note: string; supplierId?: string; at: string }[];
  items: { id: string; name: string; brand: string; price: number; unit: string; code: string; sourceId: string; img: string; productId?: string; at: string }[];
}

const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const wa = (ph: string) => {
  const d = ph.replace(/\D/g, '');
  return d.startsWith('20') ? d : d.startsWith('0') ? `2${d}` : d;
};

/** 📇 مصادر وأسعار من بره: منتجات وأسعار الموردين والشركات اللي جت من صور الواتساب (مش مخزون) — تدوّر فيها لما حد يسألك على حاجة */
export default function SourcesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sources'], queryFn: () => api.get<Book>('/inbox/sources'), staleTime: 30_000 });
  const [text, setText] = useState('');
  const [src, setSrc] = useState('');
  const srcOf = useMemo(() => new Map((q.data?.sources ?? []).map((s) => [s.id, s])), [q.data]);
  const words = norm(text).split(/\s+/).filter(Boolean);
  const items = (q.data?.items ?? [])
    .filter((it) => (!src || it.sourceId === src) && words.every((w) => norm(`${it.name} ${it.brand} ${it.code} ${srcOf.get(it.sourceId)?.name ?? ''}`).includes(w)))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 120);
  const del = async (id: string) => {
    try {
      await api.delete(`/inbox/sources/items/${id}`);
      qc.setQueryData<Book>(['sources'], (b) => (b ? { ...b, items: b.items.filter((x) => x.id !== id) } : b));
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <AdminOnly>
      <PageHeader title="📇 مصادر وأسعار من بره" subtitle="منتجات وأسعار الموردين والشركات اللي جت من صور الواتساب — مش مخزون، مرجع لما حد يسألك على حاجة أو تقارن سعر" />
      {q.isPending && <Loading />}
      {q.isError && <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="🔍 دوّر على منتج، ماركة، كود، أو مورد" style={{ flex: 1, minWidth: 200 }} />
            <select value={src} onChange={(e) => setSrc(e.target.value)}>
              <option value="">كل المصادر ({q.data.sources.length})</option>
              {q.data.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {!q.data.items.length && <div className="empty">لسه مفيش — من «صور الواتساب» دوس «📇 مصدر / مورد» على صورة منتج أو قايمة أسعار</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
            {items.map((it) => {
              const s = srcOf.get(it.sourceId);
              return (
                <div key={it.id} className="card" style={{ padding: 10, margin: 0 }}>
                  <a href={it.img} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.img} alt="" loading="lazy" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 10, background: '#eef2f4' }} />
                  </a>
                  <b style={{ display: 'block', marginTop: 6 }}>{it.name}</b>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {[it.brand, it.code, it.unit].filter(Boolean).join(' · ')}
                  </div>
                  {it.price > 0 && <div style={{ fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>{money(it.price)}</div>}
                  <div style={{ fontSize: 13 }}>
                    {s?.supplierId ? '🏭' : '📇'} {s?.name ?? '—'} · <small>{new Date(it.at).toLocaleDateString('ar-EG')}</small>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {s?.phones.slice(0, 2).map((ph) => (
                      <a key={ph} className="secondary" style={{ padding: '4px 10px', borderRadius: 99, fontSize: 13 }} href={`https://wa.me/${wa(ph)}`} target="_blank" rel="noreferrer" dir="ltr">
                        💬 {ph}
                      </a>
                    ))}
                    <button type="button" className="secondary" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => void del(it.id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AdminOnly>
  );
}
