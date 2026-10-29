'use client';

import { useState } from 'react';
import type { ContactType } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { balanceColor, balanceText, money } from '@/lib/format';
import { htmlToPdf, shareOrSave } from '@/lib/pdf';
import { esc, printHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useAllContacts, useAllProducts, useOverview } from '@/lib/trade-queries';
import { useQuery } from '@tanstack/react-query';
import { fontStack, mix, textOn } from '@/lib/format';
import { useModal } from './modals/modal-host';
import { Modal } from './ui/modal';
import { ErrorBox, Loading } from './ui/states';
import { useToast } from './ui/toast';

/** The second row of numbers on the old reports screen (they used to sit on the dashboard). */
export function ReportsStatsRow() {
  const o = useOverview().data;
  const st = (l: string, v: string | number | undefined) => (
    <div className="stat">
      <small>{l}</small>
      <strong>{v === undefined ? '…' : v}</strong>
    </div>
  );
  return (
    <div className="stats" style={{ marginTop: 14 }}>
      {st('عدد الأصناف', o?.productsCount)}
      {st('أصناف نفدت', o?.outCount)}
      {st('أصناف تحت حد التنبيه', o?.lowCount)}
      {st('مستحق للموردين', o ? money(o.suppliersOwed) : undefined)}
    </div>
  );
}

interface TopCustomer {
  name: string;
  count: number;
  total: number;
  profit: number;
  contactId: string | null;
  balance: number | null;
}
const pfColor = (v: number) => (v > 0 ? '#159447' : v < 0 ? '#c0392b' : 'inherit');

