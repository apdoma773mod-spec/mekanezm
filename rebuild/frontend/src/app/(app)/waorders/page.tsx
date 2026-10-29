'use client';

import { useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { InboxCard, InboxTabs } from '@/components/inbox/inbox-tabs';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useInboxCounts, useWaOrderStatus, useWaOrders, type InboxTab, type WaOrderRow } from '@/lib/inbox-queries';

/** 💬 طلبات الواتساب: الرسايل اللي فيها كلمة «طلب». بتفتح فاتورة بيع جاهزة بالعميل والنص، وحط الأسعار واحفظ. */
function OrderCard({ o, tab }: { o: WaOrderRow; tab: InboxTab }) {
  const { open } = useModal();
  const toast = useToast();
  const status = useWaOrderStatus();
  const busy = status.isPending;
  const set = (s: WaOrderRow['status']) =>
    status.mutate(
      { id: o.id, status: s },
      { onError: (e) => toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad') },
    );
  const makeInvoice = () =>
    open({
      kind: 'transaction',
      type: 'SALE',
      preset: {
        person: o.customerName,
        phone: o.phone,
        note: `من طلب واتساب\n${o.body}`,
        lines: [],
        onSaved: async () => {
          await status.mutateAsync({ id: o.id, status: 'done' });
        },
      },
    });

  return (
    <InboxCard tone={tab === 'new' ? 'new' : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b>{o.customerName || 'زبون'}</b>
        <small dir="ltr" style={{ color: 'var(--muted)' }}>
          {o.phone} · {new Date(o.createdAt).toLocaleString('ar-EG')}
        </small>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', margin: '8px 0', lineHeight: 1.8 }}>{o.body}</div>
      {o.invoiceNo && <div style={{ fontSize: 13, color: 'var(--muted)' }}>اتعملت فاتورة {o.invoiceNo}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {tab !== 'done' && (
          <button type="button" className="primary" disabled={busy} onClick={makeInvoice}>
            🧾 افتح الفاتورة
          </button>
        )}
        {tab === 'new' && (
          <button type="button" className="secondary" disabled={busy} onClick={() => set('ignored')}>
            🙈 تجاهل
          </button>
        )}
        {tab === 'done' && (
          <button type="button" className="secondary" disabled={busy} onClick={() => set('new')}>
            ↩️ رجّعها للجديدة
          </button>
        )}
        {tab === 'other' && (
          <button type="button" className="secondary" disabled={busy} onClick={() => set('new')}>
            ↩️ رجّعها للجديدة
          </button>
        )}
      </div>
    </InboxCard>
  );
}

function OrdersList() {
  const [tab, setTab] = useState<InboxTab>('new');
  const counts = useInboxCounts();
  const list = useWaOrders(tab);
  return (
    <>
      <InboxTabs value={tab} onChange={setTab} counts={{ new: counts.data?.waOrders }} />
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <div className="empty">مفيش طلبات هنا 👌</div>}
      {list.data?.map((o) => (
        <OrderCard key={o.id} o={o} tab={tab} />
      ))}
    </>
  );
}

export default function WaOrdersPage() {
  return (
    <AdminOnly>
      <PageHeader
        title="طلبات الواتساب"
        subtitle="الرسايل اللي فيها كلمة «طلب» على واتساب المحل — افتح الفاتورة، راجع الأصناف وحط الأسعار واحفظ"
      />
      <OrdersList />
    </AdminOnly>
  );
}
