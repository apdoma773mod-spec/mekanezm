'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { DashboardBanners, DashboardCharts } from '@/components/dashboard-extras';
import { Icon } from '@/components/icon';
import { useModal } from '@/components/modals/modal-host';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useIsAdmin } from '@/components/use-role';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useInvoices, useOverview, useToday } from '@/lib/trade-queries';

function RecentOps() {
  const { open } = useModal();
  const sales = useInvoices({ kind: 'SALE', pageSize: 8 });
  const purchases = useInvoices({ kind: 'PURCHASE', pageSize: 8 });
  if (sales.isPending || purchases.isPending) return <Loading />;
  if (sales.isError) return <ErrorBox message={errorMessage(sales.error)} onRetry={() => sales.refetch()} />;
  const all = [...(sales.data?.items ?? []), ...(purchases.data?.items ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  if (!all.length) return <div className="empty">لسه مفيش عمليات مسجلة.</div>;
  return (
    <div className="table-wrap">
      <table className="table" style={{ minWidth: 360 }}>
        <thead>
          <tr>
            <th>النوع</th>
            <th>البيان</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {all.map((x) => (
            <tr key={x.id} className="prow" onClick={() => open({ kind: 'invoice', id: x.id })}>
              <td>
                <span className={`badge ${x.kind === 'SALE' ? 'green' : ''}`}>{x.kind === 'SALE' ? 'بيع' : 'شراء'}</span>
              </td>
              <td>
                {x.no} — {x.person || (x.kind === 'SALE' ? 'عميل نقدي' : '—')}
                {x.itemCount > 1 && <span className="badge"> {x.itemCount} صنف</span>}
              </td>
              <td>{money(x.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { open } = useModal();
  const admin = useIsAdmin();
  const overview = useOverview();
  const today = useToday();
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        subtitle="إدارة مخزون ميكانيزم من مكان واحد"
        action={
          <button type="button" className="primary" onClick={() => open({ kind: 'quick' })}>
            <Icon name="plus" /> إضافة عملية
          </button>
        }
      />
      {admin && <DashboardBanners />}
      {overview.isError ? (
        <ErrorBox message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
      ) : (
        <div className="stats">
          <div className="stat">
            <div className="ic">
              <Icon name="box" />
            </div>
            <small>عدد المنتجات</small>
            <strong>{o ? o.productsCount.toLocaleString('ar-EG') : '…'}</strong>
          </div>
          <div className="stat">
            <div className="ic">
              <Icon name="wallet" />
            </div>
            <small>قيمة المخزون</small>
            <strong>{o ? (o.stockValue !== undefined ? money(o.stockValue) : '—') : '…'}</strong>
          </div>
          <div className="stat">
            <div className="ic">
              <Icon name="up" />
            </div>
            <small>إجمالي المبيعات</small>
            <strong>{o ? money(o.salesTotal) : '…'}</strong>
          </div>
          <div className="stat">
            <div className="ic">
              <Icon name="down" />
            </div>
            <small>إجمالي المشتريات</small>
            <strong>{o ? money(o.purchasesTotal) : '…'}</strong>
          </div>
        </div>
      )}

      {today.data && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>النهاردة</h3>
          <div className="cstats" style={{ margin: 0 }}>
            <div>
              <small>مبيعات ({today.data.sales.count.toLocaleString('ar-EG')} فاتورة)</small>
              <b>{money(today.data.sales.total)}</b>
            </div>
            <div>
              <small>الخزنة النهاردة</small>
              <b>{money(today.data.cashNet)}</b>
            </div>
            <div>
              <small>مصروفات</small>
              <b>{money(today.data.expenses)}</b>
            </div>
            {today.data.profit !== undefined && (
              <div>
                <small>ربح المبيعات</small>
                <b>{money(today.data.profit)}</b>
              </div>
            )}
            <div>
              <small>مستحقات عند العملاء</small>
              <b>{money(today.data.receivables)}</b>
            </div>
            {admin && (
              <Link href="/products?stock=low" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: 'var(--tint2)', borderRadius: 12, padding: 10 }}>
                  <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>أصناف تحت حد التنبيه</small>
                  <b style={{ color: today.data.lowStockCount ? 'var(--danger)' : 'inherit' }}>
                    {today.data.lowStockCount.toLocaleString('ar-EG')}
                  </b>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>آخر العمليات</h3>
          <RecentOps />
        </div>
        <div className="card">
          <h3>اختصارات</h3>
          <Link
            href="/daybook"
            style={{
              width: '100%',
              marginBottom: 14,
              background: 'var(--blue)',
              color: 'var(--onblue)',
              borderRadius: 16,
              padding: 16,
              fontSize: 18,
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            📒 يومية المحل — اكتب بيعة بسرعة <span>←</span>
          </Link>
          <div className="quick">
            {admin && (
              <button type="button" onClick={() => open({ kind: 'product' })}>
                <b>
                  <Icon name="plus" /> منتج جديد
                </b>
                <small>إضافة صنف للمخزون</small>
              </button>
            )}
            <button type="button" onClick={() => open({ kind: 'transaction', type: 'SALE' })}>
              <b>
                <Icon name="up" /> فاتورة بيع
              </b>
              <small>تسجيل مبيعات</small>
            </button>
            <button type="button" onClick={() => open({ kind: 'transaction', type: 'PURCHASE' })}>
              <b>
                <Icon name="down" /> فاتورة شراء
              </b>
              <small>تسجيل مشتريات</small>
            </button>
            {admin && (
              <button type="button" onClick={() => open({ kind: 'return', type: 'SALE' })}>
                <b>
                  <Icon name="return" /> مرتجع
                </b>
                <small>بيع أو شراء</small>
              </button>
            )}
          </div>
          <button
            type="button"
            className="secondary"
            style={{ width: '100%', marginTop: 14, padding: 16, fontSize: 17, fontWeight: 800 }}
            onClick={() => open({ kind: 'closing' })}
          >
            🔒 تقفيل اليومية
          </button>
        </div>
      </div>
      {admin && <DashboardCharts />}
    </>
  );
}
