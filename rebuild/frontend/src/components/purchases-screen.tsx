'use client';

import { ScanQueueCard } from './modals/invoice-photo';
import { useEffect, useState } from 'react';
import type { InvoiceDto, InvoiceListItem } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { esc, printHtml } from '@/lib/print';
import { useApplyCost, useCostChange, useInvoicePersons, useInvoices } from '@/lib/trade-queries';
import { PageHeader } from './app-shell';
import { useCompany } from './company';
import { useModal } from './modals/modal-host';
import { useToast } from './ui/toast';
import { useIsAdmin } from './use-role';
import { Loading } from './ui/states';

const IN = { padding: 11, border: '1px solid var(--border,#d9e1e4)', borderRadius: 10, fontSize: 15, background: 'var(--card,#fff)', color: 'inherit' } as const;
const snoOf = (note: string) => note.match(/فاتورة المورد:\s*([^\s—\n]+)/)?.[1] ?? '';

function CostPanel({ id }: { id: string }) {
  const toast = useToast();
  const rows = useCostChange(id, true);
  const apply = useApplyCost();
  if (rows.isPending) return <Loading />;
  const L = rows.data ?? [];
  return (
    <div style={{ margin: '6px 0', padding: 8, background: 'var(--tint2,#f3f8f9)', borderRadius: 10, fontSize: 13, lineHeight: 1.9 }}>
      <b>تغيّر التكلفة</b>
      {L.map((x, i) => {
        const d = x.prev ? ((x.price - x.prev) / x.prev) * 100 : null;
        return (
          <div key={i}>
            {x.name}: {x.prev != null ? `${money(x.prev)} ← ` : ''}
            <b>{money(x.price)}</b>
            {d != null ? (
              <span style={{ color: d > 0 ? '#c0392b' : '#159447' }}>
                {' '}
                {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
              </span>
            ) : (
              <small> (أول شراء)</small>
            )}
            {x.cost != null ? ` — التكلفة الحالية في المخزن ${money(x.cost)}` : ''}
          </div>
        );
      })}
      <button
        type="button"
        className="secondary"
        style={{ marginTop: 6 }}
        onClick={async () => {
          if (!window.confirm(`تحدّث سعر الشراء (التكلفة) في المخزن بأسعار الفاتورة دي لـ ${L.length} صنف؟`)) return;
          try {
            const n = await apply.mutateAsync(id);
            toast(`✔ اتحدّث ${n} صنف`);
          } catch (e) {
            toast(errorMessage(e), 'bad');
          }
        }}
      >
        🔄 حدّث سعر الشراء في المخزن بالأسعار دي
      </button>
    </div>
  );
}

/** The old purchases screen (فواتير الشراء الغنية): filters, one card per invoice, cost change, copy, print, payment, return. */
export function PurchasesScreen() {
  const { open } = useModal();
  const toast = useToast();
  const { co } = useCompany();
  const admin = useIsAdmin();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [sup, setSup] = useState('');
  const [pay, setPay] = useState<'all' | 'paid' | 'credit'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openCost, setOpenCost] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const persons = useInvoicePersons('PURCHASE', co).data ?? [];
  const list = useInvoices({ kind: 'PURCHASE', company: co, q: search || undefined, person: sup || undefined, pay, from: from || undefined, to: to || undefined, status: 'ACTIVE', page: 1, pageSize: 80 });
  const items = list.data?.items ?? [];
  const sums = list.data?.sums;

  const fetchInvoice = (id: string) => api.get<{ invoice: InvoiceDto }>(`/invoices/${id}`).then((r) => r.invoice);

  const copy = async (r: InvoiceListItem) => {
    try {
      const inv = await fetchInvoice(r.id);
      open({
        kind: 'transaction',
        type: 'PURCHASE',
        preset: { person: inv.person, lines: inv.items.filter((x) => x.productId).map((x) => ({ productId: x.productId!, name: x.name, qty: x.qty, price: x.price })) },
      });
      toast('اتنسخت — عدّل التاريخ والأسعار واحفظ');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const print = async (r: InvoiceListItem) => {
    try {
      const inv = await fetchInvoice(r.id);
      printHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap"><title>فاتورة شراء</title><style>body{font-family:Cairo,Tahoma,sans-serif;padding:14px;color:#000}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:8px;text-align:right;font-size:14pt}h2{margin:0 0 6px}</style></head><body><h2>فاتورة شراء ${esc(inv.no)}</h2><div style="font-size:13pt">المورد: <b>${esc(inv.person || '—')}</b> — ${esc(inv.date)}</div><table><tr><th>الصنف</th><th>العدد</th><th>السعر</th><th>الإجمالي</th></tr>${inv.items.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.qty}</td><td>${esc(money(x.price))}</td><td>${esc(money(x.total))}</td></tr>`).join('')}</table><h3>الإجمالي: ${esc(money(inv.total))}</h3></body></html>`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <>
      <PageHeader
        title="المشتريات"
        subtitle="كل فواتير وتوريدات الشراء"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={() => open({ kind: 'transaction', type: 'PURCHASE' })}>
              تسجيل شراء
            </button>
            {admin && (
              <button type="button" className="secondary" id="pwBtn" onClick={() => open({ kind: 'market' })}>
                💹 أسعار السوق
              </button>
            )}
            <button type="button" className="secondary" id="piBtn" onClick={() => open({ kind: 'purchImport' })} style={{ marginRight: 8 }}>
              📥 استيراد فواتير
            </button>
          </div>
        }
      />
      <ScanQueueCard />
      <div id="pvx">
        <div className="card">
          <input
            placeholder="🔍 ابحث: مورد، رقم، صنف، تاريخ..."
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', ...IN, marginBottom: 8 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={sup} onChange={(e) => setSup(e.target.value)} style={IN}>
              <option value="">كل الموردين</option>
              {persons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={pay} onChange={(e) => setPay(e.target.value as typeof pay)} style={IN}>
              <option value="all">مدفوع وآجل</option>
              <option value="paid">مدفوعة بس</option>
              <option value="credit">آجل / عليها متبقي</option>
            </select>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>
              من
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: '100%', ...IN }} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>
              إلى
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%', ...IN }} />
            </label>
          </div>
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--tint2,#eef6f7)', lineHeight: 1.9 }}>
            <b>{list.data?.total ?? 0}</b> فاتورة
            {admin && sums && (
              <>
                {' '}
                — إجمالي الفترة <b>{money(sums.total)}</b>
                {sums.remaining > 0 && (
                  <>
                    {' '}
                    — متبقي للموردين <b style={{ color: '#c0392b' }}>{money(sums.remaining)}</b>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {list.isPending ? (
          <div className="card" style={{ marginTop: 10 }}>
            <Loading />
          </div>
        ) : items.length ? (
          items.map((r) => {
            const sn = snoOf(r.note);
            const isOpen = openCost === r.id;
            return (
              <div key={r.id} className="card" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <b>{r.no || '—'}</b>
                    {sn && <small> (مورد: {sn})</small>}
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {r.date} — {r.person || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    {admin && <b style={{ fontSize: 17 }}>{money(r.total)}</b>}
                    <div>{r.remaining > 0.009 ? <span className="badge red">متبقي {money(r.remaining)}</span> : <span className="badge green">مدفوعة</span>}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, margin: '6px 0' }}>
                  {r.preview.map((x) => `${x.name} ×${x.qty}`).join(' ، ')}
                  {r.itemCount > 3 && <span className="badge"> +{r.itemCount - 3}</span>}
                </div>
                {isOpen && admin && <CostPanel id={r.id} />}
                <div className="btnrow" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="primary" onClick={() => open({ kind: 'invoice', id: r.id })}>
                    فتح
                  </button>
                  <button type="button" className="secondary" onClick={() => open({ kind: 'transaction', type: 'PURCHASE', editId: r.id })}>
                    ✏️ تعديل
                  </button>
                  <button type="button" className="secondary" onClick={() => void copy(r)}>
                    📋 نسخ
                  </button>
                  <button type="button" className="secondary" onClick={() => void print(r)}>
                    🖨️
                  </button>
                  {admin && (
                    <>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => (r.contactId ? open({ kind: 'payment', contactId: r.contactId }) : toast('المورد ده مش مسجل في جهات الاتصال', 'bad'))}
                      >
                        💵 دفعة
                      </button>
                      <button type="button" className="secondary" onClick={() => open({ kind: 'return', type: 'PURCHASE' })}>
                        ↩️ مرتجع
                      </button>
                      <button type="button" className="secondary" onClick={() => setOpenCost(isOpen ? null : r.id)}>
                        {isOpen ? '▲' : '▼'} تكلفة
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="empty">مفيش فواتير بالفلاتر دي.</div>
          </div>
        )}
        {(list.data?.total ?? 0) > 80 && (
          <div className="card" style={{ marginTop: 10, textAlign: 'center' }}>
            بيعرض أول 80 فاتورة — ضيّق البحث
          </div>
        )}
      </div>
    </>
  );
}
