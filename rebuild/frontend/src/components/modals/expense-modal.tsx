'use client';

import { useState, type FormEvent } from 'react';
import { PAY_METHODS, expenseInput, type ExpenseDto, type PayMethod } from '@mk/shared';
import { money, PAY_LABELS, todayYmd } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useCreateExpense, useDeleteExpense, useExpenseCategories, useExpenses, useUpdateExpense } from '@/lib/trade-queries';
import { Input, NumberInput, Select } from '../ui/field';
import { Modal } from '../ui/modal';
import { FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';
import { useCompany } from '../company';

export function ExpenseModal({ id, preset }: { id?: string; preset?: { note?: string; amount?: number } }) {
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
  return <ExpenseForm expense={id ? list.data?.items.find((e) => e.id === id) : undefined} preset={preset} />;
}

/** «تسجيل مصروف» — البيان، الفئة، المبلغ, like the old window. */
function ExpenseForm({ expense: x, preset }: { expense?: ExpenseDto; preset?: { note?: string; amount?: number } }) {
  const { close } = useModal();
  const toast = useToast();
  const cats = useExpenseCategories();
  const create = useCreateExpense();
  const { co } = useCompany();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [f, setF] = useState({
    note: x?.note ?? preset?.note ?? '',
    category: x?.category ?? 'عام',
    amount: x ? String(x.amount) : preset?.amount ? String(preset.amount) : '',
    method: (x?.method ?? 'CASH') as PayMethod,
    date: x?.date ?? todayYmd(),
  });
  const [focus, setFocus] = useState(false);
  const [hint, setHint] = useState('');
  // names typed before, newest first (the old expNames()): typing «ك» offers «كهرباء — آخر مرة 500»
  const recent = useExpenses({ page: 1, pageSize: 200 }).data?.items ?? [];
  const names = (() => {
    const m = new Map<string, { note: string; category: string; amount: number }>();
    recent.forEach((e) => {
      if (e.note && !m.has(e.note)) m.set(e.note, { note: e.note, category: e.category, amount: e.amount });
    });
    return [...m.values()];
  })();
  const q = vn(f.note);
  const sugg = names
    .filter((e) => !q || vn(e.note).includes(q))
    .sort((a, b) => Number(vn(b.note).startsWith(q)) - Number(vn(a.note).startsWith(q)))
    .slice(0, 8);
  const showSugg = focus && !x && sugg.length > 0 && !(sugg.length === 1 && sugg[0]!.note === f.note);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.note.trim()) return setErrors({ note: 'اكتب البيان' });
    const v = validate(expenseInput, f);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      if (x) await update.mutateAsync({ id: x.id, input: v.data });
      else await create.mutateAsync({ ...v.data, company: co });
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
            autoComplete="off"
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 250)}
          />
          {showSugg && (
            <div className="field full" style={{ marginTop: -8 }}>
              <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: '#fff' }}>
                {sugg.map((e) => (
                  <div
                    key={e.note}
                    style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setF({ ...f, note: e.note, category: e.category || f.category });
                      setHint(`آخر مرة ${e.amount}`);
                      setFocus(false);
                    }}
                  >
                    <b>{e.note}</b> <small style={{ color: 'var(--muted)' }}>{e.category} • آخر مرة {money(e.amount)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Input label="التاريخ" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Input label="الفئة" list="mk-exp-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} error={errors.category} />
          <datalist id="mk-exp-cats">{cats.data?.map((c) => <option key={c} value={c} />)}</datalist>
          <NumberInput label="المبلغ" placeholder={hint} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={errors.amount} />
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
