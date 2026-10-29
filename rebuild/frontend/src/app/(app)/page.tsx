'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/app-shell';
import { MarketBanner } from '@/components/modals/market-prices';
import { PriceLookupCard } from '@/components/price-lookup';
import { useCompany } from '@/components/company';
import { useInboxCounts } from '@/lib/inbox-queries';
import { CO_NAME } from '@mk/shared';
import { Launch, proOn, ProIll } from '@/components/pro';
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
  const router = useRouter();
  const t = today.data;
  const { co } = useCompany();
  const counts = useInboxCounts(admin);
  const [pro, setPro] = useState(false);
  useEffect(() => setPro(proOn()), []);
  /** «برو» swaps the action icons for its 3D drawings, as the old paint() did. */
  const actIc = (k: string, plain: ReactNode) => (pro ? <span className="ic mkx"><ProIll k={k} /></span> : <span className="ic">{plain}</span>);
  const todayTile = (ic: string, l: string, v: string, go: () => void, col?: string) => (
    <button
      type="button"
      onClick={go}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: 10, border: '1px solid var(--border,#e5e7ef)', borderRadius: 14, background: 'var(--card,#fff)', textAlign: 'right', minHeight: 84, minWidth: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{ic}</span>
      <small style={{ color: 'var(--muted)', fontSize: 11 }}>{l}</small>
      <b style={{ fontSize: 14, ...(col ? { color: col } : {}) }}>{v}</b>
    </button>
  );

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
      <MarketBanner />
      {/* 📅 ملخص النهاردة في أول لوحة التحكم (old mkToday), then the «برو» launcher tiles */}
      <div id="mkToday">
        {admin && !!counts.data?.sms && (
          <button id="mkSmsTile" type="button" className="secondary" style={{ width: '100%', marginBottom: 10, padding: 12, fontWeight: 800 }} onClick={() => router.push('/vodafone')}>
            📲 فيه {counts.data.sms} مبلغ فودافون كاش مستني تسجيله
          </button>
        )}
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 10px' }}>📅 النهاردة — {CO_NAME[co]}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {todayTile('💰', 'مبيعات النهاردة', t ? money(t.sales.total) : '…', () => open({ kind: 'todayDetail', k: 'sales' }))}
            {todayTile('🧾', 'فواتير النهاردة', t ? String(t.sales.count) : '…', () => open({ kind: 'todayDetail', k: 'inv' }))}
            {todayTile('📥', 'اتحصّل النهاردة', t ? money(t.sales.paid) : '…', () => open({ kind: 'todayDetail', k: 'coll' }), 'var(--green)')}
            {todayTile('📤', 'مصروفات النهاردة', t ? money(t.expenses) : '…', () => open({ kind: 'todayDetail', k: 'exp' }), t?.expenses ? 'var(--danger)' : '')}
            {todayTile('⚠️', 'أصناف قربت تخلص', t ? String(t.lowStockCount) : '…', () => open({ kind: 'todayDetail', k: 'low' }), t?.lowStockCount ? 'var(--danger)' : '')}
            {todayTile('👥', 'فلوس عند العملاء', t ? money(t.receivables) : '…', () => router.push(admin ? '/debts' : '/contacts'))}
          </div>
        </div>
      </div>
      <Launch />
      {admin && <DashboardBanners />}
      {overview.isError && <ErrorBox message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />}
      {!pro && <Link
        href="/daybook"
        style={{
          width: '100%',
          marginBottom: 14,
          background: 'var(--blue)',
          color: '#fff',
          border: 0,
          borderRadius: 16,
          padding: 16,
          fontSize: 18,
          fontWeight: 800,
          textAlign: 'right',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        📒 يومية المحل — اكتب بيعة بسرعة <span>←</span>
      </Link>}
      <div className="dash-acts">
        <button type="button" className="pri" onClick={() => open({ kind: 'transaction', type: 'SALE' })}>
          {actIc('saleNew', <Icon name="up" />)}فاتورة بيع<small>تسجيل بيع جديد</small>
        </button>
        <button type="button" className="pri" onClick={() => open({ kind: 'transaction', type: 'PURCHASE' })}>
          {actIc('purchaseNew', <Icon name="down" />)}فاتورة شراء<small>تسجيل مشتريات</small>
        </button>
        {admin && (
          <button type="button" className="own" onClick={() => open({ kind: 'product' })}>
            {actIc('productNew', <Icon name="box" />)}إضافة منتج<small>صنف جديد للمخزون</small>
          </button>
        )}
        <button type="button" onClick={() => open({ kind: 'quote' })}>
          {actIc('quotes', '📝')}عرض سعر<small>من غير ما يخصم من المخزون</small>
        </button>
        <button type="button" onClick={() => router.push('/sales')}>
          {actIc('sales', <Icon name="file" />)}فواتير البيع<small>كل فواتير البيع والبحث</small>
        </button>
        <button type="button" onClick={() => router.push('/purchases')}>
          {actIc('purchases', <Icon name="down" />)}فواتير الشراء<small>كل فواتير الشراء والبحث</small>
        </button>
      </div>
      <button
        type="button"
        className="secondary"
        style={{ width: '100%', marginTop: 14, padding: 16, fontSize: 17, fontWeight: 800 }}
        onClick={() => open({ kind: 'closing' })}
      >
        🔒 تقفيل اليومية
      </button>
      {admin && <PriceLookupCard />}

      <div className="grid2">
        <div className="card">
          <h3>آخر العمليات</h3>
          <RecentOps />
        </div>
        <div className="card">
          <h3>اختصارات</h3>
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
            {admin && (
              <button type="button" onClick={() => router.push('/reports')}>
                <b>
                  <Icon name="chart" /> التقارير
                </b>
                <small>أرباح ومبيعات</small>
              </button>
            )}
          </div>
        </div>
      </div>
      {admin && <DashboardCharts />}
    </>
  );
}
