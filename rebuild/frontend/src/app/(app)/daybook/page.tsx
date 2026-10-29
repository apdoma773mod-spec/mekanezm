'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DaybookEntryDto, DaybookPay, ProductDto } from '@mk/shared';
import { CameraScanner } from '@/components/scan/camera-scanner';
import { ImportDailyButton } from '@/components/daybook/import-daily';
import { DaybookWaBox, MoneySection, PostedRowCard } from '@/components/daybook/money-section';
import { useModal } from '@/components/modals/modal-host';
import { useIsAdmin } from '@/components/use-role';
import { Portal } from '@/components/ui/portal';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money, qtyText, todayYmd } from '@/lib/format';
import { dimOf, prepSheetHtml, printHtml } from '@/lib/print';
import {
  lookupProduct,
  useContacts,
  useDaybook,
  useDaybookAdd,
  useDaybookDelete,
  useDaybookDeliver,
  useDaybookPost,
  useDaybookUpdate,
  useProduct,
  useProducts,
} from '@/lib/trade-queries';

/** Same payment chips, order and icons as the old daybook. */
const PAYS: [DaybookPay, string][] = [
  ['CASH', '💵 نقدي'],
  ['INSTAPAY', '📱 إنستاباي'],
  ['TRANSFER', '🏦 تحويل'],
  ['CREDIT', '⏳ آجل'],
];
const payName = (k: DaybookPay) => PAYS.find((x) => x[0] === k)?.[1] ?? '';
const BADGE: Record<DaybookPay, string> = { CASH: 'cash', INSTAPAY: 'insta', TRANSFER: 'transfer', CREDIT: 'credit' };
const r2 = (n: number) => Math.round(n * 100) / 100;
const PAY_KEY = 'mk_db_pay';

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

interface Sums {
  tot: number;
  CASH: number;
  INSTAPAY: number;
  TRANSFER: number;
  paid: number;
  credit: number;
}

function groupSums(L: DaybookEntryDto[]): Sums {
  const s: Sums = { tot: 0, CASH: 0, INSTAPAY: 0, TRANSFER: 0, paid: 0, credit: 0 };
  for (const r of L) {
    if (r.kind === 'ITEM') s.tot = r2(s.tot + r.total);
    if (r.pay !== 'CREDIT') {
      s[r.pay] = r2(s[r.pay] + r.total);
      s.paid = r2(s.paid + r.total);
    }
  }
  s.credit = r2(Math.max(0, s.tot - s.paid));
  return s;
}

