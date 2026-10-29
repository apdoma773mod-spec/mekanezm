'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { Pagination } from '@/components/ui/pagination';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { arDate, money } from '@/lib/format';
import { useQuotes } from '@/lib/phase4-queries';

export default function QuotesPage() {
  const { open } = useModal();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [text]);
  const list = useQuotes(q, page);
  const L = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="عروض الأسعار"
        subtitle="مش بتخصم من المخزون ومش بتدخل في التقارير"
        action={
          <button type="button" className="primary" onClick={() => open({ kind: 'quote' })}>
            ＋ عرض سعر جديد
          </button>
        }
      />
      <div className="card">
        <input placeholder="ابحث بالاسم أو الرقم أو الصنف..." value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th>الأصناف</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              <TableState cols={6} loading={list.isPending} error={list.isError ? errorMessage(list.error) : null} empty={!L.length} onRetry={() => list.refetch()}>
                {L.map((x) => (
                  <tr key={x.id} className="prow" onClick={() => open({ kind: 'quoteView', id: x.id })}>
                    <td>
                      <b>{x.no}</b>
                    </td>
                    <td>{arDate(x.date)}</td>
                    <td>{x.person || '—'}</td>
                    <td>
                      {x.items[0]?.name ?? '—'}
                      {x.items.length > 1 && <span className="badge"> +{x.items.length - 1}</span>}
                    </td>
                    <td>{money(x.total)}</td>
                    <td>{x.status === 'converted' ? <span className="badge green">اتحول لفاتورة</span> : <span className="badge">مفتوح</span>}</td>
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