/** «تقرير عميل / مورد (اشترى منك بكام)» + «أكتر العملاء شراءً». */
export function ContactReportCard() {
  const { open } = useModal();
  const toast = useToast();
  const [type, setType] = useState<ContactType>('CUSTOMER');
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const contacts = useAllContacts(type).data ?? [];
  const top = useQuery({
    queryKey: ['reports', 'top-customers'],
    queryFn: ({ signal }) => api.get<{ customers: TopCustomer[] }>('/reports/top-customers', undefined, signal).then((r) => r.customers),
  });
  const go = () => {
    if (!name.trim()) return toast('اختار الاسم الأول', 'bad');
    open({ kind: 'contactReport', name: name.trim(), type, from: from || undefined, to: to || undefined });
  };
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>تقرير عميل / مورد (اشترى منك بكام)</h3>
      <div className="form">
        <div className="field">
          <label>النوع</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ContactType);
              setName('');
            }}
          >
            <option value="CUSTOMER">عميل</option>
            <option value="SUPPLIER">مورد</option>
          </select>
        </div>
        <div className="field">
          <label>الاسم</label>
          <input list="crNames" placeholder="اكتب الاسم واختاره" value={name} onChange={(e) => setName(e.target.value)} />
          <datalist id="crNames">
            {contacts.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>من تاريخ (اختياري)</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>إلى تاريخ (اختياري)</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <button type="button" className="primary" style={{ marginTop: 12 }} onClick={go}>
        اطلع التقرير
      </button>
      <h3 style={{ margin: '18px 0 8px' }}>أكتر العملاء شراءً</h3>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th>العميل</th>
              <th>عدد الفواتير</th>
              <th>إجمالي المشتريات</th>
              <th>الربح</th>
              <th>الحساب</th>
            </tr>
          </thead>
          <tbody>
            {top.data?.length ? (
              top.data.map((o) => (
                <tr key={o.name} className="prow" onClick={() => open({ kind: 'contactReport', name: o.name, type: 'CUSTOMER' })}>
                  <td>
                    <b>{o.name}</b>
                  </td>
                  <td>{o.count}</td>
                  <td>{money(o.total)}</td>
                  <td style={{ color: pfColor(o.profit), fontWeight: 700 }}>{money(o.profit)}</td>
                  <td style={{ color: o.balance != null ? balanceColor(o.balance) : 'inherit' }}>{o.balance != null ? balanceText({ type: 'CUSTOMER', balance: o.balance }) : '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">{top.isPending ? '…' : 'لسه مفيش مبيعات بأسماء عملاء.'}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** «حالة المخزون»: الأصناف اللي وصلت لحد التنبيه أو أقل. */
export function StockStatusCard() {
  const products = useAllProducts({}).data;
  const low = (products ?? []).filter((p) => p.qty <= p.minQty);
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>حالة المخزون</h3>
      {!products ? (
        <Loading />
      ) : low.length ? (
        <>
          <p>
            أصناف تحتاج متابعة: <b>{low.length}</b>
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>المتاح</th>
                  <th>الحد</th>
                </tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{p.minQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty">كل الأصناف فوق حد التنبيه.</div>
      )}
    </div>
  );
}

interface CR {
  name: string;
  type: ContactType;
  contact: { id: string; phone: string; balance: number } | null;
  items: { name: string; qty: number; total: number; profit: number }[];
  invoices: { id: string; no: string; date: string; total: number; paid: number; remaining: number }[];
  payments: { date: string; amount: number; note: string }[];
  totals: { total: number; shipping: number; paid: number; remaining: number; returns: number; payments: number; net: number; profit: number; count: number };
}

/** كشف حساب العميل/المورد في فترة (contactReport القديمة): ملخص، أصناف، فواتير، ومشاركة/حفظ/طباعة PDF. */
export function ContactReportModal({ name, type, from, to }: { name: string; type: ContactType; from?: string; to?: string }) {
  const { open, close } = useModal();
  const toast = useToast();
  const settings = useSettings().data;
  const [withProfit, setWithProfit] = useState(false);
  const [msg, setMsg] = useState('');
  const isC = type === 'CUSTOMER';
  const q = useQuery({
    queryKey: ['reports', 'contact', name, type, from, to],
    queryFn: ({ signal }) => api.get<{ report: CR }>('/reports/contact', { name, type, from, to }, signal).then((r) => r.report),
  });
  if (q.isPending)
    return (
      <Modal title={`كشف حساب: ${name}`} onClose={close}>
        <Loading />
      </Modal>
    );
  if (q.isError)
    return (
      <Modal title={`كشف حساب: ${name}`} onClose={close}>
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Modal>
    );
  const R = q.data;
  const S = R.totals;
  const per = from || to ? `من ${from || 'البداية'} إلى ${to || 'النهاردة'}` : 'كل الفترات';
  const bal = R.contact ? { type, balance: R.contact.balance } : null;

  const html = () => {
    const T = settings!.theme;
    const H = T.invSync ? T.primary : T.invHeader;
    const HT = textOn(H);
    const tint = mix(H, 0.08);
    const shop = esc(settings!.store.name || 'ميكانيزم');
    const th = (a: string[]) => `<tr style="background:${H};color:${HT}">${a.map((x) => `<th style="padding:10px;text-align:right">${x}</th>`).join('')}</tr>`;
    const td = (a: (string | number)[]) => `<tr style="border-bottom:1px solid #e4eaed">${a.map((x) => `<td style="padding:10px">${x}</td>`).join('')}</tr>`;
    const box = (l: string, v: string) => `<div style="background:${tint};border-radius:10px;padding:12px"><div style="font-size:13px;color:#718087">${l}</div><div style="font-size:19px;font-weight:800">${v}</div></div>`;
    const pf = isC && withProfit;
    return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap"><style>@page{margin:14mm}</style></head><body><div style="width:794px;background:#fff;direction:rtl;font-family:${fontStack(T.invFont === 'same' ? T.font : T.invFont)};color:${T.text};padding-bottom:30px">
 <div style="background:${H};color:${HT};padding:26px 40px;display:flex;justify-content:space-between;align-items:center"><div style="font-size:28px;font-weight:800">${shop}</div><div style="font-size:22px;font-weight:800">كشف حساب ${isC ? 'عميل' : 'مورد'}</div></div>
 <div style="padding:24px 40px"><div style="font-size:22px;font-weight:800">${esc(R.name)}</div><div style="color:#718087;margin-top:4px">${esc(per)}${R.contact?.phone ? ` — <span dir="ltr">${esc(R.contact.phone)}</span>` : ''}</div>
 <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px">${box(isC ? 'إجمالي المشتريات' : 'إجمالي اللي اشتريته منه', money(S.total))}${box('المرتجعات', money(S.returns))}${box('الصافي', money(S.net))}${box('المدفوع في الفواتير', money(S.paid))}${box('دفعات منفصلة', money(S.payments))}${box('الحساب الحالي', bal ? balanceText(bal) : '—')}${pf ? box('الربح', money(S.profit)) : ''}</div>
 <div style="font-weight:800;margin:22px 0 8px">الأصناف</div><table style="width:100%;border-collapse:collapse;font-size:15px">${th(['الصنف', 'الكمية', 'الإجمالي', ...(pf ? ['الربح'] : [])])}${R.items.map((o) => td([esc(o.name), o.qty, money(o.total), ...(pf ? [money(o.profit)] : [])])).join('')}${S.shipping ? td(['🚚 مصاريف النقل', '', money(S.shipping), ...(pf ? [''] : [])]) : ''}</table>
 <div style="font-weight:800;margin:22px 0 8px">الفواتير</div><table style="width:100%;border-collapse:collapse;font-size:15px">${th(['الفاتورة', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي'])}${R.invoices.map((r) => td([esc(r.no), esc(r.date), money(r.total), money(r.paid), money(r.remaining)])).join('')}</table>
 ${R.payments.length ? `<div style="font-weight:800;margin:22px 0 8px">الدفعات</div><table style="width:100%;border-collapse:collapse;font-size:15px">${th(['التاريخ', 'المبلغ', 'ملاحظة'])}${R.payments.map((x) => td([esc(x.date), money(x.amount), esc(x.note || '—')])).join('')}</table>` : ''}
 <div style="text-align:center;color:#718087;font-size:13px;margin-top:26px">${shop} — اتطلع بتاريخ ${new Date().toISOString().slice(0, 10)}</div></div></div></body></html>`;
  };
  const pdf = async (share: boolean) => {
    if (!settings) return;
    setMsg('جاري تجهيز الـ PDF...');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const o = await htmlToPdf(html());
      const r = await shareOrSave(o.blob, `كشف-حساب-${R.name}.pdf`, `كشف حساب ${R.name}`);
      setMsg(r === 'saved' && !share ? 'تم تجهيز الملف ✔' : '');
    } catch (e) {
      setMsg((e as Error).message === 'lib' ? 'مكتبة الـ PDF لم تتحمل، تأكد من الإنترنت' : (e as Error).message || 'حصل خطأ');
    }
  };

  const cs = (l: string, v: string, c?: string) => (
    <div>
      <small>{l}</small>
      <b style={c ? { color: c } : undefined}>{v}</b>
    </div>
  );
  return (
    <Modal title={`كشف حساب: ${R.name}`} onClose={close}>
      <div className="card" style={{ background: 'var(--tint2)', border: 0, lineHeight: 1.9 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {isC ? 'عميل' : 'مورد'} — {per}
        </div>
        <div style={{ fontSize: 20 }}>
          {isC ? `${R.name} اشترى منك بـ` : `اشتريت من ${R.name} بـ`} <b>{money(S.net)}</b>
        </div>
        {isC && (
          <div style={{ fontSize: 20 }}>
            وكسبت منه: <b style={{ color: pfColor(S.profit) }}>{money(S.profit)}</b>
          </div>
        )}
        {bal && (
          <div>
            الحساب الحالي: <b style={{ color: balanceColor(bal.balance) }}>{balanceText(bal)}</b>
          </div>
        )}
      </div>
      <div className="cstats">
        {isC && (
          <>
            {cs('💰 الربح (بعد المرتجعات)', money(S.profit), pfColor(S.profit))}
            {cs('نسبة الربح', `${S.net - S.shipping > 0 ? Math.round((S.profit / (S.net - S.shipping)) * 100) : 0}%`)}
            {cs('تكلفة البضاعة', money(S.net - S.shipping - S.profit))}
          </>
        )}
        {cs('عدد الفواتير', String(S.count))}
        {cs('إجمالي الفواتير', money(S.total))}
        {cs('المرتجعات', money(S.returns))}
        {cs('المدفوع في الفواتير', money(S.paid))}
        {cs('دفعات منفصلة', money(S.payments))}
        {cs('منها مصاريف نقل', money(S.shipping))}
      </div>
      <div className="btnrow">
        <button type="button" className="primary" onClick={() => void pdf(true)}>
          مشاركة PDF
        </button>
        <button type="button" className="secondary" onClick={() => void pdf(false)}>
          حفظ PDF
        </button>
        <button type="button" className="secondary" disabled={!settings} onClick={() => settings && printHtml(html())}>
          🖨️ طباعة
        </button>
      </div>
      {isC && (
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={withProfit} onChange={(e) => setWithProfit(e.target.checked)} /> إظهار الأرباح في الـ PDF (سيبها مقفولة لو هتبعته للعميل)
        </label>
      )}
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{msg}</div>
      <h3 style={{ margin: '16px 0 8px' }}>الأصناف</h3>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 320 }}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>الإجمالي</th>
              {isC && <th>الربح</th>}
            </tr>
          </thead>
          <tbody>
            {R.items.length ? (
              R.items.map((o) => (
                <tr key={o.name}>
                  <td>{o.name}</td>
                  <td>{o.qty}</td>
                  <td>{money(o.total)}</td>
                  {isC && <td style={{ color: pfColor(o.profit), fontWeight: 700 }}>{money(o.profit)}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="empty">مفيش أصناف في الفترة دي.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>الفواتير</h3>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {R.invoices.length ? (
              R.invoices.map((r) => (
                <tr key={r.id} className="prow" onClick={() => open({ kind: 'invoice', id: r.id })}>
                  <td>
                    <b>{r.no}</b>
                  </td>
                  <td>{r.date}</td>
                  <td>{money(r.total)}</td>
                  <td>{money(r.paid)}</td>
                  <td>{money(r.remaining)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">مفيش فواتير في الفترة دي.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
