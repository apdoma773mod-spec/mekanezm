'use client';

import { useEffect, useState } from 'react';
import { AUDIT_ACTIONS, type AuditAction } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Pagination } from '@/components/ui/pagination';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { AUDIT_LABELS, formatDateTime } from '@/lib/format';
import { useAudit } from '@/lib/queries';

function AuditScreen() {
  const [action, setAction] = useState<'' | AuditAction>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const audit = useAudit({ action: action || undefined, from: from || undefined, to: to || undefined, q: search || undefined, page, pageSize: 50 });
  const items = audit.data?.items ?? [];

  return (
    <>
      <PageHeader title="سجل العمليات" subtitle="كل تعديل اتعمل في السيستم ومين عمله" />
      <div className="toolbar">
        <input className="search" placeholder="اسم المستخدم..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="search"
          style={{ maxWidth: 200 }}
          value={action}
          onChange={(e) => {
            setAction(e.target.value as '' | AuditAction);
            setPage(1);
          }}
        >
          <option value="">كل العمليات</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {AUDIT_LABELS[a] ?? a}
            </option>
          ))}
        </select>
        <input type="date" className="search" style={{ maxWidth: 170 }} value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} aria-label="من يوم" />
        <input type="date" className="search" style={{ maxWidth: 170 }} value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} aria-label="لحد يوم" />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>العملية</th>
                <th>مين</th>
                <th>التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={4}
                loading={audit.isPending}
                error={audit.isError ? errorMessage(audit.error) : null}
                empty={!items.length}
                onRetry={() => audit.refetch()}
              >
                {items.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDateTime(e.createdAt)}</td>
                    <td>{AUDIT_LABELS[e.action] ?? e.action}</td>
                    <td>{e.user?.name ?? '—'}</td>
                    <td>
                      {e.before !== null || e.after !== null ? (
                        openId === e.id ? (
                          <pre dir="ltr" style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', maxWidth: 420 }}>
                            {JSON.stringify({ before: e.before, after: e.after }, null, 1)}
                          </pre>
                        ) : (
                          <button type="button" className="secondary" onClick={() => setOpenId(e.id)}>
                            اعرض
                          </button>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {audit.data && <Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPage={setPage} />}
      </div>
    </>
  );
}

export default function AuditPage() {
  return (
    <AdminOnly>
      <AuditScreen />
    </AdminOnly>
  );
}
