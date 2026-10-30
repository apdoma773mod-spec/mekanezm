'use client';

import { useState, type FormEvent } from 'react';
import { productInput, updateProductInput, type ProductDto } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { formatDateTime, money, qtyText } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import {
  useAdjustStock,
  useCategories,
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useProductMoves,
  useProducts,
  useUpdateProduct,
} from '@/lib/trade-queries';
import { useAlts } from '@/lib/phase4-queries';
import { useCompany } from '../company';
import { Icon } from '../icon';
import { Input, NumberInput, Select } from '../ui/field';
import { Modal } from '../ui/modal';
import { ErrorBox, FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

const UNITS = ['قطعة', 'كرتونة', 'متر', 'طقم', 'لفة', 'رول', 'علبة', 'كيس', 'زوج', 'دستة', 'عبوة', 'كيلو', 'لتر', 'لوح'];

const REASON_LABELS: Record<string, string> = {
  SALE: 'بيع',
  PURCHASE: 'شراء',
  SALE_RETURN: 'مرتجع بيع',
  PURCHASE_RETURN: 'مرتجع شراء',
  ADJUST: 'تعديل',
  INVOICE_EDIT: 'تعديل فاتورة',
  INVOICE_VOID: 'إلغاء فاتورة',
  DAYBOOK: 'يومية المحل',
  COUNT: 'جرد',
  GIFT: 'هدية',
  GRADE: 'درجة تانية',
  SAMPLE: 'عينة',
};

function Moves({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const moves = useProductMoves(id, page);
  if (moves.isPending) return <Loading />;
  if (moves.isError) return <ErrorBox message={errorMessage(moves.error)} />;
  if (!moves.data.items.length) return <div className="empty">لا توجد حركات.</div>;
  return (
    <>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الحركة</th>
              <th>الكمية</th>
              <th>الرصيد بعدها</th>
            </tr>
          </thead>
          <tbody>
            {moves.data.items.map((m) => (
              <tr key={m.id}>
                <td>{formatDateTime(m.createdAt)}</td>
                <td>
                  {REASON_LABELS[m.reason] ?? m.reason}
                  {m.refLabel ? ` ${m.refLabel}` : ''}
                  {m.note ? <small style={{ color: 'var(--muted)' }}> — {m.note}</small> : null}
                </td>
                <td dir="ltr" style={{ textAlign: 'right', color: m.qtyChange < 0 ? 'var(--danger)' : 'var(--green)' }}>
                  {m.qtyChange > 0 ? '+' : ''}
                  {qtyText(m.qtyChange)}
                </td>
                <td>{qtyText(m.qtyAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {moves.data.total > moves.data.page * moves.data.pageSize && (
        <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => setPage(page + 1)}>
          أقدم…
        </button>
      )}
    </>
  );
}

export function ProductModal({ id }: { id?: string }) {
  const { close } = useModal();
  const existing = useProduct(id ?? null);
  if (id && existing.isPending) {
    return (
      <Modal title="الصنف" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  if (id && existing.isError) {
    return (
      <Modal title="الصنف" onClose={close}>
        <ErrorBox message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />
      </Modal>
    );
  }
  return <ProductForm product={id ? existing.data : undefined} />;
}

/** «🎁 هدية» «⚠️ مخربش؟ درجة تانية» «🔁 بدائل» and the alternatives line under them. */
export function ExtraButtons({ product: p }: { product: ProductDto }) {
  const { open } = useModal();
  const alts = useAlts();
  const ids = alts.data?.[p.id] ?? [];
  const list = useProducts({ pageSize: 200 }, ids.length > 0).data?.items.filter((x) => ids.includes(x.id)) ?? [];
  return (
    <>
      <div className="btnrow" style={{ marginTop: 12 }}>
        <button type="button" className="secondary" onClick={() => open({ kind: 'gift', productId: p.id })}>
          🎁 هدية
        </button>
        <button type="button" className="secondary" onClick={() => open({ kind: 'grade', productId: p.id })}>
          ⚠️ مخربش؟ درجة تانية
        </button>
        <button type="button" className="secondary" onClick={() => open({ kind: 'alts', productId: p.id })}>
          🔁 بدائل
        </button>
      </div>
      {list.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <b>🔁 البدائل{p.qty <= 0 ? ' (الصنف ده خلصان)' : ''}:</b>{' '}
          {list.map((a) => (
            <a
              key={a.id}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                open({ kind: 'product', id: a.id });
              }}
              style={{
                display: 'inline-block',
                margin: 3,
                padding: '3px 10px',
                borderRadius: 99,
                background: a.qty > 0 ? '#e3f4f5' : '#f3f3f3',
                color: a.qty > 0 ? '#087f8c' : '#999',
                textDecoration: 'none',
              }}
            >
              {a.name} ({a.qty > 0 ? qtyText(a.qty) : 'خلص'})
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function ProductForm({ product: p }: { product?: NonNullable<ReturnType<typeof useProduct>['data']> }) {
  const { close } = useModal();
  const toast = useToast();
  const categories = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const adjust = useAdjustStock();
  const remove = useDeleteProduct();
  const { co } = useCompany();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [f, setF] = useState({
    code: p?.code ?? '',
    name: p?.name ?? '',
    barcode: p?.barcode ?? '',
    category: p?.category ?? 'إكسسوارات مطابخ',
    qty: String(p?.qty ?? 0),
    cost: String(p?.cost ?? 0),
    price: String(p?.price ?? 0),
    minQty: String(p?.minQty ?? 5),
    unit: p?.unit ?? 'قطعة',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const busy = create.isPending || update.isPending || adjust.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { qty, ...fields } = f;
    setErrors({});
    try {
      if (!p) {
        const v = validate(productInput, { ...f, code: f.code || undefined });
        if (!v.ok) return setErrors(v.errors);
        await create.mutateAsync({ ...v.data, company: co });
      } else {
        const v = validate(updateProductInput, fields);
        if (!v.ok) return setErrors(v.errors);
        await update.mutateAsync({ id: p.id, input: v.data });
        const newQty = Number(qty);
        if (!Number.isFinite(newQty)) return setErrors({ qty: 'اكتب رقم صحيح' });
        if (newQty !== p.qty) {
          await adjust.mutateAsync({ id: p.id, input: { newQty, note: 'تعديل من شاشة الصنف' } });
        }
      }
      toast('تم حفظ المنتج');
      close();
    } catch (err) {
      setErrors(serverErrors(err));
    }
  };

  const doDelete = async () => {
    if (!p) return;
    try {
      await remove.mutateAsync(p.id);
      toast('تم حذف المنتج');
      close();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  };

  return (
    <Modal
      title={
        <>
          <span className="pico">
            <Icon name="box" />
          </span>
          {p ? p.name : 'إضافة منتج جديد'}
        </>
      }
      onClose={close}
    >
      <form onSubmit={submit} noValidate>
        <div className="form">
          <Input
            label={`كود المنتج${p ? '' : ' (اختياري)'}`}
            value={f.code}
            onChange={set('code')}
            placeholder={p ? '' : 'سيبه فاضي = كود أوتوماتيك'}
            dir="ltr"
            error={errors.code}
          />
          <Input label="اسم المنتج" value={f.name} onChange={set('name')} error={errors.name} />
          <Input label="التصنيف" value={f.category} onChange={set('category')} list="mk-cats" error={errors.category} />
          <datalist id="mk-cats">{categories.data?.map((c) => <option key={c} value={c} />)}</datalist>
          <NumberInput label="الكمية" value={f.qty} onChange={set('qty')} error={errors.qty} />
          <NumberInput label="سعر الشراء" value={f.cost} onChange={set('cost')} error={errors.cost} />
          <NumberInput label="سعر البيع" value={f.price} onChange={set('price')} error={errors.price} />
          <NumberInput label="حد التنبيه" value={f.minQty} onChange={set('minQty')} error={errors.minQty} />
          <Select
            label="الوحدة"
            value={f.unit}
            onChange={set('unit')}
            options={[...new Set([...UNITS, f.unit])].map((u) => ({ value: u, label: u }))}
          />
          <Input label="الباركود (اختياري)" value={f.barcode} onChange={set('barcode')} dir="ltr" inputMode="numeric" error={errors.barcode} full />
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={busy}>
            {busy ? '⏳ بيحفظ…' : 'حفظ التعديلات'}
          </button>
          {p &&
            (confirmDelete ? (
              <button type="button" className="secondary danger" onClick={doDelete} disabled={remove.isPending}>
                متأكد؟ كوده ({p.code}) مش هيتعاد لصنف تاني
              </button>
            ) : (
              <button type="button" className="secondary danger" onClick={() => setConfirmDelete(true)}>
                حذف الصنف
              </button>
            ))}
          <button type="button" className="secondary" onClick={close}>
            إلغاء
          </button>
        </div>
      </form>
      {p && <ExtraButtons product={p} />}
      {p && (
        <>
          <h3 style={{ margin: '18px 0 8px' }}>حركة الصنف</h3>
          <p style={{ color: 'var(--muted)', margin: '0 0 8px', fontSize: 13 }}>
            المتاح: {qtyText(p.qty)} {p.unit} — قيمة المخزون: {money(p.qty * (p.cost ?? 0))}
          </p>
          <Moves id={p.id} />
        </>
      )}
    </Modal>
  );
}
