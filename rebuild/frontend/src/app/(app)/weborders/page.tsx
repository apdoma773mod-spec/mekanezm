'use client';

import { useMemo, useState } from 'react';
import type { InvoiceDto, Paginated } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { waNum } from '@/components/hy/ui';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useAllProducts } from '@/lib/trade-queries';
import { usePatchWebOrder, useWebOrders, type WebOrderRow } from '@/lib/web-queries';

/** 🛒 طلبات الموقع: الطلبات اللي العملاء بعتوها من الموقع — حوّلها لفاتورة بضغطة. */
const ETAS = ['النهارده', 'بكره إن شاء الله', 'بعد يومين', 'خلال 3 لـ 5 أيام', 'أول ما المنتج يوصلنا هنكلمك'];
type Tab = 'new' | 'done' | 'other';

const waLink = (phone: string, text: string) => {
  const n = waNum(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
};

function EtaModal({ o, names, onClose }: { o: WebOrderRow; names: (code: string) => string; onClose: () => void }) {
  const toast = useToast();
  const patch = usePatchWebOrder();
  const back = o.items.some((x) => x.backorder);
  const [pick, setPick] = useState(back ? '4' : '1');
  const [custom, setCustom] = useState('');
  const [extra, setExtra] = useState('');
  const sid = o.id.slice(0, 8);

  const go = async () => {
    const t = pick === 'c' ? custom.trim() : ETAS[+pick];
    if (!t) return toast('اختار أو اكتب الميعاد', 'bad');
    const lines = o.items.map((x) => `${names(x.code)} × ${x.qty}`).join('\n');
    const msg = `أهلاً ${o.customerName} 👋\nطلبك رقم ${sid} من ميكانيزم اتأكد ✅\n\n${lines}\n\n📅 الاستلام: ${t}${extra.trim() ? `\n${extra.trim()}` : ''}\n\nلو عندك أي سؤال ردّ علينا هنا.`;
    const wa = o.phone ? waLink(o.phone, msg) : '';
    // open WhatsApp first so the browser doesn't block the window, then save the answer on the order
    const win = wa ? window.open(wa, '_blank') : null;
    try {
      await patch.mutateAsync({ id: o.id, eta: t });
    } catch (e) {
      toast(`الميعاد ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
    onClose();
    if (wa) {
      if (!win) window.location.href = wa;
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        toast('العميل مالوش رقم — الرسالة اتنسخت');
      } catch {
        toast('العميل مالوش رقم موبايل', 'bad');
      }
    }
  };

  return (
    <Modal title={`📅 ميعاد الاستلام لـ ${o.customerName}`} onClose={onClose}>
      {back && <p style={{ marginTop: 0, color: 'var(--danger)' }}>⏳ الطلب فيه أصناف مش متوفرة دلوقتي.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {ETAS.map((t, i) => (
          <label key={t} className="chk" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <input type="radio" name="eta" checked={pick === String(i)} onChange={() => setPick(String(i))} /> {t}
          </label>
        ))}
        <label className="chk" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <input type="radio" name="eta" checked={pick === 'c'} onChange={() => setPick('c')} /> ميعاد تاني:{' '}
          <input
            value={custom}
            placeholder="مثلاً: يوم الخميس"
            style={{ flex: 1, minWidth: 0 }}
            onChange={(e) => {
              setCustom(e.target.value);
              setPick('c');
            }}
          />
        </label>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>رسالة إضافية (اختياري)</label>
        <input value={extra} placeholder="مثلاً: التوصيل 50 ج.م" onChange={(e) => setExtra(e.target.value)} />
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={patch.isPending} onClick={go}>
          💬 ابعت للعميل على الواتساب
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

type Found = { id: string; name: string; qty: number; price: number };

function OrderCard({ o, prod, onEta }: { o: WebOrderRow; prod: (code: string) => Found | undefined; onEta: () => void }) {
  const { open } = useModal();
  const toast = useToast();
  const patch = usePatchWebOrder();
  const sid = o.id.slice(0, 8);
  const rows = o.items.map((x) => ({ x, p: prod(x.code) }));
  const est = rows.reduce((s, r) => s + (r.p ? r.p.price * r.x.qty : 0), 0);
  const wa = o.phone ? waLink(o.phone, `أهلاً ${o.customerName}، بخصوص طلبك رقم ${sid} من موقع ميكانيزم`) : '';

  const invoice = () => {
    const missing = rows.filter((r) => !r.p).map((r) => r.x.code);
    if (missing.length) toast(`أكواد مش موجودة في السيستم: ${missing.join('، ')}`, 'bad');
    open({
      kind: 'transaction',
      type: 'SALE',
      preset: {
        person: o.customerName,
        phone: o.phone,
        note: `من طلب الموقع ${sid}`,
        lines: rows.flatMap((r) => (r.p ? [{ productId: r.p.id, name: r.p.name, qty: r.x.qty, price: r.p.price }] : [])),
        onSaved: async (inv) => {
          await patch.mutateAsync({ id: o.id, status: 'done', invoiceNo: inv.no });
        },
      },
    });
  };

  const cancel = async () => {
    if (!window.confirm(`رفض طلب ${o.customerName}؟\nالكميات المحجوزة للطلب ده هترجع متاحة في الموقع.`)) return;
    try {
      await patch.mutateAsync({ id: o.id, status: 'cancelled' });
      toast('تم رفض الطلب');
    } catch (e) {
      toast(`تعذر رفض الطلب: ${errorMessage(e)}`, 'bad');
    }
  };

  const openInvoice = async () => {
    try {
      const r = await api.get<Paginated<InvoiceDto>>('/invoices', { kind: 'SALE', q: o.invoiceNo ?? '', pageSize: 5 });
      const inv = r.items.find((i) => i.no === o.invoiceNo);
      if (inv) open({ kind: 'invoice', id: inv.id });
      else toast('الفاتورة مش لاقيها (يمكن اتلغت)', 'bad');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontSize: 18 }}>{o.customerName}</b>
          {o.phone ? (
            <>
              {' — '}
              <span dir="ltr">{o.phone}</span>
            </>
          ) : null}
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            طلب رقم {sid} • {new Date(o.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        {o.status === 'done' ? <span className="badge green">اتعملها فاتورة</span> : o.status === 'new' ? <span className="badge red">جديد</span> : <span className="badge">ملغي</span>}
      </div>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="table" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>المطلوب</th>
              <th>في المخزن</th>
              <th>سعر البيع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ x, p }, i) => (
              <tr key={i}>
                <td>
                  {p ? p.name : <span style={{ color: 'var(--danger)' }}>كود {x.code} مش موجود في السيستم</span>}
                  {x.backorder ? <span className="badge red"> ⏳ حجز — مش متوفر</span> : null}
                </td>
                <td>
                  <b>{x.qty}</b>
                </td>
                <td style={{ color: p && p.qty >= x.qty ? 'inherit' : 'var(--danger)' }}>{p ? p.qty : '—'}</td>
                <td>{p ? money(p.price) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ margin: '8px 0' }}>
        الإجمالي التقريبي: <b>{money(est)}</b>
      </div>
      {o.eta ? <div style={{ margin: '0 0 8px', color: 'var(--green)', fontWeight: 700 }}>📅 العميل اتبلّغ: {o.eta}</div> : null}
      <div className="btnrow">
        {o.status === 'new' && (
          <>
            <button type="button" className="primary" onClick={invoice}>
              🧾 تحويل لفاتورة بيع
            </button>
            <button type="button" className="secondary" onClick={onEta}>
              📅 رد بالميعاد
            </button>
            <button type="button" className="secondary danger" disabled={patch.isPending} onClick={cancel}>
              رفض الطلب
            </button>
          </>
        )}
        {o.status === 'done' && o.invoiceNo ? (
          <button type="button" className="secondary" onClick={openInvoice}>
            فتح الفاتورة {o.invoiceNo}
          </button>
        ) : null}
        {wa ? (
          <a className="secondary" style={{ textDecoration: 'none', padding: '10px 14px' }} target="_blank" rel="noopener" href={wa}>
            💬 واتساب العميل
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OrdersList() {
  const [tab, setTab] = useState<Tab>('new');
  const [eta, setEta] = useState<WebOrderRow | null>(null);
  const list = useWebOrders();
  const products = useAllProducts({}, !!list.data?.length).data;
  const byCode = useMemo(() => new Map((products ?? []).map((p) => [String(p.code), p])), [products]);
  const prod = (code: string): Found | undefined => {
    const p = byCode.get(String(code));
    return p ? { id: p.id, name: p.name, qty: p.qty, price: p.price } : undefined;
  };
  const rows = (list.data ?? []).filter((o) => (tab === 'new' ? o.status === 'new' : tab === 'done' ? o.status === 'done' : o.status === 'cancelled'));
  const tabs: [Tab, string][] = [
    ['new', 'جديدة'],
    ['done', 'اتعملها فاتورة'],
    ['other', 'ملغية'],
  ];
  return (
    <>
      <div className="toolbar" id="woTabs">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && !rows.length && (
        <div className="card">
          <div className="empty">{tab === 'new' ? 'مفيش طلبات جديدة.' : 'مفيش طلبات هنا.'}</div>
        </div>
      )}
      {rows.map((o) => (
        <OrderCard key={o.id} o={o} prod={prod} onEta={() => setEta(o)} />
      ))}
      {eta && <EtaModal o={eta} names={(c) => byCode.get(String(c))?.name ?? `كود ${c}`} onClose={() => setEta(null)} />}
    </>
  );
}

export default function WebOrdersPage() {
  return (
    <AdminOnly>
      <PageHeader title="طلبات الموقع" subtitle="الطلبات اللي العملاء بعتوها من الموقع — حوّلها لفاتورة بضغطة" />
      <OrdersList />
    </AdminOnly>
  );
}
