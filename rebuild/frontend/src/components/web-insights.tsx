'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Insights {
  visits: { shop: number; custom: number; story: number; days: { day: string; shop: number; custom: number }[] };
  orders: { count: number; done: number; custom: number; requests: number; byDay: Record<string, number> };
  top: { code: string; name: string; qty: number; orders: number }[];
  waiting: { pname: string; n: number }[];
  pendingReviews: number;
}

/** 📊 أداء الموقع: آخر ٣٠ يوم — زيارات وطلبات وأكتر الأصناف طلباً وإيه اللي العملاء مستنينه. */
export function WebInsights() {
  const q = useQuery({ queryKey: ['web', 'insights'], queryFn: ({ signal }) => api.get<Insights>('/web/insights', undefined, signal), staleTime: 60_000 });
  const d = q.data;
  if (!d) return null;
  const last = d.visits.days.slice(-14);
  const max = Math.max(1, ...last.map((x) => x.shop));
  const rate = d.visits.shop ? Math.round((d.orders.count / d.visits.shop) * 1000) / 10 : 0;
  const box = (label: string, v: string | number, hint?: string) => (
    <div style={{ flex: '1 1 110px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <b style={{ fontSize: 22 }}>{v}</b>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{hint}</div>}
    </div>
  );
  return (
    <details className="card" style={{ marginBottom: 14 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
        📊 أداء الموقع (آخر ٣٠ يوم) — {d.orders.count} طلب{d.pendingReviews ? ` · ${d.pendingReviews} رأي مستني موافقتك` : ''}
      </summary>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {box('زيارات المتجر', d.visits.shop, 'من أول ما اتفعّل العدّاد')}
        {box('طلبات', d.orders.count, `${d.orders.done} اتحوّلوا لفواتير`)}
        {box('نسبة الطلب للزيارة', rate + '٪', 'تقريبية')}
        {box('تجهيز بالمقاس', d.orders.custom)}
        {box('طلبات بالصور', d.orders.requests)}
      </div>
      {last.length > 0 && (
        <>
          <b style={{ fontSize: 13 }}>الزيارات يوم بيوم</b>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, margin: '6px 0 12px' }}>
            {last.map((x) => (
              <div key={x.day} title={`${x.day}: ${x.shop} زيارة، ${d.orders.byDay[x.day] ?? 0} طلب`} style={{ flex: 1, background: d.orders.byDay[x.day] ? '#087f8c' : '#9fc9cd', height: Math.max(3, (x.shop / max) * 56), borderRadius: 3 }} />
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <b style={{ fontSize: 13 }}>🔥 أكتر الأصناف طلباً</b>
          {d.top.length ? d.top.map((t) => (
            <div key={t.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>{t.name}</span>
              <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.orders} طلب · {t.qty} قطعة</span>
            </div>
          )) : <div className="empty">لسه مفيش طلبات</div>}
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <b style={{ fontSize: 13 }}>⏳ العملاء مستنيين يتوفر</b>
          {d.waiting.length ? d.waiting.map((t) => (
            <div key={t.pname} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>{t.pname}</span>
              <span style={{ color: 'var(--muted)' }}>{t.n} عميل</span>
            </div>
          )) : <div className="empty">مفيش حد مستني حاجة</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>أول ما الصنف يتوفر في المخزن بيوصلهم واتساب لوحده.</div>
        </div>
      </div>
    </details>
  );
}
