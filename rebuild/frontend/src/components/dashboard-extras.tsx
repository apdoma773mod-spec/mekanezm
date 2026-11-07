'use client';

import Link from 'next/link';
import { useState } from 'react';
import { money } from '@/lib/format';
import { useCharts, useDebts, useReorderCount } from '@/lib/trade-queries';
import { useWebCounts } from '@/lib/web-queries';
import { usePortalNewCount } from '@/lib/portal-queries';
import { useModal } from '@/components/modals/modal-host';
import { ScanBanner } from '@/components/modals/invoice-photo';
import { useRouter } from 'next/navigation';

const num = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 1 });

/** The old svgBars(): vertical bars, newest on the left as in RTL, red for a loss. */
function Bars({ items, color = 'var(--blue)', lblEvery = 1 }: { items: { l: string; t?: string; v: number }[]; color?: string; lblEvery?: number }) {
  const W = 640;
  const h = 170;
  const pl = 8;
  const pr = 8;
  const pt = 14;
  const pb = 26;
  const n = items.length || 1;
  const bw = (W - pl - pr) / n;
  const mx = Math.max(1, ...items.map((i) => i.v));
  const mn = Math.min(0, ...items.map((i) => i.v));
  const span = mx - mn || 1;
  const y = (v: number) => pt + (h - pt - pb) * (1 - (v - mn) / span);
  const z = y(0);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={z} y2={z} stroke="#d5dde0" />
      {items.map((it, i) => {
        const x = W - pr - (i + 1) * bw + bw * 0.15;
        const w = bw * 0.7;
        const top = y(Math.max(it.v, 0));
        const bot = y(Math.min(it.v, 0));
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={Math.max(it.v ? 1.5 : 0, bot - top)} rx={3} fill={it.v < 0 ? '#c0392b' : color}>
              <title>
                {it.t || it.l}: {money(it.v)}
              </title>
            </rect>
            {i % lblEvery === 0 && (
              <text x={x + w / 2} y={h - 8} textAnchor="middle" fontSize={11} fill="#718087">
                {it.l}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HBars({ rows }: { rows: { n: string; v: number }[] }) {
  const mx = Math.max(1, ...rows.map((r) => r.v));
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} className="hb">
          <span className="nmx" title={r.n}>
            {r.n}
          </span>
          <div className="bar">
            <i style={{ width: `${Math.max(2, (r.v / mx) * 100).toFixed(1)}%` }} />
          </div>
          <b>{money(r.v)}</b>
        </div>
      ))}
    </>
  );
}

/** «📊 رسومات» under the dashboard, admins only. */
export function DashboardCharts() {
  const [top, setTop] = useState(30);
  const [stag, setStag] = useState(60);
  const c = useCharts(top, stag).data;
  if (!c) return null;
  const dTot = c.daily.reduce((a, x) => a + x.v, 0);
  const stV = c.stagnant.reduce((a, x) => a + x.v, 0);
  return (
    <div style={{ marginTop: 6 }}>
      <h2 style={{ margin: '6px 0 10px' }}>📊 رسومات</h2>
      <div className="chgrid">
        <div className="card chc">
          <h3>المبيعات اليومية — آخر 30 يوم</h3>
          <div className="sub">
            الإجمالي: <b>{money(dTot)}</b> • أعلى يوم: <b>{money(Math.max(0, ...c.daily.map((x) => x.v)))}</b>
          </div>
          <Bars items={[...c.daily].reverse()} lblEvery={5} />
        </div>
        <div className="card chc">
          <h3>الربح الشهري — آخر 6 شهور</h3>
          <div className="sub">صافي الربح = المبيعات − التكلفة − المصروفات (الأحمر = خسارة)</div>
          <Bars items={[...c.monthly].reverse()} color="var(--green)" />
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 300 }}>
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>المبيعات</th>
                  <th>المصروفات</th>
                  <th>صافي الربح</th>
                </tr>
              </thead>
              <tbody>
                {[...c.monthly].reverse().map((x) => (
                  <tr key={x.t}>
                    <td>{x.t}</td>
                    <td>{money(x.sales)}</td>
                    <td>{money(x.exp)}</td>
                    <td style={{ fontWeight: 800, color: x.v < 0 ? '#c0392b' : 'var(--green)' }}>{money(x.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card chc">
          <h3>أكتر 10 أصناف بتتباع</h3>
          <div className="sub">
            <select value={top} onChange={(e) => setTop(Number(e.target.value))}>
              <option value={30}>آخر 30 يوم</option>
              <option value={90}>آخر 90 يوم</option>
              <option value={365}>آخر سنة</option>
              <option value={0}>من الأول</option>
            </select>{' '}
            • بالقيمة
          </div>
          {c.top.length ? <HBars rows={c.top} /> : <div className="empty">مفيش مبيعات في الفترة دي</div>}
        </div>
        <div className="card chc">
          <h3>الأصناف الراكدة</h3>
          <div className="sub">
            <select value={stag} onChange={(e) => setStag(Number(e.target.value))}>
              <option value={30}>ماتباعتش من 30 يوم</option>
              <option value={60}>ماتباعتش من 60 يوم</option>
              <option value={90}>ماتباعتش من 90 يوم</option>
              <option value={180}>ماتباعتش من 6 شهور</option>
            </select>{' '}
            • {c.stagnant.length} صنف — فلوس واقفة: <b>{money(stV)}</b>
          </div>
          {c.stagnant.length ? (
            <>
              <HBars rows={c.stagnant.slice(0, 12).map((x) => ({ n: `${x.n} (${num(x.q)})`, v: x.v }))} />
              {c.stagnant.length > 12 && (
                <div className="sub" style={{ marginTop: 6 }}>
                  و {c.stagnant.length - 12} صنف تاني
                </div>
              )}
            </>
          ) : (
            <div className="empty">مفيش أصناف راكدة 👌</div>
          )}
        </div>
      </div>
    </div>
  );
}

const banner = { width: '100%', marginBottom: 14, borderRadius: 14, padding: 14, fontSize: 16, textAlign: 'right', display: 'block', textDecoration: 'none' } as const;

/** The old red «💰 ...من أكتر من 30 يوم» and orange «📦 ...قرّب يخلص» banners. */
export function DashboardBanners() {
  const router = useRouter();
  const debts = useDebts().data;
  const reorder = useReorderCount(30).data ?? 0;
  const wc = useWebCounts().data;
  const web = wc?.orders ?? 0;
  const rq = wc?.requests ?? 0;
  const cu = wc?.custom ?? 0;
  const msgs = usePortalNewCount().data ?? 0;
  const { open } = useModal();
  const o30 = (debts?.debtors ?? []).filter((x) => x.old || (x.days ?? 0) >= 30);
  const sum = o30.reduce((a, x) => a + x.balance, 0);
  return (
    <>
      {msgs > 0 && (
        <button type="button" onClick={() => open({ kind: 'portalNew' })} style={{ ...banner, background: '#e8f5ff', color: '#0b4a7a', border: '1px solid #9ccdf0', width: '100%', textAlign: 'right', font: 'inherit' }}>
          🔗 عندك <b>{msgs}</b> طلب جديد من العملاء (من رابطهم) — اضغط للعرض
        </button>
      )}
      <ScanBanner onGo={() => router.push('/purchases')} />
      {rq > 0 && (
        <Link href="/weborders#rqBody" style={{ ...banner, background: '#eef6ff', color: '#0b4a8b', border: '1px solid #9cc3ef' }}>
          📷 عندك <b>{rq}</b> طلب بالصور (منتج مش في الموقع) — اضغط للعرض
        </Link>
      )}
      {cu > 0 && (
        <Link href="/weborders#cuBody" style={{ ...banner, background: '#fff4e5', color: '#8a4b00', border: '1px solid #f0b46a' }}>
          🛠️ عندك <b>{cu}</b> طلب تجهيز من الموقع — اضغط للعرض
        </Link>
      )}
      {web > 0 && (
        <Link href="/weborders" style={{ ...banner, background: '#fff4e5', color: '#8a4b00', border: '1px solid #f0b46a' }}>
          🛒 عندك <b>{web}</b> طلب جديد من الموقع — اضغط للعرض
        </Link>
      )}
      {o30.length > 0 && (
        <Link href="/debts" style={{ ...banner, background: '#fdecea', color: '#8c1d18', border: '1px solid #f1a9a3' }}>
          💰 عندك <b>{o30.length}</b> عميل عليهم فلوس من أكتر من 30 يوم ({money(sum)}) — اضغط للتذكير
        </Link>
      )}
      {reorder > 0 && (
        <Link href="/reorder" style={{ ...banner, background: '#fff4e5', color: '#8a4b00', border: '1px solid #f0cf9b' }}>
          📦 <b>{reorder}</b> صنف قرّب يخلص — اضغط تشوف اقتراحات الطلب من الموردين
        </Link>
      )}
    </>
  );
}
