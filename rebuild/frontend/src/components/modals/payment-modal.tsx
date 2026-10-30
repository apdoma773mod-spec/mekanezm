'use client';

import { useState, type FormEvent } from 'react';
import { PAY_METHODS, paymentInput, type PayMethod } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { balanceColor, balanceText, money, PAY_LABELS } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useContact, useCreatePayment } from '@/lib/trade-queries';
import { Input, NumberInput, Select } from '../ui/field';
import { Modal } from '../ui/modal';
import { ErrorBox, FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/** «تحصيل دفعة» from a customer / «سداد للمورد». */
export function PaymentModal({ contactId }: { contactId: string }) {
  const { open } = useModal();
  const toast = useToast();
  const contact = useContact(contactId);
  const create = useCreatePayment();
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const back = () => open({ kind: 'contactFile', id: contactId });

  if (contact.isPending) {
    return (
      <Modal title="دفعة" onClose={back}>
        <Loading />
      </Modal>
    );
  }
  if (contact.isError) {
    return (
      <Modal title="دفعة" onClose={back}>
        <ErrorBox message={errorMessage(contact.error)} onRetry={() => contact.refetch()} />
      </Modal>
    );
  }
  const c = contact.data;
  const isC = c.type === 'CUSTOMER';
  // like the old window: the amount starts as the whole account, with a «💯 كل الحساب» button
  const amt = amount ?? (c.balance > 0 ? String(c.balance) : '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(paymentInput, { contactId, amount: amt, method, note });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      await create.mutateAsync(v.data);
      toast(isC ? 'تم تسجيل التحصيل' : 'تم تسجيل السداد');
      back();
    } catch (err) {
      setErrors(serverErrors(err));
    }
  };

  return (
    <Modal title={isC ? `تحصيل من ${c.name}` : `سداد لـ ${c.name}`} onClose={back}>
      <div className="card" style={{ background: 'var(--tint2)', border: 0, marginBottom: 12 }}>
        {isC ? 'المستحق حالياً' : 'الحساب حالياً'}: <b style={{ color: balanceColor(c.balance) }}>{isC ? money(c.balance) : balanceText(c)}</b>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <div className="field">
            <label>{isC ? 'المبلغ المستلم' : 'المبلغ اللي دفعته للمورد'}</label>
            <input inputMode="decimal" dir="ltr" value={amt} onChange={(e) => setAmount(e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,،]/g, '.').replace(/[^0-9.]/g, ''))} />
            {errors.amount && <span className="err">{errors.amount}</span>}
            {c.balance > 0 && (
              <button type="button" className="secondary" style={{ marginTop: 6, width: '100%' }} onClick={() => setAmount(String(c.balance))}>
                💯 كل الحساب ({money(c.balance)})
              </button>
            )}
          </div>
          <Select
            label="طريقة الدفع"
            value={method}
            onChange={(e) => setMethod(e.target.value as PayMethod)}
            options={PAY_METHODS.map((m) => ({ value: m, label: PAY_LABELS[m] }))}
          />
          <Input label="ملاحظة" placeholder="اختياري" value={note} onChange={(e) => setNote(e.target.value)} full />
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? '⏳ بيحفظ…' : isC ? 'حفظ الدفعة' : 'حفظ السداد'}
          </button>
          <button type="button" className="secondary" onClick={back}>
            {isC ? 'إلغاء' : 'رجوع'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
