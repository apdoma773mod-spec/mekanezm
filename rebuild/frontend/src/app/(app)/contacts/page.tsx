'use client';

import { useMemo, useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { useCtMode } from '@/lib/ct-mode';
import { balanceColor, balanceText, money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { useAllContacts } from '@/lib/trade-queries';

type Bal = 'all' | 'open' | 'pos' | 'neg';

/** The old «العملاء» / «الموردين» screens (mkCt…): two modes, balance filters, summary, no paging. */
function ContactsScreen() {
  const { open } = useModal();
  const [mode, setMode] = useCtMode();
  const isC = mode === 'CUSTOMER';
  const [q, setQ] = useState<Record<string, string>>({});
  const [bf, setBf] = useState<Bal>('all');
  const list = useAllContacts(mode);
  const L = list.data ?? [];

  const pos = L.reduce((a, c) => a + Math.max(0, c.balance), 0);
  const neg = L.reduce((a, c) => a + Math.min(0, c.balance), 0);
  const nz = L.filter((c) => Math.abs(c.balance) >= 0.005).length;
  const po = L.filter((c) => c.balance >= 0.005).length;
  const ng = L.filter((c) => c.balance <= -0.005).length;

  const rows = useMemo(() => {
    const w = vn(q[mode] ?? '').split(' ').filter(Boolean);
    return L.filter((c) => {
      const hay = vn(`${c.name} ${c.phone || ''}`);
      if (!w.every((x) => hay.includes(x))) return false;
      if (bf === 'open') return Math.abs(c.balance) >= 0.005;
      if (bf === 'pos') return c.balance >= 0.005;
      if (bf === 'neg') return c.balance <= -0.005;
      return true;
    });
  }, [L, q, mode, bf]);

  const pick = (m: 'CUSTOMER' | 'SUPPLIER') => {
    if (m !== mode) setBf('all');
    setMode(m);
  };
  const filters: [Bal, string][] = [
    ['all', `الكل (${L.length})`],
    ['open', `💰 اللي حسابهم مفتوح (${nz})`],
    ['pos', `${isC ? '🔴 عليهم' : '🔴 علينا ليهم'} (${po})`],
    ['neg', `${isC ? '🟢 ليهم رصيد' : '🟢 لينا عندهم'} (${ng})`],
  ];

  return (
    <>
      <PageHeader
        title={isC ? '👥 العملاء' : '🏭 الموردين'}
        subtitle={isC ? 'رصيد كل عميل (الآجل)، كشف حساب، تحصيل دفعة، وفواتير البيع' : 'رصيد كل مورد (اللي علينا)، كشف حساب، سداد دفعة، وفواتير الشراء'}
        action={
          <button type="button" className="primary" onClick={() => open({ kind: 'contact', type: mode })}>
            {isC ? '➕ إضافة عميل' : '➕ إضافة مورد'}
          </button>
        }
      />
      <div id="ctTabs" className="toolbar">
        {(
          [
            ['CUSTOMER', '👥 العملاء'],
            ['SUPPLIER', '🏭 الموردين'],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className={mode === m ? 'primary' : 'secondary'} style={{ flex: 1, minHeight: 48, fontSize: 17 }} onClick={() => pick(m)}>
            {label}
          </button>
        ))}
      </div>
      <div id="ctBal" className="toolbar" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        {filters.map(([k, label]) => (
          <button key={k} type="button" className={bf === k ? 'primary' : 'secondary'} style={{ flex: 1, minWidth: '46%', minHeight: 44 }} onClick={() => setBf(k)}>
            {label}
          </button>
        ))}
      </div>
      <button id="ctMissBtn" type="button" className="secondary" style={{ marginBottom: 10, width: '100%', minHeight: 46 }} onClick={() => open({ kind: 'missing' })}>
        📦 البضاعة الفاضلة للعملاء
      </button>
      <div className="toolbar">
        <input
          id="ctQ"
          className="search"
          placeholder={isC ? 'ابحث عن عميل بالاسم أو التليفون...' : 'ابحث عن مورد بالاسم أو التليفون...'}
          value={q[mode] ?? ''}
          onChange={(e) => setQ({ ...q, [mode]: e.target.value })}
        />
      </div>
      <div id="ctSum" className="card" style={{ marginBottom: 10, lineHeight: 1.9 }}>
        <b>{L.length}</b> {isC ? 'عميل' : 'مورد'} — {isC ? 'عليهم' : 'علينا ليهم'}: <b style={{ color: 'var(--danger)' }}>{money(pos)}</b>
        {neg ? (
          <>
            {' '}
            — {isC ? 'ليهم رصيد عندنا' : 'لينا رصيد عندهم'}: <b>{money(-neg)}</b>
          </>
        ) : null}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th style={{ display: 'none' }}>النوع</th>
                <th>الهاتف</th>
                <th>{isC ? 'الحساب (عليه)' : 'الحساب (علينا)'}</th>
                <th>العنوان</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              <TableState cols={5} loading={list.isPending} error={list.isError ? errorMessage(list.error) : null} empty={!rows.length} onRetry={() => list.refetch()}>
                {rows.map((c) => (
                  <tr key={c.id} className="prow" onClick={() => open({ kind: 'contactFile', id: c.id })}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td style={{ display: 'none' }}>
                      <span className={`badge ${c.type === 'CUSTOMER' ? 'green' : ''}`}>{c.type === 'CUSTOMER' ? 'عميل' : 'مورد'}</span>
                    </td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>
                      {c.phone || '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: balanceColor(c.balance) }}>{balanceText(c)}</td>
                    <td>{c.address || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="secondary" onClick={() => open({ kind: 'contactFile', id: c.id })}>
                        📄 كشف حساب
                      </button>{' '}
                      <button type="button" className="secondary" onClick={() => open({ kind: 'payment', contactId: c.id })}>
                        {c.type === 'CUSTOMER' ? 'تحصيل' : 'سداد'}
                      </button>{' '}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => open({ kind: 'transaction', type: c.type === 'CUSTOMER' ? 'SALE' : 'PURCHASE', person: c.name, contactId: c.id })}
                      >
                        {c.type === 'CUSTOMER' ? '🧾 فاتورة بيع' : '🧾 فاتورة شراء'}
                      </button>
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
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
