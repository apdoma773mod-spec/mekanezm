'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { arDate, balanceColor, balanceText, money, PAY_LABELS, qtyText } from '@/lib/format';
import { printHtml, statementHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import {
  useCancelPayment,
  useContact,
  useDeleteContact,
  useInvoices,
  usePayments,
  useReturns,
  useStatement,
  useZeroAccount,
} from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';
import { useSampleCount } from '@/lib/phase4-queries';
import { useInvNotes } from '@/lib/trade-queries';

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** «ملف العميل / المورد» — the old openContactFile window. */
export function ContactFile({ id }: { id: string }) {
  const { open, close } = useModal();
  const toast = useToast();
  const contact = useContact(id);
  const invoices = useInvoices({ contactId: id, pageSize: 200 });
  const payments = usePayments({ contactId: id, pageSize: 200 });
  const returns = useReturns({ contactId: id, pageSize: 200 });
  const settings = useSettings();
  const [wantStatement, setWantStatement] = useState(false);
  const statement = useStatement(wantStatement ? id : null);
  const zero = useZeroAccount();
  const cancelPay = useCancelPayment();
  const remove = useDeleteContact();
  const [confirmZero, setConfirmZero] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const samplesOut = useSampleCount(contact.data?.type === 'CUSTOMER' ? contact.data.name : null).data ?? 0;

  useEffect(() => {
    if (!wantStatement || !statement.data || !settings.data) return;
    printHtml(statementHtml(statement.data, settings.data));
    setWantStatement(false);
  }, [wantStatement, statement.data, settings.data]);

  if (contact.isPending) {
    return (
      <Modal title="الملف" onClose={close} wide>
        <Loading />
      </Modal>
    );
  }
  if (contact.isError) {
    return (
      <Modal title="الملف" onClose={close} wide>
        <ErrorBox message={errorMessage(contact.error)} onRetry={() => contact.refetch()} />
      </Modal>
    );
  }

  const c = contact.data;
  const isC = c.type === 'CUSTOMER';
  const inv = invoices.data?.items ?? [];
  const pays = payments.data?.items ?? [];
  const rets = returns.data?.items ?? [];
  const tot = sum(inv.map((x) => x.total));
  const pd = sum(inv.map((x) => x.paid));
  const pp = sum(pays.map((x) => x.amount));
  const rt = sum(rets.map((x) => x.total));

  const doZero = async (cash: boolean) => {
    try {
      await zero.mutateAsync({ id, cash });
      toast('اتصفّر الحساب');
      setConfirmZero(false);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  };

  return (
    <Modal title={`ملف ${isC ? 'العميل' : 'المورد'}: ${c.name}`} onClose={close} wide>
      {samplesOut > 0 && (
        <div style={{ background: '#fff7e0', border: '1px solid #f0d58a', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 14 }}>
          🧪 عنده {samplesOut} عينة خارجة دلوقتي
        </div>
      )}
      <div className="card" style={{ background: 'var(--tint2)', border: 0, lineHeight: 2 }}>
        <div>
          التليفون: <b dir="ltr">{c.phone || '—'}</b>
        </div>
        <div>
          العنوان: <b>{c.address || '—'}</b>
        </div>
        {c.note && <div>ملاحظات: {c.note}</div>}
        <div style={{ marginTop: 6 }}>
          الحساب: <b style={{ fontSize: 22, color: balanceColor(c.balance) }}>{balanceText(c)}</b>
        </div>
      </div>

      <div className="cstats">
        <div>
          <small>عدد الفواتير</small>
          <b>{inv.length}</b>
        </div>
        <div>
          <small>{isC ? 'إجمالي اللي اشتراه' : 'إجمالي اللي اشتريته منه'}</small>
          <b>{money(tot)}</b>
        </div>
        <div>
          <small>المدفوع في الفواتير</small>
          <b>{money(pd)}</b>
        </div>
        <div>
          <small>{isC ? 'دفعات استلمتها منه' : 'دفعات سددتها له'}</small>
          <b>{money(pp)}</b>
        </div>
        <div>
          <small>المرتجعات</small>
          <b>{money(rt)}</b>
        </div>
        <div>
          <small>صافي التعامل</small>
          <b>{money(tot - rt)}</b>
        </div>
      </div>

      <div className="btnrow">
        <button type="button" className="primary" onClick={() => open({ kind: 'payment', contactId: id })}>
          {isC ? 'تحصيل دفعة' : 'سداد للمورد'}
        </button>
        {Math.abs(c.balance) > 0.004 &&
          (confirmZero ? (
            <>
              <button type="button" className="primary" style={{ background: '#16a34a' }} disabled={zero.isPending} onClick={() => doZero(true)}>
                {c.balance > 0 ? `تأكيد: ${isC ? 'استلمت' : 'دفعت'} ${money(c.balance)}` : 'رجّعت الفلوس'}
              </button>
              {c.balance < 0 && (
                <button type="button" className="secondary" disabled={zero.isPending} onClick={() => doZero(false)}>
                  تسوية من غير فلوس
                </button>
              )}
            </>
          ) : (
            <button type="button" className="primary" style={{ background: '#16a34a' }} onClick={() => setConfirmZero(true)}>
              💯 صفّر الحساب ({c.balance > 0 ? money(c.balance) : `${isC ? 'ليه' : 'لينا'} ${money(-c.balance)}`})
            </button>
          ))}
        <button
          type="button"
          className="secondary"
          onClick={() => open({ kind: 'transaction', type: isC ? 'SALE' : 'PURCHASE', person: c.name })}
        >
          {isC ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة'}
        </button>
        <button type="button" className="secondary" onClick={() => open({ kind: 'contactReport', name: c.name, type: c.type })}>
          📄 كشف حساب
        </button>
        <button type="button" className="secondary" onClick={() => open({ kind: 'contact', id })}>
          ✏️ تعديل البيانات
        </button>
        {Math.abs(c.balance) < 0.005 &&
          (confirmDelete ? (
            <button
              type="button"
              className="secondary danger"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(id);
                  toast('اتمسح');
                  close();
                } catch (err) {
                  toast(errorMessage(err), 'bad');
                }
              }}
            >
              متأكد؟ حذف
            </button>
          ) : (
            <button type="button" className="secondary danger" onClick={() => setConfirmDelete(true)}>
              حذف
            </button>
          ))}
      </div>

      {isC && <ReceiptStatus person={c.name} />}
      <h3 style={{ margin: '16px 0 8px' }}>الفواتير</h3>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {invoices.isPending ? (
              <tr>
                <td colSpan={5}>
                  <Loading />
                </td>
              </tr>
            ) : inv.length ? (
              inv.map((x) => (
                <tr key={x.id} className="prow" onClick={() => open({ kind: 'invoice', id: x.id })}>
                  <td>
                    <b>{x.no}</b>
                  </td>
                  <td>{arDate(x.date)}</td>
                  <td>{money(x.total)}</td>
                  <td>{money(x.paid)}</td>
                  <td style={{ color: x.remaining > 0 ? 'var(--danger)' : 'inherit' }}>{money(x.remaining)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">لا توجد فواتير.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '16px 0 8px' }}>{isC ? 'الدفعات المستلمة' : 'الدفعات المسددة'}</h3>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 320 }}>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المبلغ</th>
              <th>ملاحظة</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pays.length ? (
              pays.map((x) => (
                <tr key={x.id}>
                  <td>{arDate(x.date)}</td>
                  <td>
                    {money(x.amount)} <small style={{ color: 'var(--muted)' }}>{PAY_LABELS[x.method]}</small>
                  </td>
                  <td>{x.note || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary danger"
                      disabled={cancelPay.isPending}
                      onClick={async () => {
                        try {
                          await cancelPay.mutateAsync(x.id);
                          toast('اتلغت الدفعة');
                        } catch (err) {
                          toast(errorMessage(err), 'bad');
                        }
                      }}
                    >
                      إلغاء
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="empty">لا توجد دفعات.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rets.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>المرتجعات</h3>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 320 }}>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {rets.map((x) => (
                  <tr key={x.id}>
                    <td>{arDate(x.date)}</td>
                    <td>{x.product.name}</td>
                    <td>{qtyText(x.qty)}</td>
                    <td>{money(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/** 📦 حالة الاستلام في ملف العميل: اللي اتستلم، واللي فاضل (من «استلام وناقص» في الفاتورة). */
function ReceiptStatus({ person }: { person: string }) {
  const notes = useInvNotes({ person });
  const L = notes.data ?? [];
  const rows = L.filter((n) => n.recv || n.got || n.miss);
  if (!rows.length) return null;
  const open = rows.filter((n) => n.miss).length;
  return (
    <>
      <h3 style={{ margin: '16px 0 8px' }}>📦 حالة الاستلام</h3>
      <div className="card" style={{ lineHeight: 1.8 }}>
        {open ? <div style={{ color: '#b3261e', fontWeight: 800, marginBottom: 6 }}>فاضل له بضاعة في {open} فاتورة</div> : <div style={{ color: '#1e7a3c', fontWeight: 800, marginBottom: 6 }}>كل البضاعة اتستلمت ✔</div>}
        {rows.map((n) => (
          <div key={n.no} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <b>{n.no}</b>
            {n.recv ? <> — ✔ اتستلم{n.gotDate ? ` بتاريخ ${n.gotDate}` : ` ${n.recv}`}</> : null}
            {n.miss ? <div style={{ color: '#b3261e' }}>⚠️ فاضل: {n.miss}</div> : null}
            {n.got ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>اللي اتسلّم: {n.got}</div> : null}
          </div>
        ))}
      </div>
    </>
  );
}
