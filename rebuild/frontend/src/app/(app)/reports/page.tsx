'use client';

import { useEffect, useMemo, useState } from 'react';
import { REPORTS, type ReportCell, type ReportColType, type ReportId, type ReportResult, type ReportRow, type ReportTone } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { ContactReportCard, ReportsStatsRow, StockStatusCard } from '@/components/reports-extras';
import { OnlineReportCard } from '@/components/online-report';
import { AccountantExportCard, ReturnsAnalysisCard } from '@/components/pro-reports';
import { useModal } from '@/components/modals/modal-host';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import { printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useOverview, useReport, useReportHeadline, useReportPeriods } from '@/lib/trade-queries';

/** Same period chips as the old reports center. */
const PRE = [
  ['day', 'النهاردة'],
  ['yday', 'امبارح'],
  ['week', 'الأسبوع'],
  ['month', 'الشهر'],
  ['pmonth', 'الشهر اللي فات'],
  ['q3', '٣ شهور'],
  ['year', 'السنة'],
  ['all', 'الكل'],
  ['cus', 'فترة مخصصة'],
] as const;
type Pre = (typeof PRE)[number][0];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (day: string) => new Date(`${day}T00:00:00Z`);

function rangeOf(p: Pre, custom: { from?: string; to?: string }): { from?: string; to?: string } {
  const t = todayYmd();
  const n = utc(t);
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  switch (p) {
    case 'day':
      return { from: t, to: t };
    case 'yday': {
      const a = ymd(new Date(n.getTime() - 86_400_000));
      return { from: a, to: a };
    }
    case 'week':
      return { from: ymd(new Date(n.getTime() - ((n.getUTCDay() + 1) % 7) * 86_400_000)), to: t };
    case 'month':
      return { from: `${t.slice(0, 8)}01`, to: t };
    case 'pmonth':
      return { from: ymd(new Date(Date.UTC(y, m - 1, 1))), to: ymd(new Date(Date.UTC(y, m, 0))) };
    case 'q3':
      return { from: ymd(new Date(Date.UTC(y, m - 2, 1))), to: t };
    case 'year':
      return { from: `${y}-01-01`, to: t };
    case 'all':
      return {};
    case 'cus':
      return custom;
  }
}

const kl = (day: string) => utc(day).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const rngTxt = (p: Pre, r: { from?: string; to?: string }) =>
  p === 'all' || (!r.from && !r.to) ? 'كل الفترات' : r.from === r.to ? kl(r.from!) : `من ${kl(r.from || '2000-01-01')} إلى ${kl(r.to || todayYmd())}`;

const fm = (v: ReportCell, t: ReportColType): string =>
  t === 'm'
    ? money(Number(v))
    : t === 'p'
      ? `${(Math.round(Number(v) * 10) / 10).toLocaleString('ar-EG')}٪`
      : t === 'n'
        ? (Math.round(Number(v) * 100) / 100).toLocaleString('ar-EG')
        : t === 'd'
          ? v
            ? kl(String(v))
            : '—'
          : String(v);
const bc: Record<string, string> = { g: 'var(--green,#159447)', r: 'var(--danger,#c0392b)', y: '#b7791f' };
const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

