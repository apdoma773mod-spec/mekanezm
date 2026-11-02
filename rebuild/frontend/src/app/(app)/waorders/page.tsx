'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markNotSteel, notSteel, steelWord } from '@/lib/steel';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { InboxCard, InboxTabs } from '@/components/inbox/inbox-tabs';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useOrderSale } from '@/lib/use-order-sale';
import { useInboxCounts, useWaOrderStatus, useWaOrders, type InboxTab, type WaOrderRow } from '@/lib/inbox-queries';

/** 💬 طلبات الواتساب: الرسايل اللي فيها كلمة «طلب». بتفتح فاتورة بيع جاهزة بالعميل والنص، وحط الأسعار واحفظ. */
function OrderCard({ o, tab }: { o: WaOrderRow; tab: InboxTab }) {
  const { open } = useModal();
  const router = useRouter();
  const toast = useToast();
  const [hideSteel, setHideSteel] = useState(() => notSteel().includes(o.id));
  const why = hideSteel ? '' : steelWord(o.body);
  const status = useWaOrderStatus();
  const busy = status.isPending;
  const set = (s: WaOrderRow['status']) =>
    status.mutate(
      { id: o.id, status: s },
      { onError: (e) => toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad') },
    );
  const toInvoice = useOrderSale();
  const makeInvoice = () =>
    toInvoice({
      online: true,
      text: o.body,
      person: o.customerName,
      phone: o.phone,
      note: 'من طلب واتساب',
      onSaved: async () => {
        await status.mutateAsync({ id: o.id, status: 'done' });
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
      {why && (
        <div style={{ margin: '10px 0', padding: 12, borderRadius: 12, background: '#e8f4f6', border: '2px solid #087f8c', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 16 }}>🔩 طلب استانلس</b>
          <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: '#475b61' }}>اتصنّف كده بسبب كلمة «{why}». لو غلط اضغط «مش استانلس».</span>
          <button
            type="button"
            className="primary"
            onClick={() => {
              try {
                sessionStorage.setItem('mk_open_steel', JSON.stringify({ id: o.id, customer: o.customerName, phone: o.phone, body: o.body }));
              } catch {
                /* private mode */
              }
              router.push('/work?k=steel');
            }}
          >
            🛠️ جهّز القطعة
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              markNotSteel(o.id);
              setHideSteel(true);
            }}
          >
            مش استانلس
          </button>
        </div>
      )}
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
