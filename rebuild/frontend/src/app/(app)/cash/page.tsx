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

function DrawerMoves() {
  const [from, setFrom] = useState(todayYmd());
  const [to, setTo] = useState(todayYmd());
  const cash = useCash({ from, to });
  const s = cash.data;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>حركة الخزنة</h3>
      <div className="toolbar">
        <label className="chk">
          من <input type="date" className="search" style={{ minWidth: 0 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="chk">
          لحد <input type="date" className="search" style={{ minWidth: 0 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {cash.isPending ? (
        <Loading />
      ) : cash.isError ? (
        <ErrorBox message={errorMessage(cash.error)} onRetry={() => cash.refetch()} />
      ) : s ? (
        <>
          <div className="cstats">
            <div>
              <small>داخل</small>
              <b style={{ color: 'var(--green)' }}>{money(s.totals.in)}</b>
            </div>
            <div>
              <small>خارج</small>
              <b style={{ color: 'var(--danger)' }}>{money(s.totals.out)}</b>
            </div>
            <div>
              <small>الصافي</small>
              <b>{money(s.totals.net)}</b>
            </div>
            {PAY_METHODS.filter((m) => s.byMethod[m].in || s.byMethod[m].out).map((m) => (
              <div key={m}>
                <small>{PAY_LABELS[m]}</small>
                <b>{money(s.byMethod[m].net)}</b>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>البيان</th>
                  <th>الطريقة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <TableState cols={4} loading={false} error={null} empty={!s.moves.length}>
                  {s.moves.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.at)}</td>
                      <td>{m.label}</td>
                      <td>{PAY_LABELS[m.method]}</td>
                      <td dir="ltr" style={{ textAlign: 'right', fontWeight: 700, color: m.amount < 0 ? 'var(--danger)' : 'var(--green)' }}>
                        {m.amount > 0 ? '+' : ''}
                        {money(m.amount)}
                      </td>
                    </tr>
                  ))}
                </TableState>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

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
          <button type="button" className="primary" onClick={() => open({ kind: 'expense' })}>
            <Icon name="plus" /> تسجيل مصروف
          </button>
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
      <DrawerMoves />
      <div className="card" style={{ marginTop: 14 }}>
        <h3>المصروفات</h3>
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
