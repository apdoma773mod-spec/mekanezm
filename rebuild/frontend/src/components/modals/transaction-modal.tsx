'use client';

import { CustomerBar } from '@/components/modals/customer-bar';
import { termsFor, useTerms } from '@/lib/terms';
import { useCreditLimits } from '@/lib/kv';
import { useIsAdmin } from '../use-role';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { GOVS, normalizeDigits, type InvoiceDto, type InvoiceKind, type InvoiceListResult, type ProductDto, type QuoteDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import { serverErrors, type FieldErrors } from '@/lib/form';
import { useCreateShipment, useQuote, useQuoteConverted, useSaveQuote } from '@/lib/phase4-queries';
import { CameraScanner } from '../scan/camera-scanner';
import { useAllProductInfo } from '@/lib/trade-queries';
import { useCompany } from '../company';
import {
  checkDuplicatePurchase,
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
  /** The unit the line is typed in: 1 = the product's own unit, 12 = «علبة» of 12 pieces, 0.004 = one loose piece of a kilo. */
  un?: number;
  unLabel?: string;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
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
  /** A sale prepared elsewhere (work orders): lines, customer and note filled in; onSaved runs after it is saved. */
  preset?: SalePreset;
}

export interface SalePreset {
  person?: string;
  phone?: string;
  note?: string;
  paid?: number;
  lines: { productId?: string; name: string; qty: number; price: number }[];
  onSaved?: (invoice: { id: string; no: string }) => Promise<void> | void;
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
function TransactionForm({ type, person: presetPerson, invoice, quote, asQuote, fromQuote, preset }: Props & { invoice?: InvoiceDto; quote?: QuoteDto }) {
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
      : (preset?.lines ?? []).map((it) => ({ key: newKey(), productId: it.productId, name: it.name, unit: 'قطعة', available: null, qty: String(it.qty), price: String(it.price) })),
  );
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [person, setPerson] = useState(src?.person ?? presetPerson ?? preset?.person ?? '');
  const [phone, setPhone] = useState(src?.phone ?? preset?.phone ?? '');
  const [address, setAddress] = useState(src?.address ?? '');
  const [shipping, setShipping] = useState(src && src.shipping ? String(src.shipping) : '');
  const [paid, setPaid] = useState(invoice ? String(invoice.paid) : preset?.paid !== undefined ? String(preset.paid) : '');
  const [paidTouched, setPaidTouched] = useState(!!invoice || preset?.paid !== undefined);
  const [note, setNote] = useState(src?.note ?? preset?.note ?? '');
  const [sno, setSno] = useState('');
  const [del, setDel] = useState<'' | 'DELIVERY' | 'SHIP'>('');
  const [gov, setGov] = useState('');
  const [area, setArea] = useState('');
  const [autoPaid, setAutoPaid] = useState(false);
  const [scanning, setScanning] = useState(false);
  const shipment = useCreateShipment();
  // the packs (كرتونة/دستة) list is only needed once a stock item is in the invoice
  const infos = useAllProductInfo(lines.some((l) => !!l.productId)).data ?? {};
  const [errors, setErrors] = useState<FieldErrors>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 120);
    return () => clearTimeout(t);
  }, [search]);

  const results = useProducts({ q: debounced, pageSize: 15 }, debounced.replace(/\s+/g, '').length >= 2);
  const contacts = useContacts({ type: isSale ? 'CUSTOMER' : 'SUPPLIER', q: person.trim() || undefined, pageSize: 20 });

  // 🏷️ سعر العميل: خصمه الثابت بيتطبّق على الصنف أول ما يتضاف، وحد دينه بيحذّر قبل الحفظ
  const termsQ = useTerms(isSale);
  const cterm = isSale ? termsFor(termsQ.data, person) : null;
  const contactNow = contacts.data?.items.find((c) => c.name === person.trim());
  // 🚦 حد الآجل من «تحليلات ذكية»: حد لكل عميل أو حد افتراضي — بيتحط في نفس الشريط والتحذير (لو مفيش حد في «أسعار وحدود العملاء»)
  const isAdmin = useIsAdmin();
  const credit = useCreditLimits(isSale && isAdmin);
  const creditLimit = isSale && person.trim() ? +(credit.data?.lim[person.trim()] ?? credit.data?.def ?? 0) || 0 : 0;
  const limit = cterm?.t.limit || creditLimit || 0;
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
          price: String(isSale ? (cterm?.t.pct ? Math.round(p.price * (1 - cterm.t.pct / 100) * 100) / 100 : p.price) : (p.cost ?? 0)),
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

  const delChanged = (v: '' | 'DELIVERY' | 'SHIP') => {
    setDel(v);
    if (v === 'DELIVERY' && !['القاهرة', 'الجيزة'].includes(gov)) setGov('الجيزة');
    if (v && !paidTouched) {
      setPaid('0');
      setPaidTouched(true);
      setAutoPaid(true);
    } else if (!v && autoPaid) {
      setPaidTouched(false);
      setPaid('');
      setAutoPaid(false);
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
            items: lines.map((l) => ({ productId: l.productId, name: l.name, unit: l.unit, qty: r4(toNum(l.qty) * (l.un || 1)), price: r4(toNum(l.price) / (l.un || 1)) })),
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
    if (isSale && del) {
      if (!person.trim()) return toast('اكتب اسم العميل — الشحنة محتاجاه', 'bad');
      if (phone.replace(/\D/g, '').length < 8) return toast('اكتب تليفون العميل — شركة الشحن/المندوب هيكلمه', 'bad');
      if (del === 'SHIP' && !gov) return toast('اختار المحافظة', 'bad');
      if (del === 'SHIP' && !address.trim()) return toast('اكتب عنوان العميل', 'bad');
    }
    if (paidValue > total + 0.001) return toast('المدفوع أكبر من إجمالي الفاتورة', 'bad');
    if (total - paidValue > 0.001 && !person.trim()) {
      return toast(isSale ? 'اكتب اسم العميل عشان نسجل الباقي عليه' : 'اكتب اسم المورد عشان نسجل الباقي ليه', 'bad');
    }
    if (isSale && !invoice && limit && remaining > 0) {
      const bal = contactNow?.balance ?? 0;
      if (bal + remaining > limit && !window.confirm(`⚠️ ${person.trim()}
عليه دلوقتي ${money(bal)} + الباقي في الفاتورة دي ${money(remaining)} = ${money(bal + remaining)}
وحد دينه ${money(limit)}.

تكمّل الفاتورة برضو؟`)) return;
    }
    if (isSale) {
      const short = lines.filter((l) => l.available !== null && toNum(l.qty) * (l.un || 1) > l.available).map((l) => l.name);
      if (short.length) toast(`⚠️ الرصيد هيبقى بالسالب: ${short.slice(0, 3).join(' • ')}`);
    }
    if (!isSale && !invoice && person.trim() && total > 0) {
      const dup = await checkDuplicatePurchase({ person: person.trim(), total, sno: sno.trim() || undefined }).catch(() => null);
      if (dup && !window.confirm(`⚠️ فيه فاتورة شراء بنفس المورد ${sno.trim() ? 'ونفس رقم الفاتورة ' : 'ونفس الإجمالي النهارده '}(${dup.no} — ${money(total)}). تحفظ تاني برضه؟`)) return;
    }
    if (isSale && !invoice && !asQuote && total > 0) {
      // 🧾 same customer + same total in the last 3 minutes = probably saved twice (double tap)
      const recent = await api
        .get<InvoiceListResult>('/invoices', { kind: 'SALE', ...(person.trim() ? { person: person.trim() } : {}), pageSize: 5 })
        .catch(() => null);
      const twin = recent?.items.find((r) => r.status !== 'VOID' && Math.abs(r.total - total) < 0.01 && Date.now() - new Date(r.createdAt).getTime() < 3 * 60_000);
      if (twin && !window.confirm(`⚠️ لسه متسجلة فاتورة ${twin.no} بنفس ${person.trim() ? 'العميل و' : ''}الإجمالي (${money(total)}) من دقايق. تسجّلها تاني برضه؟`)) return;
    }
    const noteOut = !isSale && !invoice && sno.trim() && !/فاتورة المورد:/.test(note) ? `فاتورة المورد: ${sno.trim()}${note ? ` — ${note}` : ''}` : note;
    const body = {
      person: person.trim(),
      phone,
      address,
      note: noteOut,
      shipping: toNum(shipping),
      paid: paidValue,
      items: lines.map((l) => ({ productId: l.productId, name: l.name, qty: r4(toNum(l.qty) * (l.un || 1)), price: r4(toNum(l.price) / (l.un || 1)) })),
    };
    try {
      const saved = invoice
        ? await update.mutateAsync({ id: invoice.id, input: { ...body, company: invoice.company, payMethod: invoice.payMethod, discount: invoice.discount } })
        : await create.mutateAsync({ ...body, kind: type, company: co, discount: 0, payMethod: 'CASH' });
      if (isSale && del && !invoice) {
        try {
          await shipment.mutateAsync({
            kind: del,
            invoiceNo: saved.no,
            name: person.trim(),
            phone,
            phone2: '',
            gov,
            area: area.trim(),
            address: address.trim(),
            carrier: '',
            tracking: '',
            driver: '',
            driverPhone: '',
            cod: saved.remaining,
            fee: 0,
            pieces: 1,
            content: saved.items.map((x) => x.name).join('، ').slice(0, 480),
            note: '',
          });
        } catch (e) {
          toast(`الفاتورة اتسجلت، بس الشحنة لأ: ${errorMessage(e)}`, 'bad');
        }
      }
      if (fromQuote) await converted.mutateAsync({ id: fromQuote, invoiceId: saved.id }).catch(() => undefined);
      if (!invoice && preset?.onSaved) {
        try {
          await preset.onSaved({ id: saved.id, no: saved.no });
        } catch (e) {
          window.alert(`⚠️ الفاتورة اتحفظت ✔ بس الخطوة اللي بعدها ماكملتش:\n${errorMessage(e)}`);
        }
      }
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
            <div className="txsrow">
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
            <button type="button" className="secondary" id="txScan" title="امسح باركود (كل مسحة = قطعة)" aria-label="امسح باركود" onClick={() => setScanning(true)}>
              📷
            </button>
            </div>
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
                  {l.productId && (infos[l.productId]?.packs.length ?? 0) > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <small>الوحدة</small>{' '}
                      <select
                        value={l.un ?? 1}
                        onChange={(e) => {
                          const m = Number(e.target.value) || 1;
                          const n = l.un || 1;
                          const q = toNum(l.qty);
                          const pr = toNum(l.price);
                          const pk = infos[l.productId!]!.packs.find((k) => k.n === m);
                          setLine(l.key, { un: m, unLabel: m === 1 ? '' : (pk?.u ?? ''), qty: String(+((q * n) / m).toFixed(3)), ...(l.price !== '' ? { price: String(+((pr / n) * m).toFixed(2)) } : {}) });
                        }}
                      >
                        <option value={1}>{l.unit || 'قطعة'}</option>
                        {infos[l.productId]!.packs.map((k) => (
                          <option key={k.u} value={k.n}>
                            {k.small ? `${k.u} سايب (${k.x} في ال${l.unit || ''})` : `${k.u} (${k.n} ${l.unit || 'قطعة'})`}
                          </option>
                        ))}
                      </select>
                      {l.unLabel && <small style={{ display: 'block', color: '#087f8c', fontWeight: 700 }}>({toNum(l.qty)} {l.unLabel})</small>}
                    </div>
                  )}
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
          {cterm || limit || (isSale && contactNow && contactNow.balance) ? (
            <CustomerBar name={person.trim()} term={cterm?.t ? { ...cterm.t, limit: limit || cterm.t.limit } : limit ? { limit } : undefined} balance={contactNow?.balance ?? 0} />
          ) : null}
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
          {isSale && !asQuote && !invoice && (
            <>
              <div className="field full" id="txDelF">
                <label>🚚 الاستلام</label>
                <div className="delopt">
                  {(
                    [
                      ['', '🏪 من المحل'],
                      ['DELIVERY', '🛵 توصيل (القاهرة والجيزة)'],
                      ['SHIP', '📦 شحن لمحافظة'],
                    ] as const
                  ).map(([v, t]) => (
                    <label key={v}>
                      <input type="radio" name="txDel" checked={del === v} onChange={() => delChanged(v)} /> {t}
                    </label>
                  ))}
                </div>
              </div>
              {del && (
                <>
                  <div className="field" id="txGovF">
                    <label>المحافظة</label>
                    <select value={gov} onChange={(e) => setGov(e.target.value)}>
                      <option value="">— اختار —</option>
                      {(del === 'DELIVERY' ? GOVS.filter((g) => g === 'القاهرة' || g === 'الجيزة') : GOVS).map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" id="txAreaF">
                    <label>المنطقة / المدينة</label>
                    <input value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>
                  <div className="field full" id="txDelHint" style={{ color: 'var(--muted)', fontSize: 13 }}>
                    📌 الشحنة هتتسجل في «الشحن والتوصيل» وتطبع الملصق على طول. «المدفوع الآن» اتحط صفر عشان الدفع عند الاستلام — غيّره لو العميل دفع.
                  </div>
                </>
              )}
            </>
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
          {!isSale && !asQuote && !invoice && (
            <Input label="رقم فاتورة المورد (اختياري — يمنع التكرار)" placeholder="رقم الفاتورة عند المورد" value={sno} onChange={(e) => setSno(e.target.value)} />
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
      {scanning && (
        <CameraScanner
          multi
          title="امسح الأصناف"
          onClose={() => setScanning(false)}
          onCode={async (code) => {
            try {
              const p = await lookupProduct(code);
              addProduct(p);
              return p.name;
            } catch {
              return false;
            }
          }}
        />
      )}
    </Modal>
  );
}