function Chips({ pre, setPre, custom, setCustom, range }: { pre: Pre; setPre: (p: Pre) => void; custom: { from?: string; to?: string }; setCustom: (c: { from?: string; to?: string }) => void; range: { from?: string; to?: string } }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 8px' }}>
        {PRE.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (k === 'cus') setCustom(range);
              setPre(k);
            }}
            style={{
              flex: 'none',
              padding: '10px 16px',
              borderRadius: 99,
              border: `1.5px solid ${pre === k ? 'var(--blue)' : 'var(--border)'}`,
              background: pre === k ? 'var(--blue)' : 'var(--card)',
              color: pre === k ? 'var(--onblue)' : 'inherit',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {pre === 'cus' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {(['from', 'to'] as const).map((k) => (
            <input
              key={k}
              type="date"
              value={custom[k] ?? ''}
              onChange={(e) => setCustom({ ...custom, [k]: e.target.value || undefined })}
              style={{ flex: 1, padding: 12, border: '1.5px solid var(--border)', borderRadius: 12, minWidth: 0 }}
            />
          ))}
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{rngTxt(pre, range)}</div>
    </>
  );
}

function SumBoxes({ sum }: { sum: ReportResult['sum'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' }}>
      {sum.map((s) => (
        <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.l}</div>
          <div style={{ fontSize: 17, fontWeight: 800, ...(s.c ? { color: bc[s.c] } : {}) }}>{fm(s.v, s.t)}</div>
        </div>
      ))}
    </div>
  );
}

function Chart({ ch }: { ch?: [string, number][] }) {
  if (!ch?.length) return null;
  const mx = Math.max(1, ...ch.map((x) => Math.abs(x[1])));
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', margin: '8px 0', maxHeight: 300, overflow: 'auto' }}>
      {ch.map(([l, v], i) => (
        <div key={`${l}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0', fontSize: 13 }}>
          <span style={{ flex: '0 0 78px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>
          <span style={{ flex: 1, background: 'var(--tint2)', borderRadius: 6, height: 16, overflow: 'hidden' }}>
            <i style={{ display: 'block', height: '100%', width: `${Math.max(2, (Math.abs(v) / mx) * 100)}%`, background: v < 0 ? 'var(--danger)' : 'var(--blue)' }} />
          </span>
          <b style={{ flex: '0 0 auto', fontSize: 12 }}>{money(v)}</b>
        </div>
      ))}
    </div>
  );
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** One report full screen, the old #mkRp overlay. */
function ReportView({ id, onBack, chips, range, rangeText }: { id: ReportId; onBack: () => void; chips: React.ReactNode; range: { from?: string; to?: string }; rangeText: string }) {
  const def = REPORTS.find((r) => r.id === id)!;
  const rep = useReport(id, range.from, range.to);
  const settings = useSettings().data;
  const toast = useToast();
  const { open } = useModal();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  useEffect(() => setSort(null), [range.from, range.to]);
  const d = rep.data;

  const rows = useMemo((): ReportRow[] => {
    if (!d) return [];
    let L = d.rows;
    const words = norm(q).split(' ').filter(Boolean);
    if (words.length) L = L.filter((r) => words.every((w) => norm(r.c.join(' ')).includes(w)));
    const s = sort ?? (d.dsort ? { i: d.dsort[0], dir: d.dsort[1] } : null);
    if (s && !d.nosort) {
      L = [...L].sort((a, b) => {
        const x = a.c[s.i]!;
        const y = b.c[s.i]!;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * s.dir;
      });
    }
    return L;
  }, [d, q, sort]);

  const plainRows = () => (d ? rows.map((r) => r.c.map((v, i) => fm(v, d.cols[i]!.t))) : []);

  const pdf = () => {
    if (!d || !settings) return;
    const body = plainRows();
    if (d.foot) body.push(d.foot.map((v, i) => (v === '' ? '' : fm(v, d.cols[i]!.t))));
    printHtml(
      reportHtml({ title: def.t, range: rangeText, sum: d.sum.map((s) => [s.l, fm(s.v, s.t)]), head: d.cols.map((c) => c.h), rows: body }, settings),
    );
  };
  const xls = () => {
    if (!d) return;
    const raw = rows.map((r) => r.c);
    const L = [[def.t], [rangeText], [], d.cols.map((c) => c.h), ...raw, ...(d.foot ? [d.foot] : [])];
    const blob = new Blob([`﻿${L.map((r) => r.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `تقرير-${def.t.replace(/\s+/g, '-')}-${todayYmd()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('اتنزل ملف Excel');
  };
  const wa = () => {
    if (!d) return;
    const p = plainRows();
    const t =
      `📊 ${def.t}\n${rangeText}\n\n` +
      d.sum.map((s) => `• ${s.l}: ${fm(s.v, s.t)}`).join('\n') +
      '\n\n' +
      p
        .slice(0, 12)
        .map((r, i) => `${i + 1}. ${r.slice(0, 3).join(' — ')}`)
        .join('\n') +
      (p.length > 12 ? `\n... و${p.length - 12} صف كمان` : '') +
      `\n\n${settings?.store.name || 'ميكانيزم'}`;
    if (navigator.share) navigator.share({ text: t }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
  };

  const go = (r: ReportRow) => {
    if (!r.go) return;
    if (r.go.kind === 'invoice') open({ kind: 'invoice', id: r.go.id });
    else open({ kind: 'contactFile', id: r.go.id });
  };
  const warnBg = (w?: ReportTone) => (w === 'r' ? 'rgba(192,57,43,.09)' : w === 'y' ? 'rgba(183,121,31,.09)' : undefined);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--bg)', color: 'var(--text)', overflowY: 'auto', direction: 'rtl' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '12px 14px 4px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button type="button" onClick={onBack} style={{ flex: 'none', padding: '12px 16px', borderRadius: 12, background: 'var(--card)', border: '1.5px solid var(--border)', fontWeight: 700 }}>
            → رجوع
          </button>
          <h2 style={{ margin: 0, fontSize: 19 }}>
            {def.i} {def.t}
          </h2>
        </div>
        {chips}
      </div>
      <div style={{ padding: '6px 14px 90px', maxWidth: 900, margin: '0 auto' }}>
        {rep.isPending ? (
          <Loading />
        ) : rep.isError ? (
          <ErrorBox message={errorMessage(rep.error)} onRetry={() => rep.refetch()} />
        ) : d ? (
          <>
            <SumBoxes sum={d.sum} />
            <Chart ch={d.chart} />
            {!d.nofilt && !d.nosort && (
              <input
                placeholder="🔍 ابحث جوه التقرير..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: '100%', padding: 14, border: '1.5px solid var(--border)', borderRadius: 12, margin: '8px 0', background: 'var(--card)', color: 'inherit', boxSizing: 'border-box' }}
              />
            )}
            {!d.nosort && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{rows.length} صف — اضغط على عنوان العمود للفرز</div>}
            <div style={{ overflow: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, maxHeight: '62vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(320, d.cols.length * 92), fontSize: 14 }}>
                <thead>
                  <tr>
                    {d.cols.map((c, i) => (
                      <th
                        key={c.h}
                        onClick={() => {
                          if (d.nosort) return;
                          setSort(sort && sort.i === i ? { i, dir: sort.dir === 1 ? -1 : 1 } : { i, dir: c.t === 's' ? 1 : -1 });
                        }}
                        style={{ position: 'sticky', top: 0, background: 'var(--blue)', color: 'var(--onblue)', padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 13, cursor: d.nosort ? 'default' : 'pointer' }}
                      >
                        {c.h}
                        {sort && sort.i === i ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((r, ri) => (
                      <tr key={ri} onClick={() => go(r)} style={{ borderBottom: '1px solid var(--border)', cursor: r.go ? 'pointer' : undefined, background: warnBg(r.warn) }}>
                        {r.c.map((v, i) => (
                          <td
                            key={i}
                            style={{
                              padding: '10px 8px',
                              whiteSpace: d.cols[i]!.t === 's' ? undefined : 'nowrap',
                              color: d.cols[i]!.t === 'm' && Number(v) < 0 ? 'var(--danger)' : undefined,
                            }}
                          >
                            {fm(v, d.cols[i]!.t)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={d.cols.length} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                        مفيش بيانات في الفترة دي.
                      </td>
                    </tr>
                  )}
                  {d.foot && !q && (
                    <tr style={{ fontWeight: 800, background: 'var(--tint2)' }}>
                      {d.foot.map((v, i) => (
                        <td key={i} style={{ padding: '10px 8px' }}>
                          {v === '' ? '' : fm(v, d.cols[i]!.t)}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              <button type="button" className="primary" onClick={pdf} style={{ padding: '15px 6px', borderRadius: 12, fontWeight: 700 }}>
                🖨️ طباعة / PDF
              </button>
              <button type="button" onClick={xls} style={{ padding: '15px 6px', borderRadius: 12, background: 'var(--card)', border: '1.5px solid var(--border)', fontWeight: 700 }}>
                📊 Excel
              </button>
              <button type="button" onClick={wa} style={{ padding: '15px 6px', borderRadius: 12, background: 'var(--card)', border: '1.5px solid var(--border)', fontWeight: 700 }}>
                📲 واتساب
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const PERIOD_ROWS: [string, 'sales' | 'purch' | 'ret' | 'exp' | 'gross' | 'net'][] = [
  ['المبيعات (صافي بعد المرتجع)', 'sales'],
  ['المشتريات (صافي بعد المرتجع)', 'purch'],
  ['المرتجعات', 'ret'],
  ['المصروفات', 'exp'],
  ['إجمالي الربح', 'gross'],
  ['صافي الربح', 'net'],
];

function ReportsScreen() {
  const [pre, setPre] = useState<Pre>('month');
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [cur, setCur] = useState<ReportId | null>(null);
  const range = rangeOf(pre, custom);
  const headline = useReportHeadline(range.from, range.to);
  const periods = useReportPeriods();
  const overview = useOverview();
  const o = overview.data;
  const P = periods.data;
  const settings = useSettings().data;
  /** 🖨️ طباعة التقرير: الأرقام الكبيرة + جدول الفترات (printReports القديمة). */
  const printGeneral = () => {
    if (!P || !o || !settings) return;
    const rows: [string, keyof typeof P.day][] = [
      ['المبيعات (صافي بعد المرتجع)', 'sales'],
      ['المشتريات (صافي بعد المرتجع)', 'purch'],
      ['المرتجعات', 'ret'],
      ['المصروفات', 'exp'],
      ['إجمالي الربح', 'gross'],
      ['صافي الربح', 'net'],
    ];
    printHtml(
      reportHtml(
        {
          title: 'التقرير العام',
          range: '',
          sum: [
            ['صافي الربح (الإجمالي)', money(P.all.net)],
            ['رصيد الخزنة', money(o.cashBalance)],
            ['قيمة المخزون', money(o.stockValue)],
            ['مستحقات عند العملاء', money(o.receivables)],
            ['إجمالي المبيعات', money(o.salesTotal)],
            ['إجمالي المشتريات', money(o.purchasesTotal)],
            ['إجمالي المصروفات', money(o.expensesTotal)],
            ['إجمالي الربح', money(P.all.gross)],
          ],
          head: ['البند', 'اليوم', 'الشهر', 'السنة', 'الإجمالي'],
          rows: rows.map(([t, k]) => [t, money(P.day[k]), money(P.month[k]), money(P.year[k]), money(P.all[k])]),
        },
        settings,
      ),
    );
  };
  const groups = [...new Set(REPORTS.map((r) => r.g))];
  const chips = <Chips pre={pre} setPre={setPre} custom={custom} setCustom={setCustom} range={range} />;
  const h = headline.data;

  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>التقارير</h1>
          <p>ملخص اليوم والشهر والسنة وإجمالي الأرباح</p>
        </div>
        <button type="button" className="secondary" disabled={!P || !o || !settings} onClick={printGeneral}>
          🖨️ طباعة التقرير
        </button>
      </div>
      <OnlineReportCard />
      <ReturnsAnalysisCard />
      <AccountantExportCard />
      <div className="card" style={{ marginBottom: 14, marginTop: 14 }}>
        <h3 style={{ margin: '0 0 6px' }}>📊 مركز التقارير</h3>
        {chips}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '6px 0 12px' }}>
          {(
            [
              ['صافي المبيعات', h?.net],
              ['مجمل الربح', h?.gross],
              ['صافي الربح', h?.np],
            ] as [string, number | undefined][]
          ).map(([l, v]) => (
            <div key={l} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>{l}</small>
              <div style={{ fontWeight: 800, fontSize: 14, ...((v ?? 0) < 0 ? { color: 'var(--danger)' } : {}) }}>{v === undefined ? '…' : money(v)}</div>
            </div>
          ))}
        </div>
        {groups.map((g) => (
          <div key={g}>
            <h4 style={{ margin: '14px 0 8px' }}>{g}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {REPORTS.filter((x) => x.g === g).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setCur(x.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 3,
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    background: 'var(--card)',
                    color: 'inherit',
                    textAlign: 'right',
                    minHeight: 92,
                  }}
                >
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{x.i}</span>
                  <b style={{ fontSize: 14 }}>{x.t}</b>
                  <small style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.4 }}>{x.d}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="stats">
        <div className="stat">
          <small>صافي الربح (الإجمالي)</small>
          <strong>{P ? money(P.all.net) : '…'}</strong>
        </div>
        <div className="stat">
          <small>رصيد الخزنة</small>
          <strong>{o ? money(o.cashBalance) : '…'}</strong>
        </div>
        <div className="stat">
          <small>قيمة المخزون</small>
          <strong>{o ? money(o.stockValue) : '…'}</strong>
        </div>
        <div className="stat">
          <small>مستحقات عند العملاء</small>
          <strong>{o ? money(o.receivables) : '…'}</strong>
        </div>
      </div>
      <ReportsStatsRow />
      <div className="card" style={{ marginTop: 14 }}>
        <h3>تقرير الفترات</h3>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th>البند</th>
                <th>اليوم</th>
                <th>الشهر</th>
                <th>السنة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {P &&
                PERIOD_ROWS.map(([t, k]) => {
                  const strong = k === 'net' || k === 'gross';
                  return (
                    <tr key={k} style={strong ? { fontWeight: 800, background: 'var(--tint2)' } : undefined}>
                      <td>{t}</td>
                      {(['day', 'month', 'year', 'all'] as const).map((c) => (
                        <td key={c} style={strong ? { color: P[c][k] < 0 ? 'var(--danger)' : 'var(--green)' } : undefined}>
                          {money(P[c][k])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      <ContactReportCard />
      <div className="stats" style={{ marginTop: 14 }}>
        <div className="stat">
          <small>إجمالي المبيعات</small>
          <strong>{o ? money(o.salesTotal) : '…'}</strong>
        </div>
        <div className="stat">
          <small>إجمالي المشتريات</small>
          <strong>{o ? money(o.purchasesTotal) : '…'}</strong>
        </div>
        <div className="stat">
          <small>إجمالي المصروفات</small>
          <strong>{o ? money(o.expensesTotal) : '…'}</strong>
        </div>
        <div className="stat">
          <small>إجمالي الربح</small>
          <strong>{P ? money(P.all.gross) : '…'}</strong>
        </div>
      </div>

      <StockStatusCard />

      {cur && <ReportView id={cur} onBack={() => setCur(null)} chips={chips} range={range} rangeText={rngTxt(pre, range)} />}
    </>
  );
}

export default function ReportsPage() {
  return (
    <AdminOnly>
      <ReportsScreen />
    </AdminOnly>
  );
}
