'use client';

import { useState } from 'react';
import type { CloseRow } from '@mk/shared';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useClose, useDoClose, useHyRules, usePartners, useReopenClose, useSaveHyRules, useVan, useVanLoad, useVehicles } from '@/lib/hy-queries';
import { useProducts } from '@/lib/trade-queries';
import { Btn, Card, Chip, csvSave, Field, IN, KV, Label, nq, num, Sel, Sheet } from './ui';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

export function VehiclePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const V = useVehicles().data?.vehicles ?? [];
  if (V.length < 2) return null;
  return (
    <Sel label="العربية" value={value || V[0]!.id} onChange={onChange}>
      {V.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
          {x.plate ? ` — ${x.plate}` : ''}
        </option>
      ))}
    </Sel>
  );
}

interface LoadLine {
  productId: string;
  name: string;
  company: 'MK' | 'HY';
  mkQty: number;
  hyFree: number;
  qty: number;
  src: string;
  price: number;
}

/** «🚚 العربية»: the stock balances, the morning load and the minimum on the van. */
export function VanTab() {
  const toast = useToast();
  const admin = useIsAdmin();
  const van = useVan();
  const veh = useVehicles().data?.vehicles ?? [];
  const partners = usePartners(admin);
  const rules = useHyRules().data;
  const saveRules = useSaveHyRules();
  const load = useVanLoad();
  const [vid, setVid] = useState('');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<LoadLine[]>([]);
  const [sheet, setSheet] = useState(false);
  const [vs, setVs] = useState('');
  const [mins, setMins] = useState<Record<string, string>>({});
  const found = useProducts({ q: q.trim(), pageSize: 10 }, q.trim().length >= 2);
  const v = van.data;
  const P = admin ? partners.data?.partners ?? [] : [];
  const vehicleId = vid || veh[0]?.id || '';
  if (!v) return <Card>{van.isError ? errorMessage(van.error) : '⏳'}</Card>;
  const onVan = (pid: string) => v.stock.filter((s) => s.productId === pid).reduce((a, s) => a + s.qty, 0);
  const add = (p: { id: string; name: string; company: 'MK' | 'HY'; qty: number; cost?: number }) =>
    setLines((L) => {
      const ex = L.find((l) => l.productId === p.id);
      if (ex) return L.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...L, { productId: p.id, name: p.name, company: p.company, mkQty: p.company === 'MK' ? p.qty : 0, hyFree: p.company === 'HY' ? p.qty - onVan(p.id) : 0, qty: 1, src: p.company === 'MK' ? 'mk' : 'hy', price: p.cost ?? 0 }];
    });
  const go = async () => {
    const L = lines.filter((l) => l.qty > 0);
    if (!L.length) return toast('ضيف صنف بكمية', 'bad');
    try {
      await load.mutateAsync({ vehicleId, lines: L.map((l) => ({ productId: l.productId, qty: l.qty, src: l.src, price: l.price })) });
      setLines([]);
      toast('✔ اتحمّلت العربية');
    } catch (e) {
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };
  const T = v.totals;
  const M = rules?.vanMin ?? {};
  const byPid = new Map<string, { n: string; q: number }>();
  v.stock.forEach((s) => byPid.set(s.productId, { n: s.name, q: (byPid.get(s.productId)?.q ?? 0) + s.qty }));
  const pids = [...new Set([...byPid.keys(), ...Object.keys(M)])];
  const rows = pids.map((id) => ({ pid: id, n: byPid.get(id)?.n ?? 'صنف', q: byPid.get(id)?.q ?? 0, m: M[id] ?? 0 }));
  const low = rows.filter((r) => r.m > 0 && r.q < r.m);
  const W = vs.trim().split(/\s+/).filter(Boolean);
  return (
    <>
      <Card>
        <b>🏬 أرصدة البضاعة</b>
        <KV l="بتاع ميكانيزم" v={`${nq(T.mkQty)} — ${money(T.mkValue)}`} />
        <KV l="بتاع هيدرولك (الكل)" v={`${nq(T.hyQty)} — ${money(T.hyValue)}`} />
        <KV l="↳ على العربية 🚚" v={`${nq(T.vanQty)} — ${money(T.vanValue)}`} />
        <KV l="↳ في مخزن ميكانيزم" v={`${nq(T.hyQty - T.vanQty)} — ${money(T.hyValue - T.vanValue)}`} />
        <KV l="إجمالي المخزن الحالي" v={`${nq(T.mkQty + T.hyQty)} — ${money(T.mkValue + T.hyValue)}`} c="var(--blue,#087f8c)" />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>بضاعة العربية جزء من بضاعة هيدرولك، فالإجمالي هو هو ومابيتكررش.</div>
        <Btn pri onClick={() => setSheet(true)}>
          📋 بضاعة العربية (الكمية والمالك والممول)
        </Btn>
      </Card>
      <Card>
        <b>🚚 تحميل العربية (الصبح)</b>
        <VehiclePick value={vehicleId} onChange={setVid} />
        <input placeholder="🔍 اسم الصنف أو الكود أو الباركود..." autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} style={IN} />
        {q.trim().length >= 2 &&
          (found.data?.items.length ? (
            found.data.items.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  add({ id: p.id, name: p.name, company: p.company, qty: p.qty, cost: p.cost });
                  setQ('');
                }}
                style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, marginTop: 6, background: 'var(--card,#fff)', cursor: 'pointer' }}
              >
                <b>{p.name}</b>
                <br />
                <small style={{ color: 'var(--muted)' }}>{p.company === 'HY' ? `🔧 هيدرولك — في المخزن ${nq(p.qty - onVan(p.id))}` : `🏬 ميكانيزم — ${nq(p.qty)}`}</small>
              </div>
            ))
          ) : (
            <div style={{ padding: 10, color: 'var(--muted)' }}>مفيش</div>
          ))}
        {lines.map((l, i) => {
          const setL = (p: Partial<LoadLine>) => setLines(lines.map((x, k) => (k === i ? { ...x, ...p } : x)));
          return (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginTop: 10, background: 'var(--card,#fff)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{l.name}</b>
                <button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))} style={{ border: 0, background: 'transparent', fontSize: 24, color: 'var(--danger)', padding: '0 6px' }}>
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {l.company === 'MK' ? `في مخزن ميكانيزم: ${nq(l.mkQty)}` : `بضاعة هيدرولك في المخزن: ${nq(l.hyFree)}`}
              </div>
              <Field label="الكمية" inputMode="decimal" value={l.qty} onChange={(x) => setL({ qty: num(x) })} />
              <Sel label="المصدر" value={l.src} onChange={(x) => setL({ src: x })}>
                {l.company === 'MK' ? (
                  <option value="mk">من بضاعة ميكانيزم (تعامل بين الشركتين — دين على هيدرولك)</option>
                ) : (
                  <>
                    <option value="hy">بضاعة هيدرولك (من غير ممول)</option>
                    {P.map((x) => (
                      <option key={x.id} value={`p:${x.id}`}>
                        من رأس مال: {x.name}
                      </option>
                    ))}
                  </>
                )}
              </Sel>
              {l.src === 'mk' && <Field label="سعر التحويل للوحدة (افتراضي التكلفة)" inputMode="decimal" value={l.price} onChange={(x) => setL({ price: num(x) })} />}
            </div>
          );
        })}
        <Btn
          onClick={() => {
            const ll = v.lastLoad;
            if (!ll) return toast('مفيش تحميل قبل كده', 'bad');
            setLines(ll.lines.map((m) => ({ productId: m.productId, name: m.name, company: 'HY', mkQty: 0, hyFree: 0, qty: m.qty, src: m.src === 'mk' ? 'hy' : m.src === 'partner' ? `p:${P.find((x) => x.name === m.funder)?.id ?? ''}` : 'hy', price: m.cost })));
            toast(`اتنسخ تحميل ${ll.date} — راجع الكميات وأكّد`);
          }}
        >
          ↻ تحميل نفس أمس
        </Btn>
        {lines.length > 0 && (
          <Btn pri col="var(--green,#15803d)" disabled={load.isPending} onClick={go}>
            ✔ تأكيد التحميل
          </Btn>
        )}
      </Card>
      <Card>
        <b>اتحمّل النهارده</b>
        {v.loadsToday.length ? (
          v.loadsToday.map((m, i) => (
            <KV
              key={i}
              l={
                <>
                  {m.name}
                  <br />
                  <small style={{ color: 'var(--muted)' }}>
                    {m.src === 'mk' ? 'من ميكانيزم' : m.funder ? `رأس مال: ${m.funder}` : 'بضاعة هيدرولك'}
                    {m.ref ? ` — ${m.ref}` : ''}
                  </small>
                </>
              }
              v={nq(m.qty)}
            />
          ))
        ) : (
          <div className="empty" style={{ marginTop: 6 }}>
            لسه ماتحمّلش حاجة النهارده.
          </div>
        )}
      </Card>
      <Card>
        <b>🔻 الحد الأدنى على العربية</b>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px', lineHeight: 1.8 }}>اكتب أقل كمية تفضل من كل صنف. اللي يقل عنها بيظهر هنا وتقدر تحمّله بضغطة.</div>
        {low.length > 0 && (
          <>
            <div style={{ padding: 10, borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 800, marginBottom: 8 }}>⚠️ {low.length} صنف تحت الحد — حمّلهم بكرة:</div>
            {low.map((r) => (
              <KV key={r.pid} l={r.n} v={`عليها ${nq(r.q)} / الحد ${nq(r.m)}`} c="var(--danger)" />
            ))}
            <Btn
              pri
              onClick={() => {
                low.forEach((r) => setLines((L) => (L.some((l) => l.productId === r.pid) ? L : [...L, { productId: r.pid, name: r.n, company: 'HY', mkQty: 0, hyFree: 0, qty: r.m - r.q, src: 'hy', price: 0 }])));
                toast(`اتضاف ${low.length} صنف لتحميل بكرة`);
              }}
            >
              ➕ ضيف الناقص لتحميل بكرة
            </Btn>
          </>
        )}
        {rows.length ? (
          <>
            {rows.map((r) => (
              <Field key={r.pid} label={`${r.n} (دلوقتي ${nq(r.q)})`} inputMode="decimal" value={mins[r.pid] ?? (r.m || '')} onChange={(x) => setMins({ ...mins, [r.pid]: x })} />
            ))}
            <Btn
              onClick={async () => {
                const vm: Record<string, number> = { ...M };
                for (const [k, x] of Object.entries(mins)) {
                  const n = num(x);
                  if (n > 0) vm[k] = n;
                  else delete vm[k];
                }
                try {
                  await saveRules.mutateAsync({ vanMin: vm });
                  setMins({});
                  toast('✔ اتحفظت الحدود');
                } catch (e) {
                  toast(errorMessage(e), 'bad');
                }
              }}
            >
              حفظ الحدود
            </Btn>
          </>
        ) : (
          <div className="empty">مفيش أصناف على العربية.</div>
        )}
      </Card>
      {sheet && (
        <Sheet title="🚚 بضاعة العربية دلوقتي" onClose={() => setSheet(false)}>
          <KV l="عدد الأصناف" v={new Set(v.stock.map((r) => r.productId)).size} />
          <KV l="إجمالي الكمية" v={nq(v.stock.reduce((a, r) => a + r.qty, 0))} />
          <KV l="القيمة (تكلفة)" v={money(v.stock.reduce((a, r) => a + r.qty * r.cost, 0))} />
          <input placeholder="🔍 دوّر في بضاعة العربية..." autoComplete="off" value={vs} onChange={(e) => setVs(e.target.value)} style={IN} />
          {v.stock
            .filter((r) => !W.length || W.every((w) => r.name.includes(w)))
            .map((r, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, marginTop: 8, background: 'var(--card,#fff)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{r.name}</b>
                  <b style={{ fontSize: 18 }}>{nq(r.qty)}</b>
                </div>
                <div>
                  <Chip t="المالك: هيدرولك" c="#d97706" />
                  <Chip t={r.funder ? `الممول: ${r.funder}` : 'من غير ممول'} c={r.funder ? '#7c3aed' : '#6b7280'} />
                  <Chip t={`تكلفة ${money(r.cost)}`} c="#0891b2" />
                </div>
              </div>
            ))}
        </Sheet>
      )}
    </>
  );
}

