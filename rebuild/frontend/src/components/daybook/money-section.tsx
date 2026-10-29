'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ContactDto, DaybookEntryDto } from '@mk/shared';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useWaOrders } from '@/lib/inbox-queries';
import { useContacts, useCreateExpense, useCreatePayment, useDaybookSetPay, useExpenses, usePayments } from '@/lib/trade-queries';

/**
 * «💵 فلوس الدرج» تحت اليومية — نفس moneyRender القديمة: مصروف، دفعة لمورد، فلوس دخلت من عميل،
 * والمفروض يفضل في الدرج = كاش البيع + التحصيلات − المصروفات والدفعات.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;
const CATS: [string, string][] = [
  ['نقل وشحن', '🚚 نقل / شحن'],
  ['مواصلات', '🚕 أوبر / مواصلات'],
  ['مشتريات', '🛒 مشتريات'],
  ['بوفيه', '☕ أكل / بوفيه'],
  ['صيانة', '🔧 صيانة'],
  ['أخرى', '📌 حاجة تانية'],
];

function Lc({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: ReactNode }) {
  return (
    <div id="lcBox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lc">
        <div className="lch">
          <div>
            <b>{title}</b>
            <small>{sub}</small>
          </div>
          <button type="button" className="close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input = { fontSize: 16, padding: 10, border: '1px solid var(--border)', borderRadius: 12, width: '100%' } as const;

function ExpenseCard({ day, onClose }: { day: string; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateExpense();
  const [cat, setCat] = useState('نقل وشحن');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const save = () => {
    const a = +amount;
    if (!(a > 0)) return toast('اكتب المبلغ', 'bad');
    create.mutate(
      { category: cat || 'أخرى', amount: r2(a), method: 'CASH', company: 'MK', date: day, note },
      {
        onSuccess: () => {
          toast(`✔ اتسجل مصروف ${money(a)}`);
          onClose();
        },
        onError: (e) => toast(errorMessage(e), 'bad'),
      },
    );
  };
  return (
    <Lc title="💸 فلوس طلعت من الدرج" sub="مصروف (نقل، أوبر، مشتريات صغيرة…) — بيتسجل في الخزنة والمصروفات" onClose={onClose}>
      <label>نوعه</label>
      <div className="dbpays">
        {CATS.map(([k, t]) => (
          <button key={k} type="button" className={k === cat ? 'on' : ''} onClick={() => setCat(k)}>
            {t}
          </button>
        ))}
      </div>
      <label>المبلغ</label>
      <input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label>البيان (اختياري)</label>
      <input placeholder="مثلاً: أوبر توصيل لمحمد سعد" style={input} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="lcf">
        <button type="button" className="primary" disabled={create.isPending} onClick={save}>
          ✔ سجّل المصروف
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Lc>
  );
}

function PayCard({ kind, onClose }: { kind: 'out' | 'in'; onClose: () => void }) {
  const toast = useToast();
  const sup = kind === 'out';
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const contacts = useContacts({ type: sup ? 'SUPPLIER' : 'CUSTOMER', q: who.trim() || undefined, pageSize: 30, sort: 'name' });
  const create = useCreatePayment();
  const c: ContactDto | undefined = contacts.data?.items.find((x) => x.name === who.trim());
  const bal = c ? `${sup ? 'ليه عندك: ' : 'عليه: '}${money(Math.abs(c.balance))}` : who.trim() ? `⚠️ مش متسجل في ${sup ? 'الموردين' : 'العملاء'} — سجّله الأول من «العملاء والموردون»` : '';
  const save = () => {
    const a = +amount;
    if (!c) return toast('اختار الاسم من القايمة', 'bad');
    if (!(a > 0)) return toast('اكتب المبلغ', 'bad');
    create.mutate(
      { contactId: c.id, amount: r2(a), method: 'CASH', company: 'MK', note: note || (sup ? 'دفعة من يومية المحل' : 'تحصيل من يومية المحل') },
      {
        onSuccess: () => {
          toast(`✔ اتسجل ${money(a)}${sup ? ' لـ ' : ' من '}${c.name}`);
          onClose();
        },
        onError: (e) => toast(errorMessage(e), 'bad'),
      },
    );
  };
  return (
    <Lc
      title={sup ? '↗️ دفعة لمورد أو لحد' : '🤝 فلوس دخلت من عميل'}
      sub={sup ? 'فلوس طلعت من الدرج لمورد — بتنزل من حسابه' : 'تحصيل من عميل عليه فلوس — بينزل من حسابه'}
      onClose={onClose}
    >
      <label>{sup ? 'اسم المورد' : 'اسم العميل'}</label>
      <div>
        <input list="mvWhoList" placeholder="اكتب الاسم..." autoComplete="off" autoFocus style={input} value={who} onChange={(e) => setWho(e.target.value)} />
        <datalist id="mvWhoList">
          {contacts.data?.items.map((x) => (
            <option key={x.id} value={x.name} />
          ))}
        </datalist>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{bal}</div>
      <label>المبلغ</label>
      <input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button
        type="button"
        className="secondary"
        style={{ marginTop: 6, width: '100%' }}
        onClick={() => {
          if (!c) return toast('اختار الاسم من القايمة الأول', 'bad');
          if (!(c.balance > 0)) return toast(`${c.name} حسابه خالص`, 'bad');
          setAmount(String(r2(c.balance)));
        }}
      >
        💯 كل الحساب
      </button>
      <label>ملاحظة (اختياري)</label>
      <input style={input} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="lcf">
        <button type="button" className="primary" disabled={create.isPending} onClick={save}>
          {create.isPending ? 'جاري الحفظ…' : '✔ سجّل'}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Lc>
  );
}

export function MoneySection({ day, today, cash }: { day: string; today: string; cash: number }) {
  const toast = useToast();
  const [card, setCard] = useState<null | 'exp' | 'out' | 'in'>(null);
  const exps = useExpenses({ from: day, to: day, pageSize: 200 });
  const pays = usePayments({ from: day, to: day, pageSize: 200 });
  const { ex, inn, out } = useMemo(() => {
    const live = (pays.data?.items ?? []).filter((p) => !p.cancelledAt && !/^رصيد/.test(p.note || ''));
    return { ex: exps.data?.items ?? [], inn: live.filter((p) => p.direction === 'IN'), out: live.filter((p) => p.direction === 'OUT') };
  }, [exps.data, pays.data]);
  const sx = r2(ex.reduce((a, e) => a + e.amount, 0));
  const si = r2(inn.reduce((a, p) => a + p.amount, 0));
  const so = r2(out.reduce((a, p) => a + p.amount, 0));
  const line = (key: string, ic: string, t: string, a: number, neg: boolean) => (
    <div key={key} className="mvl">
      <span>
        {ic} {t}
      </span>
      <b style={{ color: neg ? 'var(--danger)' : 'var(--green)' }}>
        {neg ? '−' : '+'} {money(a)}
      </b>
    </div>
  );
  const payNeedsToday = (k: 'out' | 'in') => {
    if (day !== today) return toast('الدفعات بتتسجل على النهارده بس — ارجع ليومية النهارده', 'bad');
    setCard(k);
  };
  return (
    <div id="dbMoney">
      <h3 style={{ margin: '16px 0 8px' }}>💵 فلوس الدرج {day === today ? 'النهارده' : ''}</h3>
      <div className="mvbar">
        <button type="button" className="secondary" onClick={() => setCard('exp')}>
          💸 فلوس طلعت (مصروف)
        </button>
        <button type="button" className="secondary" onClick={() => payNeedsToday('out')}>
          ↗️ دفعة لمورد
        </button>
        <button type="button" className="secondary" onClick={() => payNeedsToday('in')}>
          🤝 فلوس دخلت من عميل
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {ex.map((e) => line(e.id, '💸', `${e.category || 'مصروف'}${e.note ? ` — ${e.note}` : ''}`, e.amount, true))}
        {out.map((p) => line(p.id, '↗️', `دفعة لـ ${p.contact.name}`, p.amount, true))}
        {inn.map((p) => line(p.id, '🤝', `تحصيل من ${p.contact.name}`, p.amount, false))}
        {ex.length + out.length + inn.length === 0 && (
          <div className="empty" style={{ padding: 14 }}>
            مفيش فلوس طلعت أو دخلت غير البيع
          </div>
        )}
      </div>
      <div className="mvsum">
        <div>
          <small>💵 كاش من بيع اليومية</small>
          <b>{money(cash)}</b>
        </div>
        <div>
          <small>🤝 تحصيلات</small>
          <b>{money(si)}</b>
        </div>
        <div>
          <small>💸 مصروفات + دفعات</small>
          <b style={{ color: 'var(--danger)' }}>{money(r2(sx + so))}</b>
        </div>
        <div>
          <small>المفروض يفضل في الدرج</small>
          <b>{money(r2(cash + si - sx - so))}</b>
        </div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '6px 0 0' }}>الحساب الكامل للدرج (فواتير البيع العادية والمشتريات كمان) في «🔒 تقفيل اليومية».</p>
      {card === 'exp' && <ExpenseCard day={day} onClose={() => setCard(null)} />}
      {(card === 'out' || card === 'in') && <PayCard kind={card} onClose={() => setCard(null)} />}
    </div>
  );
}

/** ✏️ تعديل طريقة الدفع بعد التصفية: بين نقدي وإنستاباي وتحويل، والتقفيل بيتظبط لوحده (زي القديم). */
const PAYS: ['CASH' | 'INSTAPAY' | 'TRANSFER', string][] = [
  ['CASH', '💵 نقدي'],
  ['INSTAPAY', '📱 إنستاباي'],
  ['TRANSFER', '🏦 تحويل'],
];
export function PostedRowCard({ r, onClose, onOpenInvoice }: { r: DaybookEntryDto; onClose: () => void; onOpenInvoice: () => void }) {
  const toast = useToast();
  const setPay = useDaybookSetPay();
  const [pay, setP] = useState(r.pay);
  const credit = r.pay === 'CREDIT';
  const save = () =>
    setPay.mutate(
      { id: r.id, pay },
      {
        onSuccess: () => {
          toast('✔ اتغيّرت طريقة الدفع');
          onClose();
        },
        onError: (e) => toast(errorMessage(e), 'bad'),
      },
    );
  return (
    <Lc
      title={r.kind === 'PAY' ? '💰 دفعة' : r.name}
      sub={`${r.kind === 'PAY' ? '' : `${r.qty} × ${money(r.price)} = `}${money(r.total)} • اتصفّى في فاتورة ${r.invoice?.no ?? ''}`}
      onClose={onClose}
    >
      {credit ? (
        <p style={{ margin: 0 }}>السطر ده آجل — لو العميل دفع، سجّل دفعة من «🤝 فلوس دخلت من عميل».</p>
      ) : (
        <>
          <label>طريقة الدفع</label>
          <div className="dbpays">
            {PAYS.map(([k, t]) => (
              <button key={k} type="button" className={k === pay ? 'on' : ''} onClick={() => setP(k)}>
                {t}
              </button>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>بعد التصفية تقدر تغيّر بين نقدي وإنستاباي وتحويل — والتقفيل بيتظبط لوحده.</p>
        </>
      )}
      <div className="lcf">
        {!credit && (
          <button type="button" className="primary" disabled={setPay.isPending} onClick={save}>
            ✔ حفظ
          </button>
        )}
        {r.invoice && (
          <button type="button" className="secondary" onClick={onOpenInvoice}>
            🧾 افتح الفاتورة
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </Lc>
  );
}

/** 📩 طلبات واتساب جديدة فوق اليومية (dbWaCard القديمة). */
export function DaybookWaBox() {
  const router = useRouter();
  const list = useWaOrders('new');
  const W = list.data ?? [];
  if (!W.length) return null;
  return (
    <div id="dbWaBox" style={{ border: '2px solid #7bcf9a', background: '#e8f7ee', borderRadius: 14, padding: 10, marginBottom: 10 }}>
      <div style={{ fontWeight: 800, color: '#0b5b2b' }}>📩 طلبات واتساب جديدة ({W.length})</div>
      {W.slice(0, 5).map((o) => (
        <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed #9fd7b3' }}>
          <div style={{ minWidth: 0 }}>
            <b>{o.customerName || 'عميل واتساب'}</b> <small dir="ltr">{o.phone}</small>
            <div style={{ fontSize: 12, color: '#355', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.body.replace(/\s+/g, ' ').slice(0, 70)}</div>
          </div>
          <button type="button" className="primary" style={{ flex: 'none' }} onClick={() => router.push('/waorders')}>
            فتح
          </button>
        </div>
      ))}
      {W.length > 5 && <div style={{ fontSize: 12, marginTop: 4 }}>وفيه {W.length - 5} كمان...</div>}
    </div>
  );
}
