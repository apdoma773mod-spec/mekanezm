'use client';

import { useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Icon } from '@/components/icon';
import { useModal } from '@/components/modals/modal-host';
import { Pagination } from '@/components/ui/pagination';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { arDate, money, qtyText } from '@/lib/format';
import { useOverview, useReturns } from '@/lib/trade-queries';

function ReturnsScreen() {
  const { open } = useModal();
  const [page, setPage] = useState(1);
  const overview = useOverview();
  const list = useReturns({ page, pageSize: 50 });
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="المرتجعات"
        subtitle="مرتجع بيع من العميل أو مرتجع شراء للمورد"
        action={
          <button type="button" className="primary" onClick={() => open({ kind: 'return', type: 'SALE' })}>
            <Icon name="plus" /> تسجيل مرتجع
          </button>
        }
      />
      <div className="stats">
        <div className="stat">
          <small>مرتجعات المبيعات</small>
          <strong>{overview.data ? money(overview.data.saleReturns) : '…'}</strong>
        </div>
        <div className="stat">
          <small>مرتجعات المشتريات</small>
          <strong>{overview.data ? money(overview.data.purchaseReturns) : '…'}</strong>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المنتج</th>
                <th>الجهة</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={6}
                loading={list.isPending}
                error={list.isError ? errorMessage(list.error) : null}
                empty={!items.length}
                onRetry={() => list.refetch()}
              >
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{arDate(r.date)}</td>
                    <td>
                      <span className={`badge ${r.kind === 'SALE' ? 'green' : ''}`}>{r.kind === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء'}</span>
                    </td>
                    <td>{r.product.name}</td>
                    <td>
                      {r.person || '—'}
                      {r.settlement === 'BALANCE' && <small style={{ color: 'var(--muted)' }}> (على الحساب)</small>}
                    </td>
                    <td>
                      {qtyText(r.qty)} {r.product.unit}
                    </td>
                    <td>{money(r.total)}</td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </div>
    </>
  );
}

export default function ReturnsPage() {
  return (
    <AdminOnly>
      <ReturnsScreen />
    </AdminOnly>
  );
}