/** «🧾 تصفية العربية آخر اليوم». */
export function CloseTab() {
  const toast = useToast();
  const admin = useIsAdmin();
  const veh = useVehicles().data?.vehicles ?? [];
  const [vid, setVid] = useState('');
  const [d, setD] = useState(today());
  const vehicleId = vid || veh[0]?.id || '';
  const view = useClose(d, vehicleId);
  const doClose = useDoClose();
  const reopen = useReopenClose();
  const [cnt, setCnt] = useState<Record<string, string>>({});
  const [why, setWhy] = useState<Record<string, string>>({});
  const [back, setBack] = useState<Record<string, boolean>>({});
  const [handed, setHanded] = useState('');
  const [note, setNote] = useState('');
  const reset = () => (setCnt({}), setWhy({}), setBack({}), setHanded(''), setNote(''));
  const K = view.data;
  const head = (
    <Card>
      <b>🧾 تصفية العربية آخر اليوم</b>
      <VehiclePick value={vehicleId} onChange={setVid} />
      <Field label="اليوم" type="date" value={d} onChange={(x) => (setD(x || today()), reset())} />
    </Card>
  );
  if (!K) return head;
  const hist =
    K.history.length > 0 ? (
      <Card>
        <b>🗂️ تصفيات سابقة</b>
        {K.history.map((x) => (
          <button key={x.date} type="button" className="secondary" onClick={() => (setD(x.date), reset())} style={{ width: '100%', minHeight: 48, marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{x.date}</span>
            <span>
              كاش {money(x.cash)}
              {x.ok ? ' ✔' : ' ⚠️'}
            </span>
          </button>
        ))}
      </Card>
    ) : null;
  const rec = K.record;
  if (rec?.closed) {
    const fd = rec.handed - rec.expectedCash;
    const I = rec.data.items ?? [];
    const text = `🧾 تصفية عربية هيدرولك — ${d}\nالمبيعات: ${money(rec.data.sales ?? 0)}\nكاش: ${money(rec.cash)}\nآجل: ${money(rec.credit)}\nمصروفات: ${money(rec.expenses)}\nالمفروض يتسلم: ${money(rec.expectedCash)}\nاتسلم: ${money(rec.handed)}\nفرق الفلوس: ${money(fd)}\nعجز/زيادة بضاعة: ${money(rec.diffValue)}${rec.note ? `\n📝 ${rec.note}` : ''}`;
    return (
      <>
        {head}
        <Card>
          <div style={{ fontWeight: 800, color: 'var(--green,#15803d)' }}>
            ✔ التصفية اتقفلت{rec.byName ? ` — ${rec.byName}` : ''} — {rec.closedAt ? new Date(rec.closedAt).toLocaleString('ar-EG') : ''}
          </div>
          <KV l="مبيعات العربية" v={money(rec.data.sales ?? 0)} />
          <KV l="اتحصّل كاش (فواتير + تحصيل)" v={money(rec.cash)} />
          <KV l="آجل" v={money(rec.credit)} />
          <KV l="المصروفات" v={money(rec.expenses)} />
          <KV l="المفروض يتسلم" v={money(rec.expectedCash)} />
          <KV l="اتسلم فعلاً" v={money(rec.handed)} />
          <KV l="فرق الفلوس" v={money(fd)} c={Math.abs(fd) > 0.5 ? 'var(--danger)' : undefined} />
          <KV l="قيمة عجز/زيادة البضاعة" v={money(rec.diffValue)} c={Math.abs(rec.diffValue) > 0.5 ? 'var(--danger)' : undefined} />
          {rec.note && <div style={{ marginTop: 6 }}>📝 {rec.note}</div>}
        </Card>
        <Card>
          <b>الأصناف</b>
          {I.length ? (
            I.map((x) => {
              const df = x.cnt - x.ex;
              return (
                <KV
                  key={x.pid}
                  l={
                    <>
                      {x.n}
                      <br />
                      <small style={{ color: 'var(--muted)' }}>
                        المفروض {nq(x.ex)} — الفعلي {nq(x.cnt)}
                        {x.why ? ` — ${x.why}` : ''}
                        {x.back ? ' — رجع المخزن' : ''}
                      </small>
                    </>
                  }
                  v={Math.abs(df) > 1e-9 ? `${df > 0 ? '+' : ''}${nq(df)}` : '✔'}
                  c={Math.abs(df) > 1e-9 ? 'var(--danger)' : undefined}
                />
              );
            })
          ) : (
            <div className="empty">مفيش أصناف.</div>
          )}
        </Card>
        {admin && (
          <Btn onClick={() => window.confirm('تفتح التصفية دي للتعديل؟ هيتسجل إنك فتحتها.') && reopen.mutateAsync({ date: d, vehicleId }).then(() => toast('اتفتحت'), (e) => toast(errorMessage(e), 'bad'))}>
            🔓 فتح التصفية للتعديل (للمدير)
          </Btn>
        )}
        <Btn onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')}>📲 مشاركة واتساب</Btn>
        <Btn
          onClick={() =>
            csvSave(`تصفية-${d}.csv`, ['الصنف', 'المفروض', 'الفعلي', 'الفرق', 'السبب'], [
              ...I.map((x) => [x.n, x.ex, x.cnt, x.cnt - x.ex, x.why]),
              [],
              ['المبيعات', rec.data.sales ?? 0],
              ['كاش', rec.cash],
              ['آجل', rec.credit],
              ['مصروفات', rec.expenses],
              ['المفروض يتسلم', rec.expectedCash],
              ['اتسلم', rec.handed],
            ])
          }
        >
          📤 تصدير التصفية (Excel)
        </Btn>
        {hist}
      </>
    );
  }
  const cntOf = (r: CloseRow) => (cnt[r.pid] !== undefined && cnt[r.pid] !== '' ? num(cnt[r.pid]!) : r.ex);
  const go = async () => {
    const items = K.rows.map((r) => ({ pid: r.pid, cnt: cntOf(r), why: (why[r.pid] ?? '').trim(), back: !!back[r.pid] }));
    const bad = K.rows.find((r) => Math.abs(cntOf(r) - r.ex) > 1e-9 && !(why[r.pid] ?? '').trim());
    if (bad) return toast(`اكتب سبب الفرق في «${bad.n}»`, 'bad');
    if (!window.confirm(`تقفل تصفية ${d}؟ بعد القفل ماتتعدلش غير لو المدير فتحها.`)) return;
    try {
      await doClose.mutateAsync({ date: d, vehicleId, handed: handed === '' ? null : num(handed), note: note.trim(), items });
      reset();
      toast('🔒 التصفية اتقفلت');
    } catch (e) {
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <>
      {head}
      {hist}
      {rec && !rec.closed && (
        <Card>
          <div style={{ color: '#d97706', fontWeight: 800 }}>⚠️ التصفية دي اتفتحت للتعديل{rec.reopenedBy ? ` بواسطة ${rec.reopenedBy}` : ''}. عدّل واقفلها تاني.</div>
        </Card>
      )}
      <Card>
        <b>📦 البضاعة</b>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 6px', lineHeight: 1.8 }}>أول اليوم + اتحمّل − اتباع (± مرتجع/تعديل) = المفروض يتبقى. اكتب الجرد الفعلي.</div>
        {K.rows.length ? (
          K.rows.map((r) => {
            const df = Math.round((cntOf(r) - r.ex) * 1000) / 1000;
            return (
              <div key={r.pid} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginTop: 10, background: 'var(--card,#fff)' }}>
                <b>{r.n}</b>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>
                  أول اليوم {nq(r.op)} + اتحمّل {nq(r.ld)} − اتباع {nq(r.sd)}
                  {r.rt ? ` + مرتجع ${nq(r.rt)}` : ''}
                  {r.ot ? ` ± تعديل ${nq(r.ot)}` : ''} = <b style={{ color: 'var(--text)' }}>المفروض {nq(r.ex)}</b>
                </div>
                <Field label="الجرد الفعلي" inputMode="decimal" value={cnt[r.pid] ?? r.ex} onChange={(x) => setCnt({ ...cnt, [r.pid]: x })} />
                {df !== 0 && (
                  <>
                    <div style={{ marginTop: 6 }}>
                      <Chip t={df < 0 ? `عجز ${nq(-df)}` : `زيادة ${nq(df)}`} c={df < 0 ? '#dc2626' : '#0891b2'} />
                    </div>
                    <Field label="السبب (لازم)" value={why[r.pid] ?? ''} onChange={(x) => setWhy({ ...why, [r.pid]: x })} />
                  </>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 15 }}>
                  <input type="checkbox" checked={!!back[r.pid]} onChange={(e) => setBack({ ...back, [r.pid]: e.target.checked })} style={{ width: 24, height: 24, flex: 'none' }} /> يرجع المخزن (لو مش متعلّم يفضل على العربية)
                </label>
              </div>
            );
          })
        ) : (
          <div className="empty">مفيش بضاعة على العربية.</div>
        )}
      </Card>
      <Card>
        <b>💵 الفلوس</b>
        <KV l={`مبيعات العربية (${K.invoices} فاتورة)`} v={money(K.sales)} />
        <KV l="اتحصّل كاش من الفواتير" v={money(K.cash)} />
        <KV l="تحصيل المندوب من عملاء" v={money(K.collections)} />
        <KV l="آجل على العملاء" v={money(K.credit)} />
        <KV l="(–) مصروفات العربية" v={money(K.expenses)} />
        <KV l="المفروض يتسلم لعبده / الخزنة" v={money(K.expected)} c="var(--blue,#087f8c)" />
        <Field label="اتسلم فعلاً" inputMode="decimal" value={handed === '' ? Math.round(K.expected * 100) / 100 : handed} onChange={setHanded} />
        <Field label="ملاحظة" value={note} onChange={setNote} />
        <Btn pri col="var(--green,#15803d)" disabled={doClose.isPending} onClick={go}>
          🔒 قفل التصفية وحفظها
        </Btn>
      </Card>
      <Label> </Label>
    </>
  );
}
