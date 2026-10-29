'use client';

import type { ReactNode } from 'react';
import { money, todayYmd } from '@/lib/format';
import { useAllProducts, useExpenses, useInvoices, usePayments } from '@/lib/trade-queries';
import { useCompany } from '../company';
import { Modal } from '../ui/modal';
import { Loading } from '../ui/states';
import { useModal } from './modal-host';

export type TodayKind = 'sales' | 'inv' | 'coll' | 'exp' | 'low';

const tm = (iso: string) => {
  try {
    return iso ? new Date(iso).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }) : '';
  } catch {
    return '';
  }
};

function Row({ a, c, go }: { a: ReactNode; c: string; go?: () => void }) {
  return (
    <div onClick={go} style={{ cursor: go ? 'pointer' : undefined, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0 }}>{a}</div>
      <b style={{ whiteSpace: 'nowrap' }}>{c}</b>
    </div>
  );
}

/** تفاصيل كل كارت في «النهاردة»: نفس الحسبة بالظبط، فمجموع التقرير = رقم الكارت (mkTodayDetail القديمة). */
export function TodayDetail({ k }: { k: TodayKind }) {
  const { open, close } = useModal();
  const { co } = useCompany();
  const day = todayYmd();
  const inv = useInvoices({ kind: 'SALE', company: co, from: day, to: day, status: 'ACTIVE', page: 1, pageSize: 200 }, k === 'sales' || k === 'inv' || k === 'coll' || k === 'low');
  const pays = usePayments({ direction: 'IN', company: co, from: day, to: day, page: 1, pageSize: 200 }, k === 'coll');
  const exps = useExpenses({ company: co, from: day, to: day, page: 1, pageSize: 200 });
  const prods = useAllProducts({ company: co }, k === 'low');

  const title = { sales: '💰 مبيعات النهاردة', inv: '🧾 فواتير النهاردة', coll: '📥 اتحصّل النهاردة', exp: '📤 مصروفات النهاردة', low: '⚠️ أصناف قربت تخلص' }[k];
  const loading = (k !== 'exp' && inv.isPending) || (k === 'coll' && pays.isPending) || (k === 'exp' && exps.isPending) || (k === 'low' && prods.isPending);
  const G = inv.data?.items ?? [];
  const src = (note: string) => (/يومية/.test(note) ? <span className="badge" style={{ background: '#ecfdf5', color: '#047857' }}>من اليومية</span> : <span className="badge">فاتورة مباشرة</span>);

  let sum: ReactNode = '';
  let list: ReactNode = null;
  if (!loading) {
    if (k === 'sales' || k === 'inv') {
      const val = (g: (typeof G)[number]) => (k === 'inv' ? g.total : g.total - g.shipping);
      const T = G.reduce((s, g) => s + val(g), 0);
      sum =
        k === 'sales' ? (
          <>
            الإجمالي: <b>{money(T)}</b> (اليومية: {money(G.filter((g) => /يومية/.test(g.note)).reduce((s, g) => s + val(g), 0))})
          </>
        ) : (
          <>
            عدد الفواتير: <b>{G.length}</b> — قيمتها {money(T)}
          </>
        );
      list = G.map((g) => (
        <Row
          key={g.id}
          go={() => open({ kind: 'invoice', id: g.id })}
          c={money(val(g))}
          a={
            <>
              <b>{g.no}</b> {src(g.note)}
              <br />
              <small style={{ color: 'var(--muted)' }}>
                {g.person || 'عميل نقدي'} • {g.itemCount} صنف{tm(g.createdAt) ? ` • ${tm(g.createdAt)}` : ''}
              </small>
            </>
          }
        />
      ));
    } else if (k === 'coll') {
      const A: { a: ReactNode; v: number; t: string; go?: () => void }[] = [];
      G.forEach((g) => {
        if (g.paid > 0.004)
          A.push({
            a: (
              <>
                <b>{g.person || 'عميل نقدي'}</b>
                <br />
                <small style={{ color: 'var(--muted)' }}>
                  مدفوع مع فاتورة {g.no}
                  {tm(g.createdAt) ? ` • ${tm(g.createdAt)}` : ''}
                </small>
              </>
            ),
            v: g.paid,
            t: g.createdAt,
            go: () => open({ kind: 'invoice', id: g.id }),
          });
      });
      (pays.data?.items ?? []).filter((p) => !p.invoice).forEach((p) =>
        A.push({
          a: (
            <>
              <b>{p.contact.name || '—'}</b>
              <br />
              <small style={{ color: 'var(--muted)' }}>
                دفعة{p.note ? ` — ${p.note}` : ''}
                {tm(p.createdAt) ? ` • ${tm(p.createdAt)}` : ''}
              </small>
            </>
          ),
          v: p.amount,
          t: p.createdAt,
        }),
      );
      A.sort((x, y) => String(y.t).localeCompare(String(x.t)));
      sum = (
        <>
          الإجمالي: <b>{money(A.reduce((s, x) => s + x.v, 0))}</b>
        </>
      );
      list = A.map((x, i) => <Row key={i} a={x.a} c={money(x.v)} go={x.go} />);
    } else if (k === 'exp') {
      const E = exps.data?.items ?? [];
      sum = (
        <>
          الإجمالي: <b>{money(E.reduce((s, x) => s + x.amount, 0))}</b>
        </>
      );
      list = E.map((x) => (
        <Row
          key={x.id}
          c={money(x.amount)}
          a={
            <>
              <b>{x.note || x.category || 'مصروف'}</b>
              <br />
              <small style={{ color: 'var(--muted)' }}>{x.category}</small>
            </>
          }
        />
      ));
    } else {
      const L = (prods.data ?? []).filter((p) => p.qty <= p.minQty);
      const sold = new Set<string>();
      // the old screen split «اتباعت النهاردة» from the rest by the sold product ids; the list only has names, so match on names
      const names = new Set(G.map((g) => g.firstItem));
      void sold;
      const A = L.filter((p) => names.has(p.name));
      const B = L.filter((p) => !names.has(p.name));
      const pr = (p: (typeof L)[number]) => (
        <Row
          key={p.id}
          go={() => open({ kind: 'product', id: p.id })}
          c={`باقي ${p.qty}`}
          a={
            <>
              <b>{p.name}</b>
              <br />
              <small style={{ color: 'var(--muted)' }}>
                {p.code ? `كود ${p.code} • ` : ''}الحد {p.minQty}
              </small>
            </>
          }
        />
      );
      sum = (
        <>
          العدد كله: <b>{L.length}</b> — منهم {A.length} اتباعوا النهاردة
        </>
      );
      list = (
        <>
          <h4 style={{ margin: '6px 0' }}>اتباعت النهاردة وقربت تخلص ({A.length})</h4>
          {A.length ? A.map(pr) : <div className="empty">مفيش</div>}
          {B.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>باقي الأصناف اللي قربت تخلص ({B.length})</summary>
              {B.slice(0, 300).map(pr)}
            </details>
          )}
        </>
      );
    }
  }

  return (
    <Modal title={title} onClose={close}>
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="card" style={{ background: 'var(--tint2)', border: 0, fontSize: 16 }}>
            {sum}
          </div>
          <div style={{ marginTop: 8 }}>{Array.isArray(list) && !list.length ? <div className="empty">مفيش حاجة النهاردة</div> : list}</div>
        </>
      )}
    </Modal>
  );
}
