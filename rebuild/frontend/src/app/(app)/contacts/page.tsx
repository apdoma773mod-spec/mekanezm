'use client';

import { useEffect, useState } from 'react';
import type { ContactType } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Icon } from '@/components/icon';
import { useModal } from '@/components/modals/modal-host';
import { Pagination } from '@/components/ui/pagination';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { balanceColor, balanceText, CONTACT_LABELS } from '@/lib/format';
import { useContacts } from '@/lib/trade-queries';

function ContactsScreen() {
  const { open } = useModal();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'' | ContactType>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = useContacts({ q: search || undefined, type: type || undefined, page, pageSize: 50 });
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="العملاء والموردون"
        subtitle="بيانات التعاملات التجارية"
        action={
          <button type="button" className="primary" onClick={() => open({ kind: 'contact' })}>
            <Icon name="plus" /> إضافة
          </button>
        }
      />
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو التليفون..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="search"
          style={{ maxWidth: 160 }}
          value={type}
          onChange={(e) => {
            setType(e.target.value as '' | ContactType);
            setPage(1);
          }}
        >
          <option value="">الكل</option>
          <option value="CUSTOMER">عملاء</option>
          <option value="SUPPLIER">موردين</option>
        </select>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>الهاتف</th>
                <th>المستحق (الرصيد)</th>
                <th>العنوان</th>
                <th>إجراء</th>
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
                {items.map((c) => (
                  <tr key={c.id} className="prow" onClick={() => open({ kind: 'contactFile', id: c.id })}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>
                      <span className={`badge ${c.type === 'CUSTOMER' ? 'green' : ''}`}>{CONTACT_LABELS[c.type]}</span>
                    </td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>
                      {c.phone || '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: balanceColor(c.balance) }}>{balanceText(c)}</td>
                    <td>{c.address || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="secondary" onClick={() => open({ kind: 'contactFile', id: c.id })}>
                        الملف
                      </button>{' '}
                      <button type="button" className="secondary" onClick={() => open({ kind: 'payment', contactId: c.id })}>
                        {c.type === 'CUSTOMER' ? 'تحصيل' : 'سداد'}
                      </button>
                    </td>
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

export default function ContactsPage() {
  return (
    <AdminOnly>
      <ContactsScreen />
    </AdminOnly>
  );
}
