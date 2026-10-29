'use client';

import { useEffect, useState } from 'react';
import type { InvoiceKind } from '@mk/shared';
import type { InvoiceListResult } from '@mk/shared';
import { CameraScanner } from '@/components/scan/camera-scanner';
import { ImportDailyButton } from '@/components/daybook/import-daily';
import { useIsAdmin } from '@/components/use-role';
import { api, errorMessage } from '@/lib/api';
import { arDate, money } from '@/lib/format';
import { useInvoices } from '@/lib/trade-queries';
import { useCompany } from './company';
import { PageHeader } from './app-shell';
import { Icon } from './icon';
import { useModal } from './modals/modal-host';
import { Pagination } from './ui/pagination';
import { TableState } from './ui/states';

const TEXT = {
  SALE: {
    title: 'المبيعات',
    sub: 'تسجيل ومراجعة حركة البيع',
    add: 'تسجيل بيع',
    search: 'ابحث بالاسم أو التاريخ أو العميل أو رقم الفاتورة...',
    person: 'العميل',
    count: 'فاتورة بيع',
  },
  PURCHASE: {
    title: 'المشتريات',
    sub: 'كل فواتير وتوريدات الشراء',
    add: 'تسجيل شراء',
    search: 'ابحث بالاسم أو التاريخ أو المورد أو رقم الفاتورة...',
    person: 'المورد',
    count: 'فاتورة شراء',
  },
} as const;

/** The old «المبيعات» / «المشتريات» screens: search box, count line, and the invoice table. */
export function InvoiceListScreen({ kind }: { kind: InvoiceKind }) {
  const { open } = useModal();
  const t = TEXT[kind];
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [voided, setVoided] = useState(false);
  const [page, setPage] = useState(1);
  const { co } = useCompany();
  const admin = useIsAdmin();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const list = useInvoices({ kind, company: co, q: search || undefined, status: voided ? 'VOID' : 'ACTIVE', page, pageSize: 50 });
  const items = list.data?.items ?? [];
  const sums = list.data?.sums;
  const [scanning, setScanning] = useState(false);
  const openByNumber = async (code: string) => {
    const r = await api.get<InvoiceListResult>('/invoices', { kind, q: code.trim(), pageSize: 5 });
    const hit = r.items.find((x) => x.no.toUpperCase() === code.trim().toUpperCase()) ?? r.items[0];
    if (!hit) return false;
    setScanning(false);
    open({ kind: 'invoice', id: hit.id });
    return true;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.sub}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {kind === 'SALE' && (
              <>
                <button type="button" className="secondary" id="mkInvScanBtn" onClick={() => setScanning(true)}>
                  📷 فاتورة بالباركود
                </button>
                {admin && <ImportDailyButton>استيراد يومية (إكسل)</ImportDailyButton>}
              </>
            )}
            <button type="button" className="primary" onClick={() => open({ kind: 'transaction', type: kind })}>
              {t.add}
            </button>
          </div>
        }
      />
      <div className="card">
        <input
          className="search"
          style={{ width: '100%', marginBottom: 6 }}
          placeholder={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="count-line" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span>
            {list.data ? `${list.data.total.toLocaleString('ar-EG')} ${t.count}` : ''}
            {sums && list.data!.total > 0 && ` — إجمالي ${money(sums.total)}${sums.remaining > 0 ? ` • متبقي ${money(sums.remaining)}` : ''}`}
          </span>
          <label className="chk" style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={voided}
              onChange={(e) => {
                setVoided(e.target.checked);
                setPage(1);
              }}
            />
            الفواتير الملغية
          </label>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ opacity: list.isFetching && !list.isPending ? 0.7 : 1 }}>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>التاريخ</th>
                <th>{t.person}</th>
                <th>الأصناف</th>
                <th>الإجمالي</th>
                {kind === 'SALE' && <th>الدفع</th>}
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={kind === 'SALE' ? 6 : 5}
                loading={list.isPending}
                error={list.isError ? errorMessage(list.error) : null}
                empty={!items.length}
                onRetry={() => list.refetch()}
              >
                {items.map((r) => (
                  <tr key={r.id} className="prow" onClick={() => open({ kind: 'invoice', id: r.id })}>
                    <td>
                      <b>{r.no}</b>
                    </td>
                    <td>{arDate(r.date)}</td>
                    <td>{r.person || '—'}</td>
                    <td>
                      {r.firstItem || '—'}
                      {r.itemCount > 1 && <span className="badge"> +{(r.itemCount - 1).toLocaleString('ar-EG')} صنف</span>}
                      {r.shipping > 0 && <span className="badge"> 🚚 نقل</span>}
                    </td>
                    <td>{money(r.total)}</td>
                    {kind === 'SALE' && (
                    <td>
                      {r.status === 'VOID' ? (
                        <span className="badge red">ملغية</span>
                      ) : r.remaining > 0 ? (
                        <span className="badge red">متبقي {money(r.remaining)}</span>
                      ) : (
                        <span className="badge green">مدفوعة</span>
                      )}
                    </td>
                    )}
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {scanning && <CameraScanner title="امسح باركود الفاتورة" onClose={() => setScanning(false)} onCode={(c) => openByNumber(c)} />}
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </div>
    </>
  );
}
