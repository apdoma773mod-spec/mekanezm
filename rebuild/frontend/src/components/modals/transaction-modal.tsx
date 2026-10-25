'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { normalizeDigits, type InvoiceDto, type InvoiceKind, type ProductDto, type QuoteDto } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import { serverErrors, type FieldErrors } from '@/lib/form';
import { useQuote, useQuoteConverted, useSaveQuote } from '@/lib/phase4-queries';
import { useCompany } from '../company';
import {
  lookupProduct,
  useContacts,
  useCreateInvoice,
  useInvoice,
  useProducts,
  useUpdateInvoice,
} from '@/lib/trade-queries';
import { Input, NumberInput } from '../ui/field';
import { Modal } from '../ui/modal';
import { ErrorBox, FormError, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

interface Line {
  key: string;
  productId?: string;
  name: string;
  unit: string;
  available: number | null;
  qty: string;
  price: string;
}

const toNum = (s: string) => {
  const n = Number(normalizeDigits(s).replace(/[٫,،]/g, '.'));
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
let seq = 0;
const newKey = () => `l${++seq}`;

interface Props {
  type: InvoiceKind;
  editId?: string;
  person?: string;
  contactId?: string;
  /** «📝 عرض سعر»: the same window saves a quote instead (new, or editing quoteId). */
  asQuote?: boolean;
  quoteId?: string;
  /** «🧾 تحويل لفاتورة بيع»: a sale prefilled from this quote, which is marked converted after saving. */
  fromQuote?: string;
}

export function TransactionModal(props: Props) {
  const { close } = useModal();
  const existing = useInvoice(props.editId ?? null);
  const qid = props.quoteId ?? props.fromQuote ?? null;
  const quote = useQuote(qid);
  if ((props.editId && existing.isPending) || (qid && quote.isPending)) {
    return (
      <Modal title="تعديل الفاتورة" onClose={close}>
        <Loading />
      </Modal>
    );
  }
  if (props.editId && existing.isError) {
    return (
      <Modal title="تعديل الفاتورة" onClose={close}>
        <ErrorBox message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />
      </Modal>
    );
  }
  if (qid && quote.isError) {
    return (
      <Modal title="عرض سعر" onClose={close}>
        <ErrorBox message={errorMessage(quote.error)} onRetry={() => quote.refetch()} />
      </Modal>
    );
  }
  return <TransactionForm {...props} invoice={props.editId ? existing.data : undefined} quote={qid ? quote.data : undefined} />;
}

/** «تسجيل فاتورة بيع / شراء» — same fields and flow as the old openTransaction window. */
function TransactionForm({ type, person: presetPerson, invoice, quote, asQuote, fromQuote }: Props & { invoice?: InvoiceDto; quote?: QuoteDto }) {
  const { open, close } = useModal();
  const toast = useToast();
  const isSale = type === 'SALE';
  const create = useCreateInvoice();
  const update = useUpdateInvoice();
  const saveQuote = useSaveQuote();
  const { co } = useCompany();
  const converted = useQuoteConverted();
  const src = invoice ?? quote;

  const [lines, setLines] = useState<Line[]>(() =>
    src
      ? src.items.map((it) => ({
          key: newKey(),
          productId: it.productId ?? undefined,
          name: it.name,
          unit: it.unit,
          available: null,
          qty: String(it.qty),
          price: String(it.price),
        }))
      : [],
  );
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [person, setPerson] = useState(src?.person ?? presetPerson ?? '');
  const [phone, setPhone] = useState(src?.phone ?? '');
  const [address, setAddress] = useState(src?.address ?? '');
  const [shipping, setShipping] = useState(src && src.shipping ? String(src.shipping) : '');
  const [paid, setPaid] = useState(invoice ? String(invoice.paid) : '');
  const [paidTouched, setPaidTouched] = useState(!!invoice);
  const [note, setNote] = useState(src?.note ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 120);
    return () => clearTimeout(t);
  }, [search]);

  const results = useProducts({ q: debounced, pageSize: 15 }, debounced.replace(/\s+/g, '').length >= 2);
  const contacts = useContacts({ type: isSale ? 'CUSTOMER' : 'SUPPLIER', q: person.trim() || undefined, pageSize: 20 });

  const subtotal = useMemo(() => r2(lines.reduce((s, l) => s + toNum(l.qty) * toNum(l.price), 0)), [lines]);
  const total = r2(subtotal + toNum(shipping));
  const paidValue = paidTouched ? (paid === '' ? total : toNum(paid)) : total;
  const remaining = Math.max(0, r2(total - paidValue));

  const addProduct = (p: ProductDto) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === p.id);
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: String(toNum(l.qty) + 1) } : l));
      return [
        ...ls,
        {
          key: newKey(),
          productId: p.id,
          name: p.name,
          unit: p.unit,
          available: p.qty,
          qty: '1',
          price: String(isSale ? p.price : (p.cost ?? 0)),
        },
      ];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const addUnregistered = () => {
    const name = search.trim();
    if (!name) return;
    setLines((ls) => [...ls, { key: newKey(), name, unit: 'قطعة', available: 0, qty: '1', price: '0' }]);
    setSearch('');
    searchRef.current?.focus();
  };

  /** A barcode scanner types the code and presses Enter: add the exact match straight away. */
  const onSearchKey = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = search.trim();
    if (!code) return;
    try {
      addProduct(await lookupProduct(code));
    } catch {
      const first = results.data?.items[0];
      if (first) addProduct(first);
    }
  };

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const step = (l: Line, d: number) => setLine(l.key, { qty: String(Math.max(1, toNum(l.qty) + d)) });

  const pickPerson = (name: string) => {
    setPerson(name);
    const c = contacts.data?.items.find((x) => x.name === name);
    if (c) {
      if (c.phone) setPhone(c.phone);
      if (c.address) setAddress(c.address);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!lines.length) return toast('أضف صنف واحد على الأقل', 'bad');
    if (asQuote) {
      try {
        const q = await saveQuote.mutateAsync({
          id: quote?.id,
          input: {
            person: person.trim(),
            phone,
            address,
            note,
            shipping: toNum(shipping),
            items: lines.map((l) => ({ productId: l.productId, name: l.name, unit: l.unit, qty: toNum(l.qty), price: toNum(l.price) })),
          },
        });
        toast('تم حفظ عرض السعر');
        open({ kind: 'quoteView', id: q.id });
      } catch (err) {
        const fe = serverErrors(err);
        setErrors(fe);
        toast(fe._ ?? errorMessage(err), 'bad');
      }
      return;
    }
    if (paidValue > total + 0.001) return toast('المدفوع أكبر من إجمالي الفاتورة', 'bad');
    if (total - paidValue > 0.001 && !person.trim()) {
      return toast(isSale ? 'اكتب اسم العميل عشان نسجل الباقي عليه' : 'اكتب اسم المورد عشان نسجل الباقي ليه', 'bad');
    }
    if (isSale) {
      const short = lines.filter((l) => l.available !== null && toNum(l.qty) > l.available).map((l) => l.name);
      if (short.length) toast(`⚠️ الرصيد هيبقى بالسالب: ${short.slice(0, 3).join(' • ')}`);
    }
    const body = {
      person: person.trim(),
      phone,
      address,
      note,
      shipping: toNum(shipping),
      paid: paidValue,
      items: lines.map((l) => ({ productId: l.productId, name: l.name, qty: toNum(l.qty), price: toNum(l.price) })),
    };
    try {
      const saved = invoice
        ? await update.mutateAsync({ id: invoice.id, input: { ...body, company: invoice.company, payMethod: invoice.payMethod, discount: invoice.discount } })
        : await create.mutateAsync({ ...body, kind: type, company: co, discount: 0, payMethod: 'CASH' });
      if (fromQuote) await converted.mutateAsync({ id: fromQuote, invoiceId: saved.id }).catch(() => undefined);
      toast(invoice ? 'تم حفظ التعديل' : isSale ? 'تم تسجيل البيع' : 'تم تسجيل الشراء');
      open({ kind: 'invoice', id: saved.id });
    } catch (err) {
      const fe = serverErrors(err);
      setErrors(fe);
      toast(fe._ ?? errorMessage(err), 'bad');
    }
  };

  const busy = create.isPending || update.isPending || saveQuote.isPending;
  const title = asQuote
    ? quote
      ? `تعديل عرض سعر ${quote.no}`
      : '📝 عرض سعر جديد'
    : fromQuote && quote
      ? `فاتورة بيع من عرض السعر ${quote.no}`
      : invoice
        ? `تعديل فاتورة ${invoice.no}`
        : isSale
          ? 'تسجيل فاتورة بيع'
          : 'تسجيل فاتورة شراء';
  const showBox = debounced.replace(/\s+/g, '').length >= 2 && search.trim() !== '';

  return (
    <Modal title={title} onClose={close}>
      <form onSubmit={submit} noValidate>
        <div className="form">
          <div className="field full">
            <label htmlFor="txSearch">ابحث عن الصنف واختاره</label>
            <input
              id="txSearch"
              ref={searchRef}
              type="search"
              autoComplete="off"
              name="mk-noauto-item"
              placeholder="اكتب اسم الصنف أو كوده أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
            />
            {showBox && (
              <div className="txbox">
                {results.isPending ? (
                  <div style={{ color: '#888' }}>⏳</div>
                ) : results.data?.items.length ? (
                  results.data.items.map((p) => (
                    <div key={p.id} onClick={() => addProduct(p)}>
                      {p.name}{' '}
                      <small style={{ color: '#7a8a8f' }}>
                        ({qtyText(p.qty)} {p.unit})
                      </small>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#888' }}>مفيش صنف بالاسم ده</div>
                )}
                <div style={{ color: 'var(--blue)', fontWeight: 700 }} onClick={addUnregistered}>
                  ＋ إضافة «{search.trim()}» كصنف غير مسجل
                </div>
              </div>
            )}
          </div>

          <div className="field full">
            {lines.map((l) => {
              const lineTotal = r2(toNum(l.qty) * toNum(l.price));
              return (
                <div key={l.key} className="txl">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <b>{l.name}</b>
                    <button
                      type="button"
                      className="secondary danger"
                      style={{ padding: '2px 10px' }}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      aria-label="شيل الصنف"
                    >
                      ✕
                    </button>
                  </div>
                  {l.available !== null && (
                    <small style={{ color: '#7a8a8f' }}>
                      المتاح: {qtyText(l.available)} {l.unit}
                      {!l.productId && ' — صنف غير مسجل، هيتسجل مع الفاتورة'}
                    </small>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
                    <div>
                      <small>العدد</small>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="secondary step" onClick={() => step(l, -1)}>
                          −
                        </button>
                        <input
                          inputMode="decimal"
                          dir="ltr"
                          value={l.qty}
                          onChange={(e) => setLine(l.key, { qty: normalizeDigits(e.target.value).replace(/[^0-9.]/g, '') })}
                          style={{ width: 64, textAlign: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
                        />
                        <button type="button" className="secondary step" onClick={() => step(l, 1)}>
                          ＋
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 90 }}>
                      <small>{isSale ? 'سعر البيع' : 'سعر الشراء'}</small>
                      <input
                        inputMode="decimal"
                        dir="ltr"
                        value={l.price}
                        onChange={(e) => setLine(l.key, { price: normalizeDigits(e.target.value).replace(/[^0-9.]/g, '') })}
                        style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}
                      />
                    </div>
                    <div>
                      <small>الإجمالي</small>
                      <div style={{ fontWeight: 700, padding: '10px 0' }}>{money(lineTotal)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <NumberInput
            label="🚚 مصاريف النقل (اختياري — بتتضاف على الإجمالي)"
            placeholder="0"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            error={errors.shipping}
            full
          />
          <div className="field full" style={{ fontSize: 18 }}>
            <span>
              إجمالي الفاتورة: <b>{money(total)}</b>
            </span>
          </div>
          {asQuote && (
            <div className="field full" style={{ background: 'var(--tint2)', borderRadius: 12, padding: 10, fontSize: 13 }}>
              📝 عرض السعر مش بيخصم من المخزون ومش بيدخل في المبيعات أو التقارير. تقدر تحوّله لفاتورة بيع بعدين بضغطة.
            </div>
          )}

          <Input
            label={isSale ? 'العميل' : 'المورد'}
            placeholder="الاسم"
            value={person}
            list="mk-people"
            onChange={(e) => pickPerson(e.target.value)}
            error={errors.person}
          />
          <datalist id="mk-people">{contacts.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <Input
            label={isSale ? 'تليفون العميل' : 'تليفون المورد'}
            type="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          {isSale && (
            <Input label="عنوان العميل (اختياري)" value={address} onChange={(e) => setAddress(e.target.value)} full />
          )}
          {!asQuote && (
            <>
              <NumberInput
                label={isSale ? 'المدفوع الآن' : 'المدفوع للمورد'}
                value={paidTouched ? paid : total ? String(total) : ''}
                onChange={(e) => {
                  setPaidTouched(true);
                  setPaid(e.target.value);
                }}
                error={errors.paid}
              />
              <Input label={isSale ? 'المتبقي على العميل' : 'المتبقي للمورد'} readOnly value={String(remaining)} dir="ltr" />
            </>
          )}
          <Input
            label="البيان"
            placeholder={asQuote ? 'مثلاً: العرض ساري لمدة أسبوع' : 'ملاحظات اختيارية'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            full
          />
          <FormError message={errors._} />
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={busy}>
            {busy ? '⏳ بيحفظ…' : asQuote ? 'حفظ عرض السعر' : 'حفظ العملية'}
          </button>
          <button type="button" className="secondary" onClick={close}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
