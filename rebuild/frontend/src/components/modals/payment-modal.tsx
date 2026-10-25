'use client';

import { useState, type FormEvent } from 'react';
import { PAY_METHODS, paymentInput, type PayMethod } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { balanceColor, balanceText, PAY_LABELS } from '@/lib/format';
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
  const [amount, setAmount] = useState('');
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(paymentInput, { contactId, amount, method, note });
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
    <Modal title={isC ? `تحصيل دفعة من ${c.name}` : `سداد للمورد ${c.name}`} onClose={back}>
      <div className="card" style={{ background: 'var(--tint2)', border: 0, marginBottom: 12 }}>
        الحساب: <b style={{ color: balanceColor(c.balance) }}>{balanceText(c)}</b>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <NumberInput label="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
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
            {create.isPending ? '⏳ بيحفظ…' : 'حفظ'}
          </button>
          <button type="button" className="secondary" onClick={back}>
            رجوع
          </button>
        </div>
      </form>
    </Modal>
  );
}
