'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import { ErrorBox, Loading } from './ui/states';
import { useToast } from './ui/toast';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PERIODS: [string, string, () => [string, string]][] = [
  ['month', 'الشهر ده', () => [todayYmd().slice(0, 8) + '01', todayYmd()]],
  ['3m', 'آخر 3 شهور', () => [ymd(new Date(Date.now() - 90 * 864e5)), todayYmd()]],
  ['year', 'السنة دي', () => [todayYmd().slice(0, 5) + '01-01', todayYmd()]],
  ['all', 'من الأول', () => ['', '']],
];

interface Analysis {
  sale: { count: number; total: number; salesTotal: number; ratePct: number };
  purchase: { count: number; total: number };
  products: { productId: string; name: string; qty: number; total: number; count: number; soldQty: number; ratePct: number; kind: 'SALE' | 'PURCHASE' }[];
  people: { name: string; kind: 'SALE' | 'PURCHASE'; count: number; total: number }[];
  reasons: { note: string; count: number }[];
}

/** «↩️ تحليل المرتجعات»: إيه الأصناف اللي بترجع أكتر وليه، وأنهي مورد بضاعته بترجع. */
export function ReturnsAnalysisCard() {
  const [p, setP] = useState('3m');
  const [range, setRange] = useState<[string, string]>(PERIODS[1]![2]());
  const q = useQuery({
    queryKey: ['reports', 'returns-analysis', range],
    queryFn: ({ signal }) => api.get<{ report: Analysis }>('/reports/returns-analysis', { ...(range[0] ? { from: range[0] } : {}), ...(range[1] ? { to: range[1] } : {}) }, signal).then((r) => r.report),
  });
  const r = q.data;
  const kindLabel = (k: string) => (k === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء');
  return (
    <div className="card" style={{ marginTop: 14 }} id="returnsAnalysis">
      <h3>↩️ تحليل المرتجعات</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PERIODS.map(([k, l, f]) => (
          <button key={k} type="button" className={p === k ? 'primary' : 'secondary'} style={{ padding: '8px 12px', borderRadius: 99 }} onClick={() => (setP(k), setRange(f()))}>
            {l}
          </button>
        ))}
      </div>
      {q.isPending && <Loading />}
      {q.isError && <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {r && !r.sale.count && !r.purchase.count && <div className="empty">مفيش مرتجعات في الفترة دي.</div>}
      {r && (r.sale.count > 0 || r.purchase.count > 0) && (
        <>
          <div className="stats">
            <div className="stat">
              <small>مرتجعات بيع</small>
              <strong>
                {r.sale.count} — {money(r.sale.total)}
              </strong>
            </div>
            <div className="stat">
              <small>نسبتها من المبيعات</small>
              <strong style={{ color: r.sale.ratePct >= 5 ? 'var(--danger)' : undefined }}>{r.sale.ratePct}%</strong>
            </div>
            <div className="stat">
              <small>مرتجعات شراء (للموردين)</small>
              <strong>
                {r.purchase.count} — {money(r.purchase.total)}
              </strong>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>النوع</th>
                  <th>رجع كام</th>
                  <th>قيمته</th>
                  <th>نسبته من اللي اتباع</th>
                </tr>
              </thead>
              <tbody>
                {r.products.map((x) => (
                  <tr key={x.kind + x.productId}>
                    <td>
                      <b>{x.name}</b>
                    </td>
                    <td>{kindLabel(x.kind)}</td>
                    <td>
                      {x.qty} ({x.count} مرة)
                    </td>
                    <td>{money(x.total)}</td>
                    <td style={{ color: x.ratePct >= 10 ? 'var(--danger)' : undefined }}>{x.kind === 'SALE' ? `${x.ratePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.people.length > 0 && (
            <p style={{ lineHeight: 1.9 }}>
              <b>أكتر ناس مرتجعات:</b> {r.people.slice(0, 6).map((x) => `${x.name} (${kindLabel(x.kind)}: ${x.count} — ${money(x.total)})`).join('، ')}
            </p>
          )}
          {r.reasons.length > 0 && (
            <p style={{ lineHeight: 1.9 }}>
              <b>الأسباب المكتوبة:</b> {r.reasons.map((x) => `${x.note} (${x.count})`).join('، ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
interface XlsxLib {
  utils: { book_new: () => unknown; aoa_to_sheet: (r: unknown[][]) => Record<string, unknown>; book_append_sheet: (b: unknown, s: unknown, n: string) => void };
  writeFile: (b: unknown, name: string) => void;
}
const loadXlsx = () =>
  new Promise<XlsxLib>((ok, bad) => {
    const w = window as unknown as { XLSX?: XlsxLib };
    if (w.XLSX) return ok(w.XLSX);
    const s = document.createElement('script');
    s.src = XLSX_SRC;
    s.onload = () => (w.XLSX ? ok(w.XLSX) : bad(new Error('مكتبة الإكسيل مااتحملتش')));
    s.onerror = () => bad(new Error('مكتبة الإكسيل مااتحملتش — اتأكد من النت'));
    document.head.appendChild(s);
  });

/** «📤 تصدير للمحاسب»: شهر كامل في ملف إكسيل واحد (ملخص، مبيعات، مشتريات، مصروفات، دفعات، مرتجعات، أرصدة). */
export function AccountantExportCard() {
  const toast = useToast();
  const prev = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return ymd(d).slice(0, 7);
  })();
  const [month, setMonth] = useState(prev);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const [{ sheets }, X] = await Promise.all([api.get<{ sheets: { name: string; rows: (string | number)[][] }[] }>('/reports/accountant', { month }), loadXlsx()]);
      const wb = X.utils.book_new();
      for (const s of sheets) {
        const ws = X.utils.aoa_to_sheet(s.rows);
        ws['!cols'] = (s.rows[0] ?? []).map((_, i) => ({ wch: Math.min(40, Math.max(10, ...s.rows.map((r) => String(r[i] ?? '').length + 2))) }));
        X.utils.book_append_sheet(wb, ws, s.name);
      }
      X.writeFile(wb, `ميكانيزم-${month}.xlsx`);
      toast('اتنزل ملف الإكسيل');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ marginTop: 14 }} id="accountantExport">
      <h3>📤 تصدير للمحاسب</h3>
      <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>شهر كامل في ملف إكسيل واحد: ملخص، مبيعات، مشتريات، مصروفات، دفعات، مرتجعات، وأرصدة العملاء والموردين.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <input type="month" value={month} max={todayYmd().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" className="primary" disabled={busy || !month} onClick={() => void go()}>
          {busy ? '⏳ بيجهّز…' : '📥 نزّل الملف'}
        </button>
      </div>
    </div>
  );
}
