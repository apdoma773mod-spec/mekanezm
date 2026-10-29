'use client';

import { useState } from 'react';
import { PAY_METHODS } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Icon } from '@/components/icon';
import { useModal } from '@/components/modals/modal-host';
import { Pagination } from '@/components/ui/pagination';
import { ErrorBox, Loading, TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { arDate, formatDateTime, money, PAY_LABELS, todayYmd } from '@/lib/format';
import { useCash, useExpenses, useOverview } from '@/lib/trade-queries';

function CashScreen() {
  const { open } = useModal();
  const [page, setPage] = useState(1);
  const overview = useOverview();
  const expenses = useExpenses({ page, pageSize: 50 });
  const items = expenses.data?.items ?? [];
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="الخزنة والمصروفات"
        subtitle="تسجيل المصروفات والحركات النقدية"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="secondary" href="/work?k=exp" style={{ textDecoration: 'none' }}>
              🧾 مصاريف المعرض
            </a>
            <button type="button" className="primary" onClick={() => open({ kind: 'expense' })}>
              <Icon name="plus" /> مصروف جديد
            </button>
          </div>
        }
      />
      <div className="stats">
        <div className="stat">
          <small>الرصيد الحالي</small>
          <strong>{o ? money(o.cashBalance) : '…'}</strong>
        </div>
        <div className="stat">
          <small>إجمالي المصروفات</small>
          <strong>{o ? money(o.expensesTotal) : '…'}</strong>
        </div>
        <div className="stat">
          <small>مستحقات عند العملاء</small>
          <strong>{o ? money(o.receivables) : '…'}</strong>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>البيان</th>
                <th>الفئة</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={4}
                loading={expenses.isPending}
                error={expenses.isError ? errorMessage(expenses.error) : null}
                empty={!items.length}
                onRetry={() => expenses.refetch()}
              >
                {items.map((x) => (
                  <tr key={x.id} className="prow" onClick={() => open({ kind: 'expense', id: x.id })}>
                    <td>{arDate(x.date)}</td>
                    <td>{x.note || '—'}</td>
                    <td>{x.category}</td>
                    <td>{money(x.amount)}</td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {expenses.data && (
          <Pagination page={expenses.data.page} pageSize={expenses.data.pageSize} total={expenses.data.total} onPage={setPage} />
        )}
      </div>
    </>
  );
}

export default function CashPage() {
  return (
    <AdminOnly>
      <CashScreen />
    </AdminOnly>
  );
}