function PayChips({ value, onChange, noCredit }: { value: DaybookPay; onChange: (p: DaybookPay) => void; noCredit?: boolean }) {
  return (
    <div className="dbpays">
      {PAYS.filter((x) => !(noCredit && x[0] === 'CREDIT')).map(([k, t]) => (
        <button type="button" key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** The old #lcBox card: a small centered sheet over the daybook. */
function LineCard({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Portal>
      <div
        id="lcBox"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="lc" role="dialog" aria-modal="true">
          {children}
        </div>
      </div>
    </Portal>
  );
}

type CardSpec =
  | { kind: 'item'; productId?: string; name?: string; row?: DaybookEntryDto }
  | { kind: 'pay'; row?: DaybookEntryDto; person?: string }
  | { kind: 'posted'; row: DaybookEntryDto };

function ItemCard({
  spec,
  day,
  person,
  pay,
  onClose,
  onAdded,
}: {
  spec: Extract<CardSpec, { kind: 'item' }>;
  day: string;
  person: string;
  pay: DaybookPay;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const row = spec.row;
  const edit = !!row;
  const product = useProduct(spec.productId ?? row?.productId ?? null).data;
  const name = row ? row.name : (product?.name ?? spec.name ?? '');
  const [q, setQ] = useState(String(row ? row.qty : 1));
  const [price, setPrice] = useState(row ? String(row.price) : '');
  const [owed, setOwed] = useState(row && row.owed ? String(row.owed) : '');
  const [who, setWho] = useState(row?.person ?? '');
  const [rowPay, setRowPay] = useState<DaybookPay>(row?.pay ?? 'CASH');
  const qRef = useRef<HTMLInputElement>(null);
  const add = useDaybookAdd();
  const update = useDaybookUpdate();
  const del = useDaybookDelete();

  useEffect(() => {
    if (!edit && product && price === '') setPrice(product.price ? String(product.price) : '');
  }, [product, edit, price]);
  useEffect(() => {
    const t = setTimeout(() => qRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, []);

  const qn = Number(q) || 0;
  const total = r2(qn * (Number(price) || 0));
  const warn = product && !edit && qn - (Number(owed) || 0) > product.qty ? `⚠️ الكمية أكبر من المتاح (${qtyText(product.qty)})` : '';
  const busy = add.isPending || update.isPending || del.isPending;

  const save = async () => {
    const ow = Number(owed) || 0;
    if (!(qn > 0)) return toast('اكتب العدد', 'bad');
    if (price === '') return toast('اكتب السعر', 'bad');
    if (ow > qn) return toast('«باقي له» أكبر من العدد', 'bad');
    try {
      if (row) {
        await update.mutateAsync({ id: row.id, input: { qty: qn, price: Number(price), owed: ow, person: who.trim(), pay: rowPay } });
        onClose();
      } else {
        await add.mutateAsync({
          kind: 'ITEM',
          day,
          productId: spec.productId,
          name,
          qty: qn,
          price: Number(price),
          owed: ow,
          person,
          pay,
          note: '',
        });
        onClose();
        toast(`✔ ${name} × ${q}`);
        onAdded();
      }
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const remove = async () => {
    if (!row) return;
    try {
      await del.mutateAsync(row.id);
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <LineCard onClose={onClose}>
      <div className="lch">
        <div>
          <b>{name}</b>
          <small>
            {product
              ? `المتاح: ${qtyText(product.qty)} ${product.unit || ''}${product.code ? ` • كود ${product.code}` : ''}`
              : spec.productId || row?.productId
                ? ''
                : 'صنف غير مسجل'}
          </small>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="قفل">
          ✕
        </button>
      </div>
      <label>العدد</label>
      <div className="lcq">
        <button type="button" onClick={() => setQ(String(Math.max(1, r2((Number(q) || 1) - 1))))}>
          −
        </button>
        <input ref={qRef} type="number" inputMode="decimal" min="0.01" step="0.01" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setQ(String(r2((Number(q) || 0) + 1)))}>
          ＋
        </button>
      </div>
      <label>السعر</label>
      <input id="lcPr" type="number" inputMode="decimal" min="0" step="0.01" value={price} placeholder="اكتب السعر" onChange={(e) => setPrice(e.target.value)} />
      <div className="lct">
        الإجمالي: <b>{money(total)}</b>
      </div>
      <label>📦 باقي له (قطع لسه ماخدهاش — اختياري)</label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="1"
        value={owed}
        placeholder="0"
        onChange={(e) => setOwed(e.target.value)}
        style={{ fontSize: 18, padding: 10, border: '2px solid var(--border)', borderRadius: 14, textAlign: 'center' }}
      />
      {edit ? (
        <>
          <label>العميل</label>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="من غير اسم = بيعة نقدي"
            style={{ fontSize: 16, padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}
          />
          <label>الدفع</label>
          <PayChips value={rowPay} onChange={setRowPay} />
        </>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
          لـ <b>{person || 'بيعة من غير اسم'}</b> • {payName(pay)}
        </div>
      )}
      <div className="lcw">{warn}</div>
      <div className="lcf">
        <button type="button" className="primary" disabled={busy} onClick={save}>
          ✔ {edit ? 'حفظ التعديل' : 'ضيف لليومية'}
        </button>
        {edit && (
          <button type="button" className="secondary danger" disabled={busy} onClick={remove}>
            حذف السطر
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </LineCard>
  );
}

/** 💰 دفعة: the customer paid part of what they owe for today's items. */
function PayCard({
  spec,
  day,
  person,
  pay,
  onClose,
}: {
  spec: Extract<CardSpec, { kind: 'pay' }>;
  day: string;
  person: string;
  pay: DaybookPay;
  onClose: () => void;
}) {
  const toast = useToast();
  const row = spec.row;
  const edit = !!row;
  const [who, setWho] = useState(row?.person ?? spec.person ?? person);
  const [amount, setAmount] = useState(row ? String(row.price) : '');
  const [method, setMethod] = useState<DaybookPay>(row?.pay ?? (pay === 'CREDIT' ? 'CASH' : pay));
  const add = useDaybookAdd();
  const update = useDaybookUpdate();
  const del = useDaybookDelete();
  const lookup = useContacts({ type: 'CUSTOMER', q: who.trim(), pageSize: 5 }, false);
  const amountRef = useRef<HTMLInputElement>(null);
  const whoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => (edit || who ? amountRef.current : whoRef.current)?.focus(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = async () => {
    const name = who.trim();
    if (!name) return toast('اكتب اسم العميل الأول (من القايمة)', 'bad');
    const res = await lookup.refetch();
    const c = res.data?.items.find((x) => x.name === name);
    if (!c) return toast('اكتب اسم العميل الأول (من القايمة)', 'bad');
    if (!(c.balance > 0)) return toast(`${c.name} حسابه خالص`);
    setAmount(String(r2(c.balance)));
    toast(`عليه ${money(c.balance)}`);
  };

  const save = async () => {
    const name = who.trim();
    const a = Number(amount);
    if (!name) return toast('اكتب اسم العميل', 'bad');
    if (!(a > 0)) return toast('اكتب المبلغ', 'bad');
    try {
      if (row) await update.mutateAsync({ id: row.id, input: { price: a, person: name, pay: method } });
      else await add.mutateAsync({ kind: 'PAY', day, person: name, price: a, pay: method as 'CASH' | 'INSTAPAY' | 'TRANSFER', note: '' });
      onClose();
      toast(`✔ دفعة ${money(a)} من ${name}`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <LineCard onClose={onClose}>
      <div className="lch">
        <div>
          <b>💰 دفعة من العميل</b>
          <small>لو العميل دفع جزء بس من حساب الأصناف اللي خدها — الباقي يروح آجل على حسابه</small>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="قفل">
          ✕
        </button>
      </div>
      <label>اسم العميل</label>
      <input
        ref={whoRef}
        value={who}
        list="dbCustomers"
        onChange={(e) => setWho(e.target.value)}
        placeholder="لازم اسم"
        style={{ fontSize: 17, padding: 11, border: '2px solid var(--border)', borderRadius: 12 }}
      />
      <label>المبلغ اللي دفعه</label>
      <input ref={amountRef} id="lcPr" type="number" inputMode="decimal" min="0" step="0.01" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} />
      <button type="button" className="secondary" style={{ marginTop: 6, width: '100%' }} onClick={all}>
        💯 كل حسابه
      </button>
      <label>دفع إزاي</label>
      <PayChips value={method} onChange={setMethod} noCredit />
      <div className="lcf">
        <button type="button" className="primary" disabled={add.isPending || update.isPending} onClick={save}>
          ✔ {edit ? 'حفظ التعديل' : 'سجّل الدفعة'}
        </button>
        {edit && (
          <button
            type="button"
            className="secondary danger"
            onClick={async () => {
              try {
                await del.mutateAsync(row.id);
                onClose();
              } catch (e) {
                toast(errorMessage(e), 'bad');
              }
            }}
          >
            حذف
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </LineCard>
  );
}

const timeFmt = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' });

function Row({ r, onOpen }: { r: DaybookEntryDto; onOpen: (r: DaybookEntryDto) => void }) {
  const pay = r.kind === 'PAY';
  const st = r.postedAt ? `🧾 ${r.invoice?.no ?? ''}` : r.productId ? '✔ اتخصم من المخزن — تقدر تعدّله' : '⏳ تقدر تعدّله';
  const ow =
    r.owed > 0 ? (
      r.deliveredAt ? (
        <span className="dbbadge">📦 {qtyText(r.owed)} اتسلّم</span>
      ) : (
        <span className="dbbadge credit">📦 باقي له {qtyText(r.owed)}</span>
      )
    ) : null;
  const badge = <span className={`dbbadge ${BADGE[r.pay]}`}>{payName(r.pay)}</span>;
  return (
    <div className={`dbl${pay ? ' pay' : ''}`} onClick={() => onOpen(r)}>
      <div>
        <b>{pay ? '💰 دفعة' : r.name}</b>
      </div>
      <div className="c-q">{pay ? '' : qtyText(r.qty)}</div>
      <div className="c-p">{pay ? '' : money(r.price)}</div>
      <div className="c-t">
        <b>{money(r.total)}</b>
      </div>
      <div className="c-pay">{badge}</div>
      <div className="c-ow">{ow}</div>
      <div className="mob">
        {pay ? '' : `${qtyText(r.qty)} × ${money(r.price)} • `}
        {badge} {ow}
      </div>
      <div className="st">
        {st} • {timeFmt.format(new Date(r.createdAt))}
        {r.createdBy ? ` • ${r.createdBy}` : ''}
      </div>
    </div>
  );
}

function dayLabel(day: string) {
  if (day === todayYmd()) return 'النهارده';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function DaybookPage() {
  const toast = useToast();
  const { open } = useModal();
  const [day, setDay] = useState(todayYmd());
  const [person, setPerson] = useState('');
  const [pay, setPayState] = useState<DaybookPay>('CASH');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [boxOpen, setBoxOpen] = useState(false);
  const [card, setCard] = useState<CardSpec | null>(null);
  const admin = useIsAdmin();
  const [scanning, setScanning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const personRef = useRef<HTMLInputElement>(null);
  const data = useDaybook(day);
  const update = useDaybookUpdate();
  const add = useDaybookAdd();
  const post = useDaybookPost();
  const deliver = useDaybookDeliver();
  const results = useProducts({ q, pageSize: 12 }, q.length >= 1);
  const customers = useContacts({ type: 'CUSTOMER', q: person.trim() || undefined, pageSize: 20 });

  useEffect(() => {
    const p = ls.get(PAY_KEY) as DaybookPay | null;
    if (p && PAYS.some((x) => x[0] === p)) setPayState(p);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 120);
    return () => clearTimeout(t);
  }, [text]);

  const setPay = (p: DaybookPay) => {
    setPayState(p);
    ls.set(PAY_KEY, p);
    if (p === 'CREDIT' && !person.trim()) {
      toast('الآجل محتاج اسم العميل', 'bad');
      personRef.current?.focus();
    }
  };

  const rows = useMemo(() => data.data?.entries ?? [], [data.data]);
  const owedList = data.data?.owed ?? [];
  const who = person.trim();

  const focusSearch = () => {
    if (window.innerWidth >= 900) searchRef.current?.focus();
  };

  const pick = (p: ProductDto | null) => {
    const nm = text.trim();
    setText('');
    setBoxOpen(false);
    searchRef.current?.blur();
    if (pay === 'CREDIT' && !who) {
      toast('الآجل محتاج اسم العميل', 'bad');
      personRef.current?.focus();
      return;
    }
    setCard(p ? { kind: 'item', productId: p.id } : { kind: 'item', name: nm });
  };

  /** A barcode scan: the same item for the same customer and payment adds one piece. */
  const scanAdd = async (code: string) => {
    let p: ProductDto;
    try {
      p = await lookupProduct(code);
    } catch {
      toast(`باركود مش متسجل: ${code}`, 'bad');
      return;
    }
    const last = [...rows].reverse().find((r) => !r.postedAt && r.kind === 'ITEM' && r.productId === p.id && r.person === who && r.pay === pay);
    try {
      if (last) await update.mutateAsync({ id: last.id, input: { qty: last.qty + 1 } });
      else await add.mutateAsync({ kind: 'ITEM', day, productId: p.id, name: p.name, qty: 1, price: p.price || 0, owed: 0, person: who, pay, note: '' });
      toast(`✔ ${p.name}`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const doPost = async (forPerson: string | null) => {
    const L = rows.filter((r) => !r.postedAt && (forPerson === null || r.person === forPerson));
    if (!L.length) return;
    const groups = [...new Set(L.filter((r) => r.kind === 'ITEM').map((r) => r.person))];
    if (!groups.length) return toast('مفيش أصناف تتصفّى — الدفعات لوحدها بتستنى أصناف العميل', 'bad');
    const msg =
      forPerson === null
        ? `تصفية اليومية؟\nهيتعمل ${groups.length} فاتورة بيع (فاتورة لكل عميل، واللي من غير اسم في فاتورة «يومية»).`
        : `تصفية ${forPerson || 'البيع من غير اسم'}؟\nهتتعمل فاتورة بيع بالأصناف دي.`;
    if (!window.confirm(msg)) return;
    try {
      const out = await post.mutateAsync({ day, ...(forPerson !== null ? { person: forPerson } : {}) });
      toast(`✔ اتعمل ${out.invoices.length} فاتورة: ${out.invoices.map((x) => x.no).join('، ')}`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const doDeliver = async (r: DaybookEntryDto) => {
    if (!window.confirm(`سلّمت ${r.person || 'العميل'} ${qtyText(r.owed)} من «${r.name}»؟\nالكمية دي هتتخصم من المخزن.`)) return;
    try {
      await deliver.mutateAsync(r.id);
      toast('✔ اتسلّم');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  /** 🖨️ ورق التجهيز: بيعات اليوم من غير أسعار (mkPrepDay القديمة). */
  const printPrep = () => {
    const items = rows.filter((x) => x.kind === 'ITEM');
    if (!items.length) return toast('مفيش بيعات في اليومية لليوم ده', 'bad');
    printHtml(
      prepSheetHtml({
        no: `يومية ${day}`,
        date: day,
        src: 'يومية المحل',
        lines: items.map((x) => {
          const d = dimOf(x.name);
          return { name: x.name, qty: x.qty, unit: x.unit ?? '', dims: d + (x.note ? (d ? ' — ' : '') + x.note : '') };
        }),
      }),
    );
  };

  const openRow = (r: DaybookEntryDto) => {
    if (r.postedAt) {
      // the old click on a posted row: change cash/instapay/transfer, or open its invoice
      setCard({ kind: 'posted', row: r });
      return;
    }
    setCard(r.kind === 'PAY' ? { kind: 'pay', row: r } : { kind: 'item', productId: r.productId ?? undefined, row: r });
  };

  const groups = useMemo(() => {
    const G = new Map<string, DaybookEntryDto[]>();
    for (const r of rows) G.set(r.person, [...(G.get(r.person) ?? []), r]);
    return [...G.entries()]
      .map(([p, L]) => ({ p, L, open: L.some((r) => !r.postedAt) }))
      .sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
  }, [rows]);
  const S = groupSums(rows);
  const creditAll = r2(groups.reduce((a, g) => a + groupSums(g.L).credit, 0));
  const openRows = rows.filter((r) => !r.postedAt);

  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>📒 يومية المحل — {dayLabel(day)}</h1>
          <p>اكتب كل بيعة على طول، وفي الآخر «صفّي» تتعمل فواتير البيع لوحدها</p>
        </div>
        <div className="btnrow">
          <input type="date" className="search" style={{ maxWidth: 170, minWidth: 0 }} value={day} onChange={(e) => setDay(e.target.value || todayYmd())} />
          <button type="button" className="secondary" onClick={() => data.refetch()} aria-label="تحديث">
            🔄
          </button>
          {admin && <ImportDailyButton>📥 استيراد يومية من Excel</ImportDailyButton>}
          <button type="button" className="secondary" onClick={printPrep}>
            🖨️ ورق التجهيز
          </button>
        </div>
      </div>

      <div className="dbent">
        <div className="dbrow1">
          <div className="who">
            <input
              ref={personRef}
              value={person}
              list="dbCustomers"
              onChange={(e) => setPerson(e.target.value)}
              placeholder="👤 العميل (فاضي = بيعة من غير اسم)"
              autoComplete="off"
            />
          </div>
          <PayChips value={pay} onChange={setPay} />
        </div>
        <datalist id="dbCustomers">
          {customers.data?.items.map((c) => <option key={c.id} value={c.name} />)}
        </datalist>
        <div className="dbsr">
          <input
            ref={searchRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBoxOpen(true);
            }}
            onFocus={() => setBoxOpen(true)}
            onBlur={() => setTimeout(() => setBoxOpen(false), 200)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const v = text.trim();
              if (!v) return;
              setText('');
              setBoxOpen(false);
              void scanAdd(v);
            }}
            placeholder="اكتب اسم الصنف أو الكود..."
            autoComplete="off"
          />
          <button type="button" className="secondary" id="dbScan" title="امسح باركود" onClick={() => setScanning(true)}>
            📷
          </button>
          <button type="button" className="secondary" id="dbPayBtn" title="دفعة من العميل" onClick={() => setCard({ kind: 'pay' })}>
            💰
          </button>
        </div>
        {boxOpen && q && (
          <div id="dbBox" style={{ display: 'block' }}>
            {results.data?.items.map((p) => (
              <div key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                {p.name}{' '}
                <small style={{ color: '#7a8a8f' }}>
                  ({qtyText(p.qty)} {p.unit || ''})
                </small>
              </div>
            ))}
            <div onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)} style={{ color: 'var(--blue)', fontWeight: 700 }}>
              ＋ «{text.trim()}» صنف غير مسجل
            </div>
          </div>
        )}
      </div>

      <div id="dbBody">
        {admin && <DaybookWaBox />}
        {data.isError ? (
          <div className="card">
            <p style={{ color: 'var(--danger)', margin: 0 }}>{errorMessage(data.error)}</p>
          </div>
        ) : groups.length ? (
          groups.map((g) => {
            const s = groupSums(g.L.filter((r) => !r.postedAt || !g.open));
            const inv = [...new Set(g.L.filter((r) => r.invoice).map((r) => r.invoice!.no))];
            return (
              <div key={g.p} className={`dbg${g.open ? '' : ' done'}`}>
                <div className="dbgh">
                  <div>
                    <b>{g.p ? `👤 ${g.p}` : '🛒 بيع من غير اسم'}</b>
                    <small>
                      {money(s.tot)}
                      {s.CASH ? ` • نقدي ${money(s.CASH)}` : ''}
                      {s.INSTAPAY ? ` • إنستاباي ${money(s.INSTAPAY)}` : ''}
                      {s.TRANSFER ? ` • تحويل ${money(s.TRANSFER)}` : ''}
                      {s.credit ? ` • آجل ${money(s.credit)}` : ''}
                      {inv.length ? ` • 🧾 ${inv.join('، ')}` : ''}
                    </small>
                  </div>
                  <div className="btnrow">
                    {g.open && g.p && (
                      <button type="button" className="secondary" onClick={() => setCard({ kind: 'pay', person: g.p })}>
                        💰 دفعة
                      </button>
                    )}
                    {g.open && g.L.some((r) => !r.postedAt && r.kind === 'ITEM') && (
                      <button type="button" className="primary" disabled={post.isPending} onClick={() => doPost(g.p)}>
                        🧮 صفّي
                      </button>
                    )}
                  </div>
                </div>
                <div className="dbl hd">
                  <div>الصنف</div>
                  <div>العدد</div>
                  <div>السعر</div>
                  <div>الإجمالي</div>
                  <div>الدفع</div>
                  <div>باقي له</div>
                </div>
                {g.L.map((r) => (
                  <Row key={r.id} r={r} onOpen={openRow} />
                ))}
              </div>
            );
          })
        ) : (
          <div className="card">
            <div className="empty">{data.isPending ? 'جاري التحميل...' : 'لسه مفيش بيع في اليومية دي — اكتب أول صنف فوق 👆'}</div>
          </div>
        )}
      </div>

      <div id="dbFoot" className="dbfoot">
        <div className="t">
          <span>
            الإجمالي <b>{money(S.tot)}</b>
          </span>
          <span>
            💵 <b>{money(S.CASH)}</b>
          </span>
          <span>
            📱 <b>{money(S.INSTAPAY)}</b>
          </span>
          <span>
            🏦 <b>{money(S.TRANSFER)}</b>
          </span>
          <span>
            ⏳ <b>{money(creditAll)}</b>
          </span>
        </div>
        {openRows.some((r) => r.kind === 'ITEM') ? (
          <button type="button" className="primary" disabled={post.isPending} onClick={() => doPost(null)}>
            🧮 صفّي اليومية كلها ({openRows.length})
          </button>
        ) : rows.length ? (
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>✔ اليومية متصفّية</span>
        ) : null}
      </div>

      {admin && <MoneySection day={day} today={todayYmd()} cash={S.CASH} />}

      {owedList.length > 0 && (
        <div>
          <h3 style={{ margin: '18px 0 8px' }}>📦 باقي للعملاء ({owedList.length})</h3>
          {owedList.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <b>{r.person || 'من غير اسم'}</b> — {r.name} × <b>{qtyText(r.owed)}</b>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {r.day}
                  {r.invoice ? ` • فاتورة ${r.invoice.no}` : ''}
                </div>
              </div>
              <button type="button" className="primary" disabled={deliver.isPending} onClick={() => doDeliver(r)}>
                ✔ سلّمت
              </button>
            </div>
          ))}
        </div>
      )}

      {card?.kind === 'item' && (
        <ItemCard key={card.row?.id ?? card.productId ?? card.name} spec={card} day={day} person={who} pay={pay} onClose={() => setCard(null)} onAdded={focusSearch} />
      )}
      {scanning && (
        <CameraScanner
          multi
          title="امسح الأصناف — كل مسحة = قطعة"
          onClose={() => setScanning(false)}
          onCode={async (c) => {
            await scanAdd(c);
          }}
        />
      )}
      {card?.kind === 'posted' && (
        <PostedRowCard
          r={card.row}
          onClose={() => setCard(null)}
          onOpenInvoice={() => {
            const inv = card.row.invoice;
            setCard(null);
            if (inv) open({ kind: 'invoice', id: inv.id });
          }}
        />
      )}
      {card?.kind === 'pay' && <PayCard key={card.row?.id ?? card.person ?? 'new'} spec={card} day={day} person={who} pay={pay} onClose={() => setCard(null)} />}
    </>
  );
}
