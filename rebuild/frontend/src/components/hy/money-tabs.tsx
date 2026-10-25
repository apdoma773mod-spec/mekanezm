'use client';

import { useState } from 'react';
import { CO_NAME } from '@mk/shared';
import { useCompany } from '../company';
import { useToast } from '../ui/toast';
import { errorMessage, ApiClientError } from '@/lib/api';
import { money } from '@/lib/format';
import {
  useDeletePartner,
  useDeletePartnerMove,
  useHyRules,
  useIcAccount,
  useIcCancel,
  useIcDeals,
  useIcSettle,
  useIcTransfer,
  usePartnerMove,
  usePartners,
  useSaveHyRules,
  useSavePartner,
} from '@/lib/hy-queries';
import { useProducts } from '@/lib/trade-queries';
import { Area, Btn, Card, csvSave, Field, IN, KV, num, Sel } from './ui';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const COL = { MK: '#1d3fb8', HY: '#d97706' } as const;

interface IcLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  have: number;
  cost: number;
  sale: number;
}

/** «🔁 التعامل بين الشركتين». */
export function IcTab({ onAcc }: { onAcc: () => void }) {
  const toast = useToast();
  const { co } = useCompany();
  const [dir, setDir] = useState<'sell' | 'buy'>('sell');
  const sel = dir === 'sell' ? co : co === 'MK' ? 'HY' : 'MK';
  const buy = sel === 'MK' ? 'HY' : 'MK';
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<IcLine[]>([]);
  const [mode, setMode] = useState('credit');
  const [note, setNote] = useState('');
  const [hf, setHf] = useState({ dir: '', d: '', q: '' });
  const found = useProducts({ q: q.trim(), company: sel, pageSize: 8 }, q.trim().length >= 1);
  const transfer = useIcTransfer();
  const deals = useIcDeals();
  const cancel = useIcCancel();
  const acc = useIcAccount().data;
  const tot = lines.reduce((a, l) => a + l.qty * l.price, 0);
  const go = async (force = false) => {
    const L = lines.filter((l) => l.qty > 0);
    if (!L.length) return toast('⚠️ ضيف صنف بكمية', 'bad');
    try {
      const R = await transfer.mutateAsync({ seller: sel, lines: L.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })), paid: mode === 'cash' ? tot : 0, note, force });
      setLines([]);
      setNote('');
      toast(`✔ اتسجل: بيع ${R.sale.no} / شراء ${R.buy.no}`);
    } catch (e) {
      if (!force && e instanceof ApiClientError && e.fieldErrors().force) {
        if (window.confirm(`${e.message}\n\nتكمل والرصيد يبقى بالسالب؟`)) return go(true);
        return toast('اتلغى التعامل — الرصيد مش كفاية', 'bad');
      }
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };
  const W = hf.q.trim().split(/\s+/).filter(Boolean);
  const hl = (deals.data ?? []).filter((o) => (!hf.dir || o.seller === hf.dir) && (!hf.d || o.date === hf.d) && (!W.length || W.every((w) => `${o.no} ${o.items.join(' ')}`.includes(w))));
  return (
    <>
      <Card>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          التعامل الحالي: بيع من <span style={{ color: COL[sel] }}>{CO_NAME[sel]}</span> ← إلى <span style={{ color: COL[buy] }}>{CO_NAME[buy]}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(
            [
              ['sell', 'أبيع للشركة التانية'],
              ['buy', 'أشتري من الشركة التانية'],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" onClick={() => (setDir(k), setLines([]))} style={{ flex: 1, padding: '12px 6px', borderRadius: 12, fontWeight: 800, border: '2px solid var(--blue)', background: dir === k ? 'var(--blue)' : 'transparent', color: dir === k ? '#fff' : 'inherit' }}>
              {t}
            </button>
          ))}
        </div>
        <input placeholder={`🔍 دوّر على صنف من مخزن ${CO_NAME[sel]}...`} value={q} onChange={(e) => setQ(e.target.value)} style={IN} />
        {q.trim() &&
          found.data?.items.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                if (!lines.some((l) => l.productId === p.id)) setLines([...lines, { productId: p.id, name: p.name, qty: 1, price: p.cost ?? 0, have: p.qty, cost: p.cost ?? 0, sale: p.price }]);
                setQ('');
              }}
              style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, marginTop: 6, background: 'var(--card,#fff)', cursor: 'pointer' }}
            >
              <b>{p.name}</b>{' '}
              <small style={{ color: 'var(--muted)' }}>
                متاح {p.qty} — تكلفة {money(p.cost ?? 0)}
              </small>
            </div>
          ))}
        {lines.map((l, i) => {
          const setL = (p: Partial<IcLine>) => setLines(lines.map((x, k) => (k === i ? { ...x, ...p } : x)));
          return (
            <div key={l.productId} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{l.name}</b>
                <button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))} style={{ border: 0, background: 'transparent', fontSize: 20, color: 'var(--danger)' }}>
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Field label="الكمية" inputMode="decimal" value={l.qty} onChange={(v) => setL({ qty: num(v) })} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="سعر التحويل للوحدة" inputMode="decimal" value={l.price} onChange={(v) => setL({ price: num(v) })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" onClick={() => setL({ price: l.cost })} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit', fontWeight: 700 }}>
                  بالتكلفة {money(l.cost)}
                </button>
                <button type="button" onClick={() => setL({ price: l.sale })} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit', fontWeight: 700 }}>
                  بسعر البيع
                </button>
              </div>
              <div style={{ fontSize: 12, color: l.qty > l.have ? '#dc2626' : 'var(--muted)', marginTop: 4 }}>
                {l.qty > l.have ? '⚠️ ' : ''}المتاح {l.have}
                {l.qty > l.have ? ' — هتكمل والرصيد يبقى بالسالب (هيطلب منك تأكيد)' : ''} — تكلفتها {money(l.cost)}
              </div>
            </div>
          );
        })}
        {lines.length > 0 && <div style={{ fontWeight: 800, marginTop: 10 }}>الإجمالي: {money(tot)}</div>}
        <Sel label="الدفع" value={mode} onChange={setMode}>
          <option value="credit">على الحساب (آجل بين الشركتين)</option>
          <option value="cash">مدفوع كاش دلوقتي</option>
        </Sel>
        <Field label="ملاحظة" value={note} onChange={setNote} />
        <Btn pri disabled={transfer.isPending} onClick={() => go()}>
          تسجيل التعامل (فاتورة بيع + فاتورة شراء بنفس الحساب)
        </Btn>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.8 }}>في التقارير المجمّعة التعامل ده مابيتحسبش مبيعات ولا مشتريات مرتين. بيظهر ربح التحويل (سعر التحويل − التكلفة) في سطر لوحده.</div>
      </Card>
      <Card>
        <b>الحساب بين الشركتين</b>
        {acc ? (
          <>
            <KV l="على هيدرولك لميكانيزم" v={money(acc.hyOwes)} c={acc.hyOwes > 0.5 ? 'var(--danger)' : undefined} />
            <KV l="على ميكانيزم لهيدرولك" v={money(acc.mkOwes)} c={acc.mkOwes > 0.5 ? 'var(--danger)' : undefined} />
          </>
        ) : (
          <div className="empty" style={{ marginTop: 6 }}>
            لسه مفيش تعاملات.
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          لتسديد دفعة:{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), onAcc())}>
            ⚖️ حساب الشركتين
          </a>
        </div>
      </Card>
      <Card>
        <b>سجل التعاملات</b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <select value={hf.dir} onChange={(e) => setHf({ ...hf, dir: e.target.value })} style={{ ...IN, margin: 0, flex: 1, minWidth: '46%' }}>
            <option value="">كل الاتجاهات</option>
            <option value="MK">ميكانيزم ← هيدرولك</option>
            <option value="HY">هيدرولك ← ميكانيزم</option>
          </select>
          <input type="date" value={hf.d} onChange={(e) => setHf({ ...hf, d: e.target.value })} style={{ ...IN, margin: 0, flex: 1, minWidth: '46%' }} />
        </div>
        <input placeholder="🔍 رقم فاتورة / صنف..." value={hf.q} onChange={(e) => setHf({ ...hf, q: e.target.value })} style={IN} />
        <Btn onClick={() => csvSave(`transfers-${today()}.csv`, ['الفاتورة', 'التاريخ', 'من', 'إلى', 'الأصناف', 'الإجمالي', 'المتبقي'], hl.map((o) => [o.no, o.date, CO_NAME[o.seller], CO_NAME[o.buyer], o.items.join(' | '), o.total, o.remaining]))}>⬇️ تصدير (Excel / CSV)</Btn>
        {hl.length ? (
          hl.slice(0, 40).map((o) => (
            <KV
              key={o.ref}
              l={
                <>
                  {o.no} — {o.date}
                  <br />
                  <small style={{ color: 'var(--muted)' }}>
                    {CO_NAME[o.seller]} ← {CO_NAME[o.buyer]} — {o.items.slice(0, 3).join('، ')}
                    {o.items.length > 3 ? ' …' : ''}
                  </small>{' '}
                  <button
                    type="button"
                    onClick={() =>
                      window.confirm('تلغي التعامل ده (فاتورة البيع والشراء المقابلة)؟ الرصيد هيرجع.') &&
                      cancel.mutateAsync(o.ref).then(
                        () => toast('اتلغى التعامل'),
                        (e) => toast(`⚠️ ${errorMessage(e)}`, 'bad'),
                      )
                    }
                    style={{ border: 0, background: 'transparent', color: 'var(--danger)', fontWeight: 800 }}
                  >
                    🗑️ إلغاء
                  </button>
                </>
              }
              v={
                <>
                  {money(o.total)}
                  {o.remaining > 0.5 && (
                    <>
                      <br />
                      <small style={{ color: 'var(--danger)' }}>متبقي {money(o.remaining)}</small>
                    </>
                  )}
                </>
              }
            />
          ))
        ) : (
          <div className="empty" style={{ marginTop: 6 }}>
            مفيش.
          </div>
        )}
      </Card>
    </>
  );
}

