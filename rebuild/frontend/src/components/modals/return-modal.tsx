'use client';

import { useState, type FormEvent } from 'react';
import { returnInput, type ProductDto, type ReturnKind } from '@mk/shared';
import { money } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useContacts, useCreateReturn } from '@/lib/trade-queries';
import { ProductPicker } from '../product-picker';
import { Input, NumberInput, Select } from '../ui/field';
import { Modal } from '../ui/modal';
import { FormError } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/** «تسجيل مرتجع» — same fields as the old window, plus settling against the account when the person is known. */
export function ReturnModal({ type: initial }: { type: ReturnKind }) {
  const { close } = useModal();
  const toast = useToast();
  const create = useCreateReturn();
  const [kind, setKind] = useState<ReturnKind>(initial);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [person, setPerson] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [onAccount, setOnAccount] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const isSale = kind === 'SALE';
  const contacts = useContacts({ type: isSale ? 'CUSTOMER' : 'SUPPLIER', q: person.trim() || undefined, pageSize: 20 });
  const contact = contacts.data?.items.find((c) => c.name === person.trim()) ?? null;

  const pick = (p: ProductDto | null) => {
    setProduct(p);
    if (p) setPrice(String(isSale ? p.price : (p.cost ?? 0)));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(returnInput, {
      kind,
      productId: product?.id ?? '',
      qty,
      price,
      person: person.trim(),
      contactId: contact?.id,
      settlement: onAccount && contact ? 'BALANCE' : 'CASH',
      note,
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      await create.mutateAsync(v.data);
      toast('تم تسجيل المرتجع');
      close();
    } catch (err) {
      setErrors(serverErrors(err));
    }
  };

  const total = (Number(qty) || 0) * (Number(price) || 0);

  return (
    <Modal title="تسجيل مرتجع" onClose={close}>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <Select
            label="نوع المرتجع"
            full
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ReturnKind);
              setProduct(null);
              setPrice('');
            }}
            options={[
              { value: 'SALE', label: 'مرتجع بيع (عميل رجّع بضاعة)' },
              { value: 'PURCHASE', label: 'مرتجع شراء (رجّعت للمورد)' },
            ]}
          />
          <ProductPicker label="المنتج" value={product} onPick={pick} error={errors.productId} />
          <Input
            label={isSale ? 'العميل' : 'المورد'}
            placeholder="الاسم"
            list="mk-ret-people"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            error={errors.contactId}
          />
          <datalist id="mk-ret-people">{contacts.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <NumberInput label="الكمية" value={qty} onChange={(e) => setQty(e.target.value)} error={errors.qty} />
          <NumberInput label="سعر الوحدة" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
          <Input label="السبب" placeholder="اختياري" value={note} onChange={(e) => setNote(e.target.value)} />
          {contact && (
            <label className="chk field full">
              <input type="checkbox" checked={onAccount} onChange={(e) => setOnAccount(e.target.checked)} />
              {isSale ? 'يتخصم من حساب العميل بدل ما ترجعله فلوس' : 'يتخصم من حساب المورد بدل ما ياخد فلوس'}
            </label>
          )}
          <div className="field full">
            الإجمالي: <b>{money(total)}</b>
          </div>
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={create.isPending}>
            {create.isPending ? '⏳ بيحفظ…' : 'حفظ المرتجع'}
          </button>
          <button type="button" className="secondary" onClick={close}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
