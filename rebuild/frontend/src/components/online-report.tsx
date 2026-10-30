'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import { esc, printHtml } from '@/lib/print';
import { ONLINE_FROM_LABELS } from '@mk/shared';
const fromLabel = (k: string) => ONLINE_FROM_LABELS[k as keyof typeof ONLINE_FROM_LABELS] ?? k;
import { useModal } from './modals/modal-host';
import { ErrorBox, Loading } from './ui/states';

interface Side {
  invoices: number;
  customers: number;
  total: number;
  paid: number;
  remaining: number;
  profit: number;
}
interface OnlineReport {
  online: Side;
  shop: Side;
  bySource: (Side & { from: string })[];
  customers: { name: string; phone: string; from: string; invoices: number; total: number; remaining: number; profit: number; first: string; last: string }[];
  items: { name: string; qty: number; total: number }[];
  invoices: { id: string; no: string; date: string; person: string; from: string; total: number; remaining: number }[];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PERIODS: [string, string, () => [string, string]][] = [
  ['today', 'النهاردة', () => [todayYmd(), todayYmd()]],
  ['week', 'آخر 7 أيام', () => [ymd(new Date(Date.now() - 6 * 864e5)), todayYmd()]],
  ['month', 'الشهر ده', () => [todayYmd().slice(0, 8) + '01', todayYmd()]],
  ['year', 'السنة دي', () => [todayYmd().slice(0, 5) + '01-01', todayYmd()]],
  ['all', 'من الأول', () => ['', '']],
];

/** «🌐 العملاء الأونلاين»: sales marked «عميل أونلاين» in any period — customers, totals, profit, items — next to the shop. */
export function OnlineReportCard() {
  const { open } = useModal();
  const [p, setP] = useState('month');
  const [range, setRange] = useState<[string, string]>(PERIODS[2]![2]());
  const [tab, setTab] = useState<'customers' | 'items' | 'invoices'>('customers');
  const q = useQuery({
    queryKey: ['reports', 'online', range],
    queryFn: ({ signal }) => api.get<{ report: OnlineReport }>('/reports/online', { ...(range[0] ? { from: range[0] } : {}), ...(range[1] ? { to: range[1] } : {}) }, signal).then((r) => r.report),
  });
  const r = q.data;
  const label = range[0] ? (range[0] === range[1] ? range[0] : `من ${range[0]} لـ ${range[1]}`) : 'من الأول';

  const print = () => {
    if (!r) return;
    const o = r.online;
    printHtml(
      `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>العملاء الأونلاين</title><style>body{font-family:Cairo,Tahoma,sans-serif;padding:14px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #ccc;padding:6px;text-align:right}</style></head><body>` +
        `<h2>🌐 العملاء الأونلاين — ${esc(label)}</h2>` +
        `<p>عدد العملاء: <b>${o.customers}</b> — عدد الفواتير: <b>${o.invoices}</b> — المبيعات: <b>${money(o.total)}</b> — اتدفع: <b>${money(o.paid)}</b> — باقي: <b>${money(o.remaining)}</b> — المكسب: <b>${money(o.profit)}</b></p>` +
        `<p>${r.bySource.map((x) => `${esc(fromLabel(x.from))}: ${x.customers} عميل — ${money(x.total)}`).join(' • ')}</p>` +
        `<table><tr><th>العميل</th><th>التليفون</th><th>فواتير</th><th>اشترى بـ</th><th>باقي عليه</th><th>أول مرة</th><th>آخر مرة</th></tr>` +
        r.customers.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${c.invoices}</td><td>${money(c.total)}</td><td>${money(c.remaining)}</td><td>${c.first}</td><td>${c.last}</td></tr>`).join('') +
        `</table></body></html>`,
    );
  };

  return (
    <div className="card" style={{ marginTop: 14 }} id="onlineReport">
      <h3>🌐 العملاء الأونلاين</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PERIODS.map(([k, l, f]) => (
          <button
            key={k}
            type="button"
            className={p === k ? 'primary' : 'secondary'}
            style={{ padding: '8px 12px', borderRadius: 99 }}
            onClick={() => {
              setP(k);
              setRange(f());
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 10 }}>
        <label>
          من <input type="date" value={range[0]} onChange={(e) => (setP(''), setRange([e.target.value, range[1] || todayYmd()]))} />
        </label>
        <label>
          لـ <input type="date" value={range[1]} onChange={(e) => (setP(''), setRange([range[0], e.target.value]))} />
        </label>
        <button type="button" className="secondary" disabled={!r} onClick={print}>
          🖨️ طباعة
        </button>
      </div>
      {q.isPending && <Loading />}
      {q.isError && <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {r && (
        <>
          <div className="stats">
            <div className="stat">
              <small>عملاء أونلاين اشتغلت معاهم</small>
              <strong>{r.online.customers}</strong>
            </div>
            <div className="stat">
              <small>فواتير أونلاين</small>
              <strong>{r.online.invoices}</strong>
            </div>
            <div className="stat">
              <small>بعت أونلاين بـ</small>
              <strong>{money(r.online.total)}</strong>
            </div>
            <div className="stat">
              <small>المكسب من الأونلاين</small>
              <strong>{money(r.online.profit)}</strong>
            </div>
            <div className="stat">
              <small>باقي على عملاء الأونلاين</small>
              <strong style={{ color: r.online.remaining > 0 ? 'var(--danger)' : undefined }}>{money(r.online.remaining)}</strong>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0' }}>
            للمقارنة — المحل (عميل عادي): {r.shop.customers} عميل، {r.shop.invoices} فاتورة، {money(r.shop.total)}.
            {r.online.total + r.shop.total > 0 ? ` الأونلاين = ${Math.round((r.online.total / (r.online.total + r.shop.total)) * 100)}% من المبيعات.` : ''}
          </p>
          {r.bySource.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 10 }} id="onlineBySource">
              <table className="table">
                <thead>
                  <tr>
                    <th>جه منين</th>
                    <th>عملاء</th>
                    <th>فواتير</th>
                    <th>بعت بـ</th>
                    <th>المكسب</th>
                    <th>باقي</th>
                  </tr>
                </thead>
                <tbody>
                  {r.bySource.map((x) => (
                    <tr key={x.from}>
                      <td>
                        <b>{fromLabel(x.from)}</b>
                      </td>
                      <td>{x.customers}</td>
                      <td>{x.invoices}</td>
                      <td>{money(x.total)}</td>
                      <td>{money(x.profit)}</td>
                      <td>{money(x.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(
              [
                ['customers', `العملاء (${r.customers.length})`],
                ['items', 'الأصناف'],
                ['invoices', `الفواتير (${r.online.invoices})`],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} style={{ padding: '8px 12px', borderRadius: 99 }} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {!r.online.invoices ? (
            <div className="empty">مفيش بيع أونلاين في الفترة دي. علّم الفاتورة «🌐 عميل أونلاين» وانت بتبيع.</div>
          ) : (
            <div className="table-wrap">
              {tab === 'customers' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>العميل</th>
                      <th>التليفون</th>
                      <th>جه منين</th>
                      <th>فواتير</th>
                      <th>اشترى بـ</th>
                      <th>المكسب</th>
                      <th>باقي عليه</th>
                      <th>آخر مرة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.customers.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <b>{c.name}</b>
                        </td>
                        <td dir="ltr">{c.phone}</td>
                        <td>{fromLabel(c.from)}</td>
                        <td>{c.invoices}</td>
                        <td>{money(c.total)}</td>
                        <td>{money(c.profit)}</td>
                        <td style={{ color: c.remaining > 0 ? 'var(--danger)' : undefined }}>{money(c.remaining)}</td>
                        <td>{c.last}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'items' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>بـ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((x) => (
                      <tr key={x.name}>
                        <td>{x.name}</td>
                        <td>{x.qty}</td>
                        <td>{money(x.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'invoices' && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>الرقم</th>
                      <th>التاريخ</th>
                      <th>العميل</th>
                      <th>جه منين</th>
                      <th>الإجمالي</th>
                      <th>الباقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.invoices.map((x) => (
                      <tr key={x.id} className="prow" onClick={() => open({ kind: 'invoice', id: x.id })}>
                        <td>{x.no}</td>
                        <td>{x.date}</td>
                        <td>{x.person}</td>
                        <td>{fromLabel(x.from)}</td>
                        <td>{money(x.total)}</td>
                        <td>{money(x.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
