'use client';

import { useState, type FormEvent } from 'react';
import { contactInput, updateContactInput, type ContactDto, type ContactType } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useContact, useCreateContact, useUpdateContact } from '@/lib/trade-queries';
import { Input, NumberInput, Select, Textarea } from '../ui/field';
import { Modal } from '../ui/modal';
import { ErrorBox, FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

export function ContactModal({ id, type, preset }: { id?: string; type?: ContactType; preset?: { name?: string; phone?: string } }) {
  const { close } = useModal();
  const existing = useContact(id ?? null);
  if (id && existing.isPending) {
    return (
      <Modal title="تعديل البيانات" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  if (id && existing.isError) {
    return (
      <Modal title="تعديل البيانات" onClose={close}>
        <ErrorBox message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />
      </Modal>
    );
  }
  return <ContactForm contact={id ? existing.data : undefined} fixedType={type} preset={preset} />;
}

/** «إضافة عميل / مورد» and «تعديل بيانات …» from the old system. */
function ContactForm({ contact: c, fixedType, preset }: { contact?: ContactDto; fixedType?: ContactType; preset?: { name?: string; phone?: string } }) {
  const { open, close } = useModal();
  const toast = useToast();
  const create = useCreateContact();
  const update = useUpdateContact();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [f, setF] = useState({
    name: c?.name ?? preset?.name ?? '',
    type: (c?.type ?? fixedType ?? 'CUSTOMER') as ContactType,
    phone: c?.phone ?? preset?.phone ?? '',
    address: c?.address ?? '',
    openingBalance: '0',
    note: c?.note ?? '',
  });
  /** أرقام تانية بمسمياتها (الرقم الأساسي فوق في «الهاتف»). */
  const [extra, setExtra] = useState<{ n: string; l: string }[]>(() => (c?.phones ?? []).map((p) => ({ n: p.n, l: p.l })));
  const setX = (i: number, p: Partial<{ n: string; l: string }>) => setExtra((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const cleanExtra = () => extra.map((x) => ({ n: x.n.trim(), l: x.l.trim() })).filter((x) => x.n);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const back = () => (c ? open({ kind: 'contactFile', id: c.id }) : close());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      if (c) {
        const v = validate(updateContactInput, { name: f.name, phone: f.phone, phones: cleanExtra(), address: f.address, note: f.note });
        if (!v.ok) return setErrors(v.errors);
        await update.mutateAsync({ id: c.id, input: v.data });
        toast('تم حفظ البيانات');
        open({ kind: 'contactFile', id: c.id });
      } else {
        const v = validate(contactInput, { ...f, phones: cleanExtra() });
        if (!v.ok) return setErrors(v.errors);
        const created = await create.mutateAsync(v.data);
        toast('تم حفظ البيانات');
        open({ kind: 'contactFile', id: created.id });
      }
    } catch (err) {
      setErrors(serverErrors(err));
    }
  };

  return (
    <Modal title={c ? `تعديل بيانات ${c.name}` : fixedType ? (fixedType === 'CUSTOMER' ? 'إضافة عميل' : 'إضافة مورد') : 'إضافة عميل / مورد'} onClose={back}>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <Input label="الاسم" value={f.name} onChange={set('name')} error={errors.name} />
          {!fixedType && (
          <Select
            label="النوع"
            value={f.type}
            onChange={set('type')}
            disabled={!!c}
            options={[
              { value: 'CUSTOMER', label: 'عميل' },
              { value: 'SUPPLIER', label: 'مورد' },
            ]}
          />
          )}
          <Input label="الهاتف (الأساسي)" type="tel" dir="ltr" value={f.phone} onChange={set('phone')} error={errors.phone} />
          <div className="field full cphones">
            {extra.map((x, i) => (
              <div key={i} className="cph-row">
                <input type="tel" dir="ltr" placeholder="رقم تاني" value={x.n} onChange={(e) => setX(i, { n: e.target.value })} />
                <input placeholder="صاحب الرقم (صاحب المؤسسة، موظف، أرضي…)" value={x.l} list="mk-phone-labels" onChange={(e) => setX(i, { l: e.target.value })} />
                <button type="button" className="secondary danger" aria-label="شيل الرقم" onClick={() => setExtra((xs) => xs.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            {errors.phones && <small style={{ color: 'var(--danger)' }}>{errors.phones}</small>}
            <datalist id="mk-phone-labels">
              {['صاحب المؤسسة', 'موظف', 'أرضي', 'واتساب', 'حسابات', 'مبيعات'].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button type="button" className="secondary" disabled={extra.length >= 8} onClick={() => setExtra((xs) => [...xs, { n: '', l: '' }])}>
              ➕ رقم تاني (صاحب المؤسسة / موظف / أرضي)
            </button>
          </div>
          {c ? (
            <Input label="العنوان" value={f.address} onChange={set('address')} error={errors.address} />
          ) : (
            <NumberInput
              label="الرصيد (المبلغ المستحق)"
              value={f.openingBalance}
              onChange={set('openingBalance')}
              error={errors.openingBalance}
              hint={f.type === 'CUSTOMER' ? 'اللي عليه من قبل كده (سالب لو ليه)' : 'اللي ليه عندك من قبل كده (سالب لو لينا)'}
            />
          )}
          {!c && <Input label="العنوان" value={f.address} onChange={set('address')} error={errors.address} full />}
          <Textarea label="ملاحظات" value={f.note} onChange={set('note')} error={errors.note} full />
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={create.isPending || update.isPending}>
            حفظ
          </button>
          <button type="button" className="secondary" onClick={back}>
            {c ? 'رجوع' : 'إلغاء'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