/** «⚖️ حساب الشركتين». */
export function AccTab({ onIc }: { onIc: () => void }) {
  const toast = useToast();
  const a = useIcAccount();
  const settle = useIcSettle();
  const rules = useHyRules().data;
  const saveRules = useSaveHyRules();
  const [dirS, setDirS] = useState<'h2m' | 'm2h' | ''>('');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [p, setP] = useState('all');
  const [lim, setLim] = useState('');
  const A = a.data;
  if (!A) return <Card>{a.isError ? errorMessage(a.error) : '⏳'}</Card>;
  const net = A.net;
  const dir = dirS || (net >= 0 ? 'h2m' : 'm2h');
  const now = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const from = p === 'm' ? iso(new Date(now.getFullYear(), now.getMonth(), 1)) : p === '30' ? iso(new Date(now.getTime() - 30 * 864e5)) : p === 'y' ? `${now.getFullYear()}-01-01` : '';
  const rows = from ? A.rows.filter((r) => r.d >= from) : A.rows;
  const limit = rules?.debtMax ?? 0;
  return (
    <>
      <Card>
        <b>⚖️ حساب الشركتين</b>
        <KV l="هيدرولك أخدت من ميكانيزم (إجمالي)" v={money(A.hyTook)} />
        <KV l="ميكانيزم أخدت من بضاعة هيدرولك (إجمالي)" v={money(A.mkTook)} />
        <KV l="على هيدرولك لميكانيزم دلوقتي" v={money(A.hyOwes)} c={A.hyOwes > 0.5 ? 'var(--danger)' : undefined} />
        <KV l="على ميكانيزم لهيدرولك دلوقتي" v={money(A.mkOwes)} c={A.mkOwes > 0.5 ? 'var(--danger)' : undefined} />
        <div style={{ marginTop: 10, padding: 14, borderRadius: 12, background: Math.abs(net) < 0.5 ? '#dcfce7' : '#fef3c7', color: '#18343a', fontWeight: 800, textAlign: 'center', fontSize: 17 }}>
          {Math.abs(net) < 0.5 ? '✔ الحساب خالص' : net > 0 ? `الصافي: على هيدرولك لميكانيزم ${money(net)}` : `الصافي: على ميكانيزم لهيدرولك ${money(-net)}`}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>في «المجمّع» التعاملات الداخلية مابتتحسبش مبيعات ولا مشتريات، وربحها في سطر لوحده.</div>
      </Card>
      <Card>
        <b>💸 سداد بين الشركتين</b>
        <Sel label="مين بيدفع" value={dir} onChange={(v) => setDirS(v as 'h2m')}>
          <option value="h2m">هيدرولك تدفع لميكانيزم</option>
          <option value="m2h">ميكانيزم تدفع لهيدرولك</option>
        </Sel>
        <Field label="المبلغ" inputMode="decimal" value={amt === '' ? (Math.abs(net) > 0.5 ? Math.round(Math.abs(net) * 100) / 100 : '') : amt} onChange={setAmt} />
        <Field label="ملاحظة" value={note} onChange={setNote} />
        <Btn
          pri
          disabled={settle.isPending}
          onClick={async () => {
            const x = amt === '' ? Math.abs(net) : num(amt);
            if (!(x > 0)) return toast('اكتب المبلغ', 'bad');
            if (!window.confirm(`تسجّل سداد ${money(x)}؟`)) return;
            try {
              await settle.mutateAsync({ dir, amount: x, note: note.trim() });
              setAmt('');
              setNote('');
              toast('✔ اتسجل السداد');
            } catch (e) {
              toast(`⚠️ ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          تسجيل السداد (عند الشركتين)
        </Btn>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>بيتسجل تحصيل عند اللي استلم وسداد عند اللي دفع، بتاريخ النهارده. السداد الجزئي مسموح.</div>
      </Card>
      <Card>
        <b>🔁 ميكانيزم هتاخد من بضاعة هيدرولك؟</b>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0', lineHeight: 1.8 }}>من «التعامل» وانت على هيدرولك اختار «أبيع للشركة التانية» (السعر الافتراضي = التكلفة).</div>
        <Btn onClick={onIc}>فتح التعامل بين الشركتين</Btn>
      </Card>
      <Card>
        <b>📑 كشف حساب الشركتين</b>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {(
            [
              ['all', 'الكل'],
              ['m', 'الشهر ده'],
              ['30', 'آخر 30 يوم'],
              ['y', 'السنة دي'],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" className={p === k ? 'primary' : 'secondary'} onClick={() => setP(k)} style={{ minHeight: 42 }}>
              {t}
            </button>
          ))}
        </div>
        {limit > 0 && net > limit && <div style={{ padding: 10, borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontWeight: 800, marginBottom: 8 }}>⚠️ مديونية هيدرولك لميكانيزم عدّت الحد ({money(limit)})</div>}
        {rows.length ? (
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {[...rows].reverse().map((r, i) => (
              <KV
                key={i}
                l={
                  <>
                    {r.d} — {r.t}
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{r.n}</small>
                  </>
                }
                v={
                  <>
                    <span style={{ color: r.v > 0 ? 'var(--danger)' : '#15803d' }}>
                      {r.v > 0 ? '+' : '–'}
                      {money(Math.abs(r.v))}
                    </span>
                    <br />
                    <small style={{ color: 'var(--muted)' }}>رصيد {money(r.b)}</small>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty">مفيش حركات في الفترة دي.</div>
        )}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>الرصيد الموجب = على هيدرولك لميكانيزم، والسالب = على ميكانيزم لهيدرولك.</div>
        <Btn onClick={() => csvSave('كشف-حساب-الشركتين.csv', ['التاريخ', 'النوع', 'البيان', 'المبلغ', 'الرصيد'], A.rows.map((x) => [x.d, x.t, x.n, x.v, x.b]))}>📤 تصدير الكشف (Excel)</Btn>
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
          <Field label="تنبيه لو مديونية هيدرولك عدّت (0 = من غير تنبيه)" inputMode="decimal" value={lim === '' ? limit || '' : lim} onChange={setLim} />
          <Btn onClick={() => saveRules.mutateAsync({ debtMax: num(lim) }).then(() => toast('✔ اتحفظ'), (e) => toast(errorMessage(e), 'bad'))}>حفظ حد التنبيه</Btn>
        </div>
      </Card>
      <Card>
        <b>آخر السدادات</b>
        {A.payments.length ? (
          A.payments.map((x) => (
            <KV
              key={x.id}
              l={
                <>
                  {x.date} — {x.name}
                  <br />
                  <small style={{ color: 'var(--muted)' }}>
                    {CO_NAME[x.company]}
                    {x.note ? ` — ${x.note}` : ''}
                  </small>
                </>
              }
              v={money(x.amount)}
            />
          ))
        ) : (
          <div className="empty" style={{ marginTop: 6 }}>
            مفيش.
          </div>
        )}
      </Card>
    </>
  );
}

/** «🤝 الشركاء» + «📒 قاعدة توزيع أرباح هيدرولك». */
export function PtTab() {
  const toast = useToast();
  const b = usePartners();
  const save = useSavePartner();
  const del = useDeletePartner();
  const move = usePartnerMove();
  const delMove = useDeletePartnerMove();
  const saveRules = useSaveHyRules();
  const [open, setOpen] = useState<Record<string, '' | 'mv' | 'h'>>({});
  const [mv, setMv] = useState<Record<string, { k: string; a: string; d: string; n: string }>>({});
  const [pe, setPe] = useState<{ id?: string; name: string; phone: string; share: string; note: string }>({ name: '', phone: '', share: '', note: '' });
  const [rl, setRl] = useState<{ capFirst?: boolean; afterVan?: boolean; rent?: string }>({});
  const B = b.data;
  if (!B) return <Card>{b.isError ? errorMessage(b.error) : '⏳'}</Card>;
  const tot = B.partners.reduce((a, p) => a + p.share, 0);
  const R = { ...B.rules, ...rl };
  const run = (f: () => Promise<unknown>, ok: string) =>
    f().then(
      () => toast(ok),
      (e) => toast(`⚠️ ${errorMessage(e)}`, 'bad'),
    );
  return (
    <>
      <Card>
        <div style={{ fontWeight: 800 }}>
          صافي ربح هيدرولك (كل الفترات): <span style={{ color: B.profit < 0 ? 'var(--danger)' : 'var(--green)' }}>{money(B.profit)}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          مجموع النسب {tot}٪{tot !== 100 && B.partners.length ? ' — المفروض ١٠٠٪' : ''}
        </div>
      </Card>
      {B.partners.map((p) => {
        const op = open[p.id] ?? '';
        const M = mv[p.id] ?? { k: 'capital', a: '', d: today(), n: '' };
        return (
          <Card key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 18 }}>{p.name}</b>
              <span style={{ fontWeight: 800 }}>{p.share}٪</span>
            </div>
            {p.phone && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }} dir="ltr">
                {p.phone}
              </div>
            )}
            <KV l="التمويل (دخّله)" v={money(p.capital)} />
            <KV l="السحب" v={money(p.draws)} c={p.draws ? 'var(--danger)' : undefined} />
            <KV l="نصيبه من الأرباح" v={money(p.shareValue)} c={p.shareValue < 0 ? 'var(--danger)' : undefined} />
            <KV l="اتوزّع عليه" v={money(p.paid)} />
            <KV l="المستحق له من الأرباح" v={money(p.due)} c={p.due < 0 ? 'var(--danger)' : 'var(--green)'} />
            <KV l="صافي رصيده (تمويل − سحب + مستحق)" v={money(p.capital - p.draws + p.due)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setOpen({ ...open, [p.id]: op === 'mv' ? '' : 'mv' })} style={{ flex: 1, padding: '13px 6px', borderRadius: 12, fontWeight: 800, border: '1.5px solid var(--blue)', background: 'transparent', color: 'inherit' }}>
                {op === 'mv' ? 'إغلاق' : '＋ حركة'}
              </button>
              <button type="button" onClick={() => setOpen({ ...open, [p.id]: op === 'h' ? '' : 'h' })} style={{ flex: 1, padding: '13px 6px', borderRadius: 12, fontWeight: 800, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit' }}>
                {op === 'h' ? 'إغلاق' : 'كشف الحساب'}
              </button>
              <button type="button" onClick={() => setPe({ id: p.id, name: p.name, phone: p.phone, share: String(p.share), note: p.note })} style={{ flex: 'none', padding: '13px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit' }}>
                ✏️
              </button>
            </div>
            {op === 'mv' && (
              <div style={{ marginTop: 8 }}>
                <Sel label="نوع الحركة" value={M.k} onChange={(v) => setMv({ ...mv, [p.id]: { ...M, k: v } })}>
                  <option value="capital">تمويل (الشريك دخّل فلوس)</option>
                  <option value="draw">سحب (الشريك أخد فلوس)</option>
                  <option value="profit">توزيع أرباح (دفعنا نصيبه)</option>
                </Sel>
                <Field label="المبلغ" inputMode="decimal" value={M.a} onChange={(v) => setMv({ ...mv, [p.id]: { ...M, a: v } })} />
                <Field label="التاريخ" type="date" value={M.d} onChange={(v) => setMv({ ...mv, [p.id]: { ...M, d: v } })} />
                <Field label="ملاحظة" value={M.n} onChange={(v) => setMv({ ...mv, [p.id]: { ...M, n: v } })} />
                <Btn
                  pri
                  onClick={() => {
                    if (!(num(M.a) > 0)) return toast('اكتب المبلغ', 'bad');
                    void run(async () => {
                      await move.mutateAsync({ id: p.id, input: { kind: M.k, amount: num(M.a), date: M.d || today(), note: M.n.trim() } });
                      setOpen({ ...open, [p.id]: 'h' });
                      setMv({ ...mv, [p.id]: { k: 'capital', a: '', d: today(), n: '' } });
                    }, 'اتسجلت');
                  }}
                >
                  حفظ الحركة
                </Btn>
              </div>
            )}
            {op === 'h' && (
              <div style={{ marginTop: 8 }}>
                {p.moves.length ? (
                  p.moves.map((m) => (
                    <KV
                      key={m.id}
                      l={
                        <>
                          {m.date} — {m.kind === 'capital' ? 'تمويل' : m.kind === 'draw' ? 'سحب' : 'توزيع أرباح'}
                          {m.note && (
                            <>
                              <br />
                              <small style={{ color: 'var(--muted)' }}>{m.note}</small>
                            </>
                          )}
                        </>
                      }
                      v={
                        <>
                          {money(m.amount)}{' '}
                          <button type="button" onClick={() => window.confirm('تمسح الحركة دي؟') && run(() => delMove.mutateAsync(m.id), 'اتمسحت')} style={{ border: 0, background: 'transparent', color: 'var(--danger)' }}>
                            🗑️
                          </button>
                        </>
                      }
                    />
                  ))
                ) : (
                  <div className="empty">مفيش حركات.</div>
                )}
              </div>
            )}
          </Card>
        );
      })}
      <Card>
        <b>{pe.id ? 'تعديل شريك' : 'شريك جديد'}</b>
        <Field label="الاسم" value={pe.name} onChange={(v) => setPe({ ...pe, name: v })} />
        <Field label="التليفون" type="tel" value={pe.phone} onChange={(v) => setPe({ ...pe, phone: v })} />
        <Field label="نسبته من أرباح هيدرولك (٪)" inputMode="decimal" value={pe.share} onChange={(v) => setPe({ ...pe, share: v })} />
        <Area label="ملاحظات" value={pe.note} onChange={(v) => setPe({ ...pe, note: v })} />
        <Btn
          pri
          onClick={() => {
            if (!pe.name.trim()) return toast('اكتب اسم الشريك', 'bad');
            void run(async () => {
              await save.mutateAsync({ id: pe.id, input: { name: pe.name.trim(), phone: pe.phone.trim(), share: num(pe.share), note: pe.note.trim() } });
              setPe({ name: '', phone: '', share: '', note: '' });
            }, 'اتحفظ');
          }}
        >
          {pe.id ? 'حفظ التعديل' : 'إضافة الشريك'}
        </Btn>
        {pe.id && (
          <>
            <Btn onClick={() => setPe({ name: '', phone: '', share: '', note: '' })}>إلغاء التعديل</Btn>
            <Btn
              onClick={() =>
                window.confirm('هتمسح الشريك وكل حركاته. متأكد؟') &&
                run(async () => {
                  await del.mutateAsync(pe.id!);
                  setPe({ name: '', phone: '', share: '', note: '' });
                }, 'اتمسح')
              }
            >
              حذف الشريك
            </Btn>
          </>
        )}
      </Card>
      <Card>
        <b>📒 قاعدة توزيع أرباح هيدرولك</b>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, marginTop: 4 }}>نسبة كل شريك ثابتة ومش مرتبطة باللي دفعه (نسبة عبده صاحب الفكرة ثابتة). رأس المال بيتتبع لوحده.</div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 15 }}>
          <input type="checkbox" checked={R.capFirst} onChange={(e) => setRl({ ...rl, capFirst: e.target.checked })} style={{ width: 24, height: 24, flex: 'none' }} /> رأس المال يرجع الأول، وبعدين الأرباح
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 15 }}>
          <input type="checkbox" checked={R.afterVan} onChange={(e) => setRl({ ...rl, afterVan: e.target.checked })} style={{ width: 24, height: 24, flex: 'none' }} /> النسبة على الصافي بعد مصاريف العربية
        </label>
        <Field label="إيجار العربية الشهري لعبده (0 = مصاريفها بس)" inputMode="decimal" value={rl.rent ?? B.rules.rent} onChange={(v) => setRl({ ...rl, rent: v })} />
        <KV l="صافي ربح هيدرولك" v={money(B.profit)} />
        {!B.rules.afterVan && <KV l="(+) مصاريف العربية (مابتتخصمش من النسب)" v={money(B.vanExpenses)} />}
        {B.rent > 0 && <KV l="(–) إيجار العربية لعبده" v={money(B.rent)} />}
        <KV l="المتاح للتوزيع بالنسب" v={money(B.pool)} c={B.pool < 0 ? 'var(--danger)' : 'var(--green)'} />
        <Btn pri onClick={() => run(() => saveRules.mutateAsync({ capFirst: R.capFirst, afterVan: R.afterVan, rent: num(String(rl.rent ?? B.rules.rent)) }).then(() => setRl({})), 'اتحفظت القاعدة')}>
          حفظ القاعدة
        </Btn>
      </Card>
      {B.partners.map((p) => (
        <Card key={`s-${p.id}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 17 }}>كشف حساب {p.name}</b>
            <small style={{ color: 'var(--muted)' }}>{p.share}٪ ثابتة</small>
          </div>
          <KV l="دفعه (تمويل)" v={money(p.capital)} />
          <KV l="بضاعة اتحمّلت على العربية من رأس ماله" v={money(p.loaded)} />
          <KV l="اتباع منها (رأس مال رجع)" v={money(p.sold)} />
          {Math.abs(p.adjusted) > 0.5 && <KV l="عجز / زيادة عليها" v={money(p.adjusted)} c={p.adjusted < 0 ? 'var(--danger)' : undefined} />}
          <KV l="لسه على العربية من بضاعته" v={money(p.onVan)} />
          <KV l="نصيبه من الربح" v={money(p.shareValue)} c={p.shareValue < 0 ? 'var(--danger)' : undefined} />
          <KV l="سحوباته" v={money(p.draws)} c={p.draws ? 'var(--danger)' : undefined} />
          <KV l="أرباح اتدفعتله" v={money(p.paid)} />
          <KV l="الرصيد (له)" v={money(p.balance)} c={p.balance < 0 ? 'var(--danger)' : 'var(--green)'} />
          <KV l={B.rules.capFirst ? 'المتاح يسحبه دلوقتي (رأس المال الأول)' : 'المتاح يسحبه دلوقتي'} v={money(p.available)} c="var(--blue,#087f8c)" />
        </Card>
      ))}
    </>
  );
}
