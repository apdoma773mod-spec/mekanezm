'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { arDate, formatDateTime, money, qtyText } from '@/lib/format';
import { invoiceA4Html, printHtml, receiptHtml, whatsappLink } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useInvoice, useVoidInvoice } from '@/lib/trade-queries';
import { useShipments } from '@/lib/phase4-queries';
import { kindIc, stLabel, useShipActions } from './shipment-modals';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

/** The old «فاتورة …» window shown after saving or tapping an invoice in a list. */
export function InvoiceView({ id }: { id: string }) {
  const { open, close } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const inv = useInvoice(id);
  const settings = useSettings();
  const voidInv = useVoidInvoice();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const ships = useShipments({ tab: 'all', invoiceId: id }, inv.data?.kind === 'SALE');
  const { label } = useShipActions();

  if (inv.isPending) {
    return (
      <Modal title="الفاتورة" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  if (inv.isError) {
    return (
      <Modal title="الفاتورة" onClose={close}>
        <ErrorBox message={errorMessage(inv.error)} onRetry={() => inv.refetch()} />
      </Modal>
    );
  }

  const r = inv.data;
  const isSale = r.kind === 'SALE';
  const voided = r.status === 'VOID';
  const wa = settings.data ? whatsappLink(r, settings.data) : null;

  const doVoid = async () => {
    if (!reason.trim()) return toast('اكتب سبب الإلغاء', 'bad');
    try {
      await voidInv.mutateAsync({ id: r.id, reason: reason.trim() });
      toast('تم إلغاء الفاتورة');
      setVoiding(false);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  };

  return (
    <Modal title={`${isSale ? 'فاتورة' : 'فاتورة شراء'} ${r.no}`} onClose={close}>
      {voided && (
        <div className="form-error" style={{ marginBottom: 12 }}>
          الفاتورة دي ملغية — {r.voidReason} ({formatDateTime(r.voidedAt)})
        </div>
      )}
      <div className="card" style={{ background: 'var(--tint2)', border: 0, lineHeight: 2 }}>
        <div>
          {isSale ? 'العميل' : 'المورد'}: <b>{r.person || (isSale ? 'عميل نقدي' : '—')}</b>
          {r.phone && (
            <>
              {' — '}
              <span dir="ltr">{r.phone}</span>
            </>
          )}
        </div>
        <div>
          التاريخ: <b>{arDate(r.date)}</b>
          {r.createdBy && <small style={{ color: 'var(--muted)' }}> — سجّلها {r.createdBy.name}</small>}
        </div>
        {r.items.map((x) => (
          <div key={x.id}>
            {x.name} × {qtyText(x.qty)} — {money(x.total)}
          </div>
        ))}
        {r.shipping > 0 && <div>🚚 مصاريف النقل — {money(r.shipping)}</div>}
        {r.discount > 0 && <div>الخصم — {money(r.discount)}</div>}
        <div>
          الإجمالي: <b>{money(r.total)}</b> — المدفوع: <b>{money(r.paid)}</b>
          {r.remaining > 0 && (
            <>
              {' — '}المتبقي: <b style={{ color: 'var(--danger)' }}>{money(r.remaining)}</b>
            </>
          )}
        </div>
        {admin && r.profit !== undefined && isSale && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>الربح: {money(r.profit)}</div>
        )}
        {r.note && <div style={{ color: 'var(--muted)' }}>البيان: {r.note}</div>}
      </div>

      {admin && !voided && (
        <div className="btnrow" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => open({ kind: 'transaction', type: r.kind, editId: r.id })}>
            ✏️ تعديل الفاتورة
          </button>
          <button type="button" className="secondary danger" onClick={() => setVoiding(!voiding)}>
            إلغاء الفاتورة
          </button>
        </div>
      )}
      {voiding && (
        <div className="form" style={{ marginTop: 10 }}>
          <div className="field full">
            <label htmlFor="voidReason">سبب الإلغاء</label>
            <input id="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: الفاتورة اتسجلت غلط" />
          </div>
          <div className="field full">
            <span className="hint">
              البضاعة هترجع المخزن{r.contactId && r.paid > 0 ? '، واللي اتدفع هيتسجل رصيد للعميل' : ''}.
            </span>
            <button type="button" className="primary" style={{ background: 'var(--danger)' }} disabled={voidInv.isPending} onClick={doVoid}>
              {voidInv.isPending ? '⏳' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </div>
      )}
      {r.updatedBy && (
        <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
          اتعدلت آخر مرة: {formatDateTime(r.updatedAt)} — {r.updatedBy.name}
        </p>
      )}

      {isSale && !voided && (() => {
        const s = ships.data?.items[0];
        return s ? (
          <div className="shinv">
            🚚 {kindIc(s.kind)} <b>{s.no}</b> — <span className={`badge st-${s.status}`}>{stLabel(s.status, s.kind)}</span>
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button type="button" className="primary" style={{ flex: 1 }} onClick={() => label(s)}>
                🖨️ اطبع ملصق الشحن
              </button>
              <a className="secondary" href="/shipping" style={{ textDecoration: 'none' }} onClick={close}>
                المتابعة
              </a>
            </div>
          </div>
        ) : (
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => open({ kind: 'shipEdit', invoiceId: r.id })}>
              🚚 شحن / توصيل للفاتورة دي
            </button>
          </div>
        );
      })()}

      <div className="btnrow" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="primary"
          style={{ flex: 1, padding: 14 }}
          disabled={!settings.data}
          onClick={() => settings.data && printHtml(invoiceA4Html(r, settings.data))}
        >
          🖨 طباعة / PDF
        </button>
        <button
          type="button"
          className="secondary"
          style={{ padding: 14 }}
          disabled={!settings.data}
          onClick={() => settings.data && printHtml(receiptHtml(r, settings.data))}
        >
          🧾 إيصال
        </button>
        {wa && (
          <a className="secondary" style={{ padding: 14, textDecoration: 'none' }} href={wa} target="_blank" rel="noopener noreferrer">
            واتساب
          </a>
        )}
      </div>
    </Modal>
  );
}
