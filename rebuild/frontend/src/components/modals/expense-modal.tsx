'use client';

import { useState, type FormEvent } from 'react';
import { PAY_METHODS, expenseInput, type ExpenseDto, type PayMethod } from '@mk/shared';
import { PAY_LABELS } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useCreateExpense, useDeleteExpense, useExpenseCategories, useExpenses, useUpdateExpense } from '@/lib/trade-queries';
import { Input, NumberInput, Select } from '../ui/field';
import { Modal } from '../ui/modal';
import { FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

export function ExpenseModal({ id }: { id?: string }) {
  const { close } = useModal();
  // Expenses are opened from the cash screen's list, which is already cached.
  const list = useExpenses({ pageSize: 200 });
  if (id && list.isPending) {
    return (
      <Modal title="مصروف" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  return <ExpenseForm expense={id ? list.data?.items.find((e) => e.id === id) : undefined} />;
}

/** «تسجيل مصروف» — البيان، الفئة، المبلغ, like the old window. */
function ExpenseForm({ expense: x }: { expense?: ExpenseDto }) {
  const { close } = useModal();
  const toast = useToast();
  const cats = useExpenseCategories();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [f, setF] = useState({
    note: x?.note ?? '',
    category: x?.category ?? 'عام',
    amount: x ? String(x.amount) : '',
    method: (x?.method ?? 'CASH') as PayMethod,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.note.trim()) return setErrors({ note: 'اكتب البيان' });
    const v = validate(expenseInput, f);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      if (x) await update.mutateAsync({ id: x.id, input: v.data });
      else await create.mutateAsync(v.data);
      toast('تم تسجيل المصروف');
      close();
    } catch (err) {
      setErrors(serverErrors(err));
    }
  };

  return (
    <Modal title={x ? 'تعديل مصروف' : 'تسجيل مصروف'} onClose={close}>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <Input
            label="البيان"
            placeholder="مثال: كهرباء / نقل / إيجار"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
            error={errors.note}
            full
          />
          <Input label="الفئة" list="mk-exp-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} error={errors.category} />
          <datalist id="mk-exp-cats">{cats.data?.map((c) => <option key={c} value={c} />)}</datalist>
          <NumberInput label="المبلغ" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={errors.amount} />
          <Select
            label="اتدفع من"
            value={f.method}
            onChange={(e) => setF({ ...f, method: e.target.value as PayMethod })}
            options={PAY_METHODS.map((m) => ({ value: m, label: PAY_LABELS[m] }))}
          />
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={create.isPending || update.isPending}>
            حفظ المصروف
          </button>
          {x &&
            (confirm ? (
              <button
                type="button"
                className="secondary danger"
                disabled={remove.isPending}
                onClick={async () => {
                  await remove.mutateAsync(x.id);
                  toast('تم حذف المصروف');
                  close();
                }}
              >
                متأكد؟ حذف
              </button>
            ) : (
              <button type="button" className="secondary danger" onClick={() => setConfirm(true)}>
                حذف
              </button>
            ))}
          <button type="button" className="secondary" onClick={close}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
