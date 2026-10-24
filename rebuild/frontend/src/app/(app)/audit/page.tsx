'use client';

import { useEffect, useState } from 'react';
import { AUDIT_ACTIONS, type AuditAction, type AuditEntry } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { SelectField, TextField } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { AUDIT_LABELS, formatDateTime } from '@/lib/format';
import { useAudit } from '@/lib/queries';

function Diff({ entry }: { entry: AuditEntry }) {
  if (entry.before === null && entry.after === null) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-bold text-primary">التفاصيل</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {entry.before !== null && (
          <pre dir="ltr" className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(entry.before, null, 2)}
          </pre>
        )}
        {entry.after !== null && (
          <pre dir="ltr" className="overflow-x-auto rounded-lg bg-primary/10 p-3 text-xs">
            {JSON.stringify(entry.after, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
}

function AuditScreen() {
  const [action, setAction] = useState<'' | AuditAction>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const audit = useAudit({
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    q: search || undefined,
    page,
    pageSize: 50,
  });

  return (
    <>
      <PageHeader title="سجل العمليات" subtitle="كل تعديل اتعمل في السيستم ومين عمله" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="بحث" placeholder="اسم المستخدم" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField
          label="العملية"
          options={[{ value: '', label: 'الكل' }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_LABELS[a] ?? a }))]}
          value={action}
          onChange={(e) => {
            setAction(e.target.value as '' | AuditAction);
            setPage(1);
          }}
        />
        <TextField
          label="من يوم"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="لحد يوم"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {audit.isPending ? (
        <LoadingState />
      ) : audit.isError ? (
        <ErrorState message={errorMessage(audit.error)} onRetry={() => audit.refetch()} />
      ) : audit.data.items.length === 0 ? (
        <EmptyState title="مفيش عمليات" hint="غيّر الفلتر أو التاريخ" />
      ) : (
        <>
          <ul className={`space-y-2 ${audit.isFetching ? 'opacity-70' : ''}`}>
            {audit.data.items.map((e) => (
              <li key={e.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {AUDIT_LABELS[e.action] ?? e.action}
                    <span className="font-normal text-subtle"> · {e.user?.name ?? 'مستخدم محذوف'}</span>
                  </p>
                  <time className="text-sm text-subtle">{formatDateTime(e.createdAt)}</time>
                </div>
                <Diff entry={e} />
              </li>
            ))}
          </ul>
          <Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPage={setPage} />
        </>
      )}
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
