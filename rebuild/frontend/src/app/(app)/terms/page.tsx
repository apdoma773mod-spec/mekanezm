'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ContactDto, Paginated } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { TIERS, termsFor, useSaveTerms, useTerms, type CustTerm, type CustTerms } from '@/lib/terms';

/** 🏷️ أسعار وحدود العملاء: خصم ثابت لكل عميل بيتطبّق لوحده في الفاتورة، وحد أقصى للدين بيحذّرك قبل ما يعدّيه. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const num = (v: string) => {
  const n = parseFloat(String(v).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

function TermsTable() {
  const toast = useToast();
  const terms = useTerms();
  const save = useSaveTerms();
  const [customers, setCustomers] = useState<ContactDto[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    void (async () => {
      const out: ContactDto[] = [];
      for (let page = 1; page < 100; page++) {
        const r = await api.get<Paginated<ContactDto>>('/contacts', { type: 'CUSTOMER', page, pageSize: 200 });
        out.push(...r.items);
        if (out.length >= r.total || !r.items.length) break;
      }
      setCustomers(out);
    })();
  }, []);

  const list = useMemo(() => {
    const T: CustTerms = terms.data ?? {};
    const nq = norm(q);
    const L = (customers ?? []).filter((c) => !nq || norm(c.name).includes(nq) || String(c.phone || '').includes(q));
    const withT = L.filter((c) => termsFor(T, c.name));
    const rest = L.filter((c) => !termsFor(T, c.name));
    return { all: [...withT, ...rest].slice(0, 150), withT: withT.length };
  }, [customers, terms.data, q]);

  const commit = async (name: string, patch: (t: CustTerm) => CustTerm) => {
    const T: CustTerms = { ...(terms.data ?? {}) };
    const hit = Object.keys(T).find((x) => norm(x) === norm(name)) ?? name;
    const t = patch({ ...(T[hit] ?? {}) });
    if (!t.pct && !t.limit && !t.note && !t.tier) delete T[hit];
    else T[hit] = t;
    try {
      await save.mutateAsync(T);
      toast('✔ اتحفظ');
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };

  if (!customers || terms.isPending) return <Loading />;
  const T = terms.data ?? {};
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <input placeholder="🔎 دوّر على عميل" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <span style={{ alignSelf: 'center', color: '#7b8a90' }}>{list.withT} عميل ليه شروط</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>الفئة</th>
              <th>خصم %</th>
              <th>حد الدين</th>
              <th>عليه</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {list.all.length === 0 && (
              <tr>
                <td colSpan={6}>مفيش عملاء</td>
              </tr>
            )}
            {list.all.map((c) => {
              const t = termsFor(T, c.name)?.t ?? {};
              const bal = c.balance || 0;
              const over = !!(t.limit && bal >= t.limit);
              return (
                <tr key={`${c.id}-${JSON.stringify(t)}`}>
                  <td>
                    <b>{c.name}</b>
                    <br />
                    <small style={{ color: '#7b8a90' }}>{c.phone || ''}</small>
                  </td>
                  <td>
                    <select
                      defaultValue={t.tier ?? ''}
                      onChange={(e) =>
                        commit(c.name, (x) => {
                          const v = e.target.value;
                          const def = TIERS.find((y) => y[0] === v)?.[1];
                          if (v) return { ...x, tier: v, pct: x.pct || def };
                          const { tier: _drop, ...rest } = x;
                          void _drop;
                          return rest;
                        })
                      }
                    >
                      <option value="">—</option>
                      {TIERS.map((x) => (
                        <option key={x[0]}>{x[0]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input inputMode="decimal" style={{ width: 64 }} defaultValue={t.pct || ''} onBlur={(e) => num(e.target.value) !== (t.pct || 0) && commit(c.name, (x) => ({ ...x, pct: num(e.target.value) || 0 }))} />
                  </td>
                  <td>
                    <input inputMode="decimal" style={{ width: 100 }} defaultValue={t.limit || ''} onBlur={(e) => num(e.target.value) !== (t.limit || 0) && commit(c.name, (x) => ({ ...x, limit: num(e.target.value) || 0 }))} />
                  </td>
                  <td style={{ fontWeight: 800, color: over ? '#b33' : 'inherit' }}>
                    {bal ? money(bal) : '—'}
                    {over ? ' ⛔' : ''}
                  </td>
                  <td>
                    <input style={{ width: 140 }} defaultValue={t.note ?? ''} onBlur={(e) => e.target.value.trim() !== (t.note ?? '') && commit(c.name, (x) => ({ ...x, note: e.target.value.trim() }))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function TermsPage() {
  return (
    <AdminOnly>
      <PageHeader title="🏷️ أسعار وحدود العملاء" subtitle="خصم ثابت لكل عميل بيتطبّق لوحده في الفاتورة، وحد أقصى للدين بيحذّرك قبل ما يعدّيه" />
      <TermsTable />
    </AdminOnly>
  );
}
