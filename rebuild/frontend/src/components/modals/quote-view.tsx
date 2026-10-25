'use client';

import { errorMessage } from '@/lib/api';
import { arDate, money, qtyText } from '@/lib/format';
import { useDeleteQuote, useQuote } from '@/lib/phase4-queries';
import { printHtml, quoteHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/** The old openQuoteView(). */
export function QuoteView({ id }: { id: string }) {
  const { open, close } = useModal();
  const toast = useToast();
  const q = useQuote(id);
  const settings = useSettings().data;
  const del = useDeleteQuote();

  if (q.isPending)
    return (
      <Modal title="عرض سعر" onClose={close}>
        <Loading />
      </Modal>
    );
  if (q.isError)
    return (
      <Modal title="عرض سعر" onClose={close}>
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Modal>
    );
  const r = q.data;

  const remove = async () => {
    if (!window.confirm(`حذف عرض السعر ${r.no}؟`)) return;
    try {
      await del.mutateAsync(r.id);
      close();
      toast('تم حذف عرض السعر');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <Modal title={`عرض سعر ${r.no}`} onClose={close}>
      <div className="card" style={{ background: 'var(--tint2)', border: 0, lineHeight: 2 }}>
        <div>
          العميل: <b>{r.person || '—'}</b>
          {r.phone && (
            <>
              {' — '}
              <span dir="ltr">{r.phone}</span>
            </>
          )}
        </div>
        <div>
          التاريخ: <b>{arDate(r.date)}</b>{' '}
          {r.status === 'converted' ? <span className="badge green">اتحول لفاتورة {r.invoiceNo}</span> : <span className="badge">مفتوح</span>}
        </div>
        {r.items.map((x, i) => (
          <div key={i}>
            {x.name} × {qtyText(x.qty)} — {money(x.total)}
          </div>
        ))}
        {r.shipping > 0 && <div>🚚 مصاريف النقل — {money(r.shipping)}</div>}
        <div>
          الإجمالي: <b>{money(r.total)}</b>
        </div>
        {r.note && <div style={{ color: 'var(--muted)' }}>{r.note}</div>}
      </div>
      <div className="btnrow" style={{ marginTop: 12 }}>
        {r.status !== 'converted' && (
          <button type="button" className="primary" style={{ flex: 1 }} onClick={() => open({ kind: 'transaction', type: 'SALE', fromQuote: r.id })}>
            🧾 تحويل لفاتورة بيع
          </button>
        )}
        <button type="button" className="secondary" onClick={() => open({ kind: 'quote', id: r.id })}>
          ✏️ تعديل
        </button>
        <button type="button" className="secondary danger" onClick={remove}>
          حذف
        </button>
      </div>
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button type="button" className="secondary" style={{ flex: 1 }} disabled={!settings} onClick={() => settings && printHtml(quoteHtml(r, settings))}>
          🖨 طباعة / حفظ PDF
        </button>
      </div>
    </Modal>
  );
}
