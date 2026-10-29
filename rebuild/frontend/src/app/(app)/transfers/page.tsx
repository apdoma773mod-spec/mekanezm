'use client';

import { useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { InboxCard, InboxTabs } from '@/components/inbox/inbox-tabs';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useInboxCounts, useWaPhotoStatus, useWaPhotos, type InboxTab, type WaPhotoRow } from '@/lib/inbox-queries';

/** 🖼️ تحويلات الواتساب: صور الإيصالات والتصاميم اللي العملاء بعتوها. */
const LABEL: Record<WaPhotoRow['status'], string> = {
  new: 'جديدة',
  sent: 'اتبعتت',
  paid: 'اتدفعت',
  transfer: 'اتسجلت تحويل',
  missing: 'مش موجودة',
  ignored: 'متجاهلة',
};

function PhotoCard({ p, tab }: { p: WaPhotoRow; tab: InboxTab }) {
  const toast = useToast();
  const status = useWaPhotoStatus();
  const busy = status.isPending;
  const set = (s: WaPhotoRow['status']) =>
    status.mutate({ id: p.id, status: s }, { onError: (e) => toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad') });
  return (
    <InboxCard tone={tab === 'new' ? 'new' : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b>{p.name || 'زبون'}</b>
        <small dir="ltr" style={{ color: 'var(--muted)' }}>
          {p.phone} · {new Date(p.createdAt).toLocaleString('ar-EG')}
        </small>
      </div>
      {p.caption && <div style={{ whiteSpace: 'pre-wrap', margin: '6px 0', lineHeight: 1.8 }}>{p.caption}</div>}
      <a href={p.img} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '8px 0' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.img} alt="صورة من الواتساب" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 12 }} />
      </a>
      {tab !== 'new' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{LABEL[p.status]}{p.handledBy ? ` — ${p.handledBy}` : ''}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {tab === 'new' && (
          <>
            <button type="button" className="primary" disabled={busy} onClick={() => set('sent')}>
              ✔ اتبعتت
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => set('paid')}>
              💰 اتدفعت
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => set('missing')}>
              ❌ مش موجودة
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => set('ignored')}>
              🙈 تجاهل
            </button>
          </>
        )}
        {tab !== 'new' && (
          <button type="button" className="secondary" disabled={busy} onClick={() => set('new')}>
            ↩️ رجّعها للجديدة
          </button>
        )}
      </div>
    </InboxCard>
  );
}

function PhotosList() {
  const [tab, setTab] = useState<InboxTab>('new');
  const counts = useInboxCounts();
  const list = useWaPhotos(tab);
  return (
    <>
      <InboxTabs value={tab} onChange={setTab} counts={{ new: counts.data?.waPhotos }} />
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <div className="empty">مفيش صور هنا 👌</div>}
      {list.data?.map((p) => (
        <PhotoCard key={p.id} p={p} tab={tab} />
      ))}
    </>
  );
}

export default function TransfersPage() {
  return (
    <AdminOnly>
      <PageHeader title="تحويلات الواتساب" subtitle="صور الإيصالات والتصاميم اللي العملاء بعتوها على واتساب المحل" />
      <PhotosList />
    </AdminOnly>
  );
}
