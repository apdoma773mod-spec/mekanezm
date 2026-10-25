'use client';

import { useState } from 'react';
import { CONTRACT_KINDS, CO_NAME, VEHICLE_KINDS, type CoIdent, type ContractDto, type VehicleDto } from '@mk/shared';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import {
  useAddVehicle,
  useAlerts,
  useContractAction,
  useContracts,
  useCreateContract,
  useDeleteVehicleLog,
  useFieldOrders,
  useHyRules,
  useIdent,
  useSaveAlerts,
  useSaveHyRules,
  useSaveIdent,
  useVehicleLog,
  useVehicleMeta,
  useVehicles,
  useWaSend,
} from '@/lib/hy-queries';
import { useMe } from '@/lib/queries';
import { useContacts } from '@/lib/trade-queries';
import { waText } from './field-tabs';
import { ago, Area, Btn, Card, Chip, csvSave, Field, IN, KV, num, Sel, Sheet, waNum } from './ui';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

// ---------- 🚗 ----------

function CarMeta({ v }: { v: VehicleDto }) {
  const admin = useIsAdmin();
  const toast = useToast();
  const save = useVehicleMeta();
  const alerts = useVehicles().data?.alerts ?? [];
  const [m, setM] = useState(v.meta);
  const dis = !admin;
  return (
    <Card>
      <b>📋 بيانات السيارة والتنبيهات</b>
      {alerts.map((a, i) => (
        <div key={i} style={{ padding: '8px 10px', marginTop: 6, borderRadius: 10, background: a.late ? '#fee2e2' : '#fef3c7', color: a.late ? '#991b1b' : '#92400e', fontWeight: 700 }}>
          {a.late ? '⛔ فات ميعاد' : '⏰ قرّب ميعاد'}: {a.t}
          {a.d > 0 ? ` (باقي ${a.d} يوم)` : ''}
        </div>
      ))}
      <Field label="صاحب السيارة" value={m.owner} onChange={(x) => setM({ ...m, owner: x })} disabled={dis} />
      <Field label="السواق الأساسي" value={m.driver} onChange={(x) => setM({ ...m, driver: x })} disabled={dis} />
      <Field label="انتهاء الرخصة" type="date" value={m.lic} onChange={(x) => setM({ ...m, lic: x })} disabled={dis} />
      <Field label="انتهاء التأمين" type="date" value={m.ins} onChange={(x) => setM({ ...m, ins: x })} disabled={dis} />
      <Field label="ميعاد الصيانة الجاية" type="date" value={m.nxt} onChange={(x) => setM({ ...m, nxt: x })} disabled={dis} />
      <Field label="الصيانة الجاية عند عداد (كم)" inputMode="decimal" value={m.nkm || ''} onChange={(x) => setM({ ...m, nkm: num(x) })} disabled={dis} />
      {admin ? <Btn onClick={() => save.mutateAsync({ id: v.id, meta: m }).then(() => toast('✔ اتحفظت'), (e) => toast(errorMessage(e), 'bad'))}>حفظ البيانات</Btn> : <div style={{ fontSize: 12, color: 'var(--muted)' }}>التعديل للمدير بس.</div>}
    </Card>
  );
}

export function CarTab() {
  const toast = useToast();
  const admin = useIsAdmin();
  const data = useVehicles();
  const addV = useAddVehicle();
  const log = useVehicleLog();
  const delLog = useDeleteVehicleLog();
  const [cv, setCv] = useState('');
  const [f, setF] = useState({ kind: VEHICLE_KINDS[0] as string, a: '', km: '', l: '', d: today(), n: '' });
  const [nv, setNv] = useState({ n: '', p: '' });
  const V = data.data?.vehicles ?? [];
  const v = V.find((x) => x.id === cv) ?? V[0];
  const lg = v?.log ?? [];
  const nowM = today().slice(0, 7);
  const kk = lg.filter((x) => x.km !== null).map((x) => x.km!);
  const kmR = kk.length > 1 ? Math.max(...kk) - Math.min(...kk) : 0;
  const tot = lg.reduce((a, x) => a + x.amount, 0);
  const lit = lg.reduce((a, x) => a + (x.liters ?? 0), 0);
  const byK = new Map<string, number>();
  lg.forEach((x) => byK.set(x.kind, (byK.get(x.kind) ?? 0) + x.amount));
  return (
    <>
      {v ? (
        <>
          <Card>
            <Sel label="السيارة" value={v.id} onChange={setCv}>
              {V.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.plate ? ` — ${x.plate}` : ''}
                </option>
              ))}
            </Sel>
            <KV l="مصاريف الشهر ده" v={money(lg.filter((x) => x.date.slice(0, 7) === nowM).reduce((a, x) => a + x.amount, 0))} />
            <KV l="إجمالي المصاريف" v={money(tot)} />
            {kmR > 0 && (
              <>
                <KV l="مسافة اتقطعت (من العداد)" v={`${kmR.toLocaleString('ar-EG')} كم`} />
                <KV l="تكلفة الكيلو" v={money(tot / kmR)} />
              </>
            )}
            {lit > 0 && kmR > 0 && <KV l="استهلاك البنزين" v={`${(kmR / lit).toFixed(1)} كم/لتر`} />}
            {[...byK]
              .sort((a, b) => b[1] - a[1])
              .map(([k, a]) => (
                <KV key={k} l={k} v={money(a)} />
              ))}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>كل مصروف بيتسجل تلقائي في مصروفات هيدرولك.</div>
          </Card>
          <CarMeta key={v.id} v={v} />
          <Card>
            <b>مصروف / تشغيل جديد</b>
            <Sel label="النوع" value={f.kind} onChange={(x) => setF({ ...f, kind: x })}>
              {VEHICLE_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Sel>
            <Field label="المبلغ (ج)" inputMode="decimal" value={f.a} onChange={(x) => setF({ ...f, a: x })} />
            <Field label="قراءة العداد (كم) — اختياري" inputMode="decimal" value={f.km} onChange={(x) => setF({ ...f, km: x })} />
            <Field label="لترات (للبنزين) — اختياري" inputMode="decimal" value={f.l} onChange={(x) => setF({ ...f, l: x })} />
            <Field label="التاريخ" type="date" value={f.d} onChange={(x) => setF({ ...f, d: x })} />
            <Field label="ملاحظة" value={f.n} onChange={(x) => setF({ ...f, n: x })} />
            <Btn
              pri
              disabled={log.isPending}
              onClick={async () => {
                if (!(num(f.a) > 0)) return toast('اكتب المبلغ', 'bad');
                try {
                  await log.mutateAsync({ id: v.id, input: { kind: f.kind, amount: num(f.a), km: f.km === '' ? null : num(f.km), liters: f.l === '' ? null : num(f.l), date: f.d || today(), note: f.n.trim() } });
                  setF({ ...f, a: '', km: '', l: '', n: '' });
                  toast('اتسجل');
                } catch (e) {
                  toast(`⚠️ ${errorMessage(e)}`, 'bad');
                }
              }}
            >
              تسجيل
            </Btn>
          </Card>
          <Card>
            <b>آخر الحركات</b>
            {lg.length ? (
              lg.slice(0, 25).map((x) => (
                <KV
                  key={x.id}
                  l={
                    <>
                      {x.date} — {x.kind}
                      {x.km !== null && <small style={{ color: 'var(--muted)' }}> {x.km} كم</small>}
                      {x.note && (
                        <>
                          <br />
                          <small style={{ color: 'var(--muted)' }}>{x.note}</small>
                        </>
                      )}
                    </>
                  }
                  v={
                    <>
                      {money(x.amount)}
                      {admin && (
                        <button type="button" onClick={() => window.confirm('تمسح الحركة ومصروفها؟') && delLog.mutateAsync(x.id).then(() => toast('اتمسحت'), (e) => toast(errorMessage(e), 'bad'))} style={{ border: 0, background: 'transparent', color: 'var(--danger)' }}>
                          🗑️
                        </button>
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
      ) : (
        <Card>مفيش سيارة متسجلة. ضيف أول سيارة تحت.</Card>
      )}
      {admin && (
        <Card>
          <b>سيارة جديدة</b>
          <Field label="الاسم / الموديل" value={nv.n} onChange={(x) => setNv({ ...nv, n: x })} />
          <Field label="رقم اللوحة" value={nv.p} onChange={(x) => setNv({ ...nv, p: x })} />
          <Btn
            pri={!V.length}
            onClick={async () => {
              if (!nv.n.trim()) return toast('اكتب اسم السيارة', 'bad');
              try {
                await addV.mutateAsync({ name: nv.n.trim(), plate: nv.p.trim() });
                setNv({ n: '', p: '' });
                toast('اتضافت');
              } catch (e) {
                toast(errorMessage(e), 'bad');
              }
            }}
          >
            إضافة السيارة
          </Btn>
        </Card>
      )}
    </>
  );
}

// ---------- 📑 ----------

const CTST = { open: ['مفتوح', '#2563eb'], work: ['جاري الشغل', '#d97706'], done: ['اتسلم / خلص', '#15803d'], cancel: ['ملغي', '#9ca3af'] } as const;
const MT = { cash: 'كاش', transfer: 'تحويل', check: 'شيك' } as const;
const ctSum = (c: ContractDto) => {
  const paid = c.pays.reduce((a, p) => a + p.amt, 0);
  const cost = c.costs.reduce((a, x) => a + x.amt, 0);
  return { paid, cost, tot: c.total, rem: c.total - paid, profit: c.total - cost, held: paid - cost };
};
const ctLate = (c: ContractDto) => (c.status === 'open' || c.status === 'work') && !!c.due && c.due < today();

function NewContract({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateContract();
  const [f, setF] = useState({ client: '', phone: '', kind: CONTRACT_KINDS[0] as string, title: '', total: '', deposit: '', method: 'cash', record: true, start: today(), due: '', note: '' });
  const cust = useContacts({ type: 'CUSTOMER', q: f.client.trim() || undefined, pageSize: 20 });
  return (
    <Sheet title="📑 عقد / عربون جديد" onClose={onClose}>
      <Field label="اسم العميل / الورشة" value={f.client} onChange={(x) => setF({ ...f, client: x })} list="ctCl" autoComplete="off" />
      <datalist id="ctCl">{cust.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <Field label="التليفون" type="tel" value={f.phone} onChange={(x) => setF({ ...f, phone: x })} />
      <Sel label="النوع" value={f.kind} onChange={(x) => setF({ ...f, kind: x })}>
        <option value="عقد شغل">عقد شغل</option>
        <option value="عربون">عربون على أوردر</option>
        <option value="مقدم">شغل مدفوع مقدمًا</option>
      </Sel>
      <Area label="الشغل المطلوب (تفاصيل كاملة)" value={f.title} onChange={(x) => setF({ ...f, title: x })} />
      <Field label="قيمة العقد الكلية" inputMode="decimal" value={f.total} onChange={(x) => setF({ ...f, total: x })} />
      <Field label="المدفوع دلوقتي (عربون / مقدم)" inputMode="decimal" value={f.deposit} onChange={(x) => setF({ ...f, deposit: x })} />
      <Sel label="طريقة الدفع" value={f.method} onChange={(x) => setF({ ...f, method: x })}>
        {Object.entries(MT).map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </Sel>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--card,#fff)', border: '1px solid var(--border)' }}>
        <input type="checkbox" checked={f.record} onChange={(e) => setF({ ...f, record: e.target.checked })} style={{ width: 22, height: 22 }} /> سجّل المدفوع في الخزنة وحساب العميل (يتخصم من أي فاتورة بعدين)
      </label>
      <Field label="تاريخ البداية" type="date" value={f.start} onChange={(x) => setF({ ...f, start: x })} />
      <Field label="ميعاد التسليم" type="date" value={f.due} onChange={(x) => setF({ ...f, due: x })} />
      <Area label="ملاحظات" value={f.note} onChange={(x) => setF({ ...f, note: x })} />
      <button
        type="button"
        disabled={create.isPending}
        onClick={async () => {
          if (!f.client.trim()) return toast('اكتب اسم العميل', 'bad');
          if (!f.title.trim()) return toast('اكتب الشغل المطلوب', 'bad');
          if (!(num(f.total) > 0) && !(num(f.deposit) > 0)) return toast('اكتب قيمة العقد أو العربون', 'bad');
          try {
            const c = await create.mutateAsync({ ...f, client: f.client.trim(), title: f.title.trim(), total: num(f.total), deposit: num(f.deposit) });
            onClose();
            toast(`✔ اتسجل ${c.no}`);
          } catch (e) {
            toast(`⚠️ ${errorMessage(e)}`, 'bad');
          }
        }}
        style={{ width: '100%', padding: 18, borderRadius: 14, fontWeight: 800, fontSize: 19, marginTop: 16, background: 'var(--green,#15803d)', color: '#fff', border: 0 }}
      >
        💾 حفظ العقد
      </button>
    </Sheet>
  );
}

function ContractSheet({ c, onClose }: { c: ContractDto; onClose: () => void }) {
  const toast = useToast();
  const act = useContractAction();
  const orders = useFieldOrders().data ?? [];
  const [p, setP] = useState({ a: '', m: 'cash', n: '', r: true });
  const [cost, setCost] = useState({ a: '', d: '' });
  const [lo, setLo] = useState('');
  const [due, setDue] = useState(c.due);
  const t = ctSum(c);
  const oo = orders.filter((o) => o.customer === c.client && !c.orders.includes(o.no));
  const run = (action: unknown, ok: string) =>
    act.mutateAsync({ id: c.id, action }).then(
      () => toast(ok),
      (e) => toast(`⚠️ ${errorMessage(e)}`, 'bad'),
    );
  return (
    <Sheet title={`📑 ${c.no} — ${c.client}`} onClose={onClose}>
      <div>
        <Chip t={CTST[c.status][0]} c={CTST[c.status][1]} />
        {ctLate(c) && <Chip t="⏰ متأخر" c="#dc2626" />}
        {c.phone && (
          <a href={`tel:${c.phone}`} dir="ltr" style={{ marginRight: 8 }}>
            {c.phone}
          </a>
        )}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 8, lineHeight: 1.8 }}>{c.title}</div>
      {c.note && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: 13 }}>📝 {c.note}</div>}
      <Card>
        <KV l="قيمة العقد" v={money(t.tot)} />
        <KV l="اتحصّل" v={money(t.paid)} />
        <KV l="المتبقي على العميل" v={money(Math.max(0, t.rem))} />
        <KV l="صرفنا على الشغل" v={money(t.cost)} />
        <KV l="الربح المتوقع" v={money(t.profit)} />
        <KV l="عرابين لسه معانا" v={money(t.held)} />
        <KV l="البداية / التسليم" v={`${c.start || '—'} ← ${c.due || '—'}`} />
      </Card>
      <b>💵 الدفعات</b>
      {c.pays.length ? (
        c.pays.map((x) => (
          <div key={x.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
            {x.date} — <b>{money(x.amt)}</b> <Chip t={MT[x.m as keyof typeof MT] ?? x.m} c="#0891b2" />
            {x.rec && <Chip t="اتسجل في الخزنة" c="#15803d" />}
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {x.note} — {x.by}
            </div>
          </div>
        ))
      ) : (
        <div className="empty">مفيش دفعات.</div>
      )}
      <Field label="دفعة جديدة (مبلغ)" inputMode="decimal" value={p.a} onChange={(x) => setP({ ...p, a: x })} />
      <Sel label="الطريقة" value={p.m} onChange={(x) => setP({ ...p, m: x })}>
        {Object.entries(MT).map(([k, tt]) => (
          <option key={k} value={k}>
            {tt}
          </option>
        ))}
      </Sel>
      <Field label="ملاحظة الدفعة" value={p.n} onChange={(x) => setP({ ...p, n: x })} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input type="checkbox" checked={p.r} onChange={(e) => setP({ ...p, r: e.target.checked })} style={{ width: 22, height: 22 }} /> سجّلها في الخزنة وحساب العميل
      </label>
      <Btn pri col="var(--green,#15803d)" onClick={() => (num(p.a) > 0 ? run({ do: 'pay', amount: num(p.a), method: p.m, note: p.n.trim(), record: p.r }, '✔ اتسجلت الدفعة').then(() => setP({ a: '', m: 'cash', n: '', r: true })) : toast('اكتب المبلغ', 'bad'))}>
        ➕ سجّل الدفعة
      </Btn>
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--border)' }} />
      <b>🧾 تكلفة الشغل (اللي صرفناه عليه)</b>
      {c.costs.length ? (
        c.costs.map((x) => (
          <div key={x.id} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
            {x.date} — <b>{money(x.amt)}</b> {x.desc}
          </div>
        ))
      ) : (
        <div className="empty">مفيش.</div>
      )}
      <Field label="مبلغ التكلفة" inputMode="decimal" value={cost.a} onChange={(x) => setCost({ ...cost, a: x })} />
      <Field label="على إيه (خامات / مصنعية / نقل...)" value={cost.d} onChange={(x) => setCost({ ...cost, d: x })} />
      <Btn onClick={() => (num(cost.a) > 0 ? run({ do: 'cost', amount: num(cost.a), desc: cost.d.trim() }, '✔ اتسجلت').then(() => setCost({ a: '', d: '' })) : toast('اكتب مبلغ التكلفة', 'bad'))}>➕ سجّل التكلفة</Btn>
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--border)' }} />
      <b>📦 أوردرات مربوطة</b>
      {c.orders.length ? (
        c.orders.map((n) => {
          const o = orders.find((x) => x.no === n);
          return (
            <div key={n} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
              {n}
              {o && <Chip t={{ new: 'جديد', doing: 'جاري', done: 'اتنفذ', cancel: 'ملغي' }[o.status]} c="#2563eb" />}
            </div>
          );
        })
      ) : (
        <div className="empty">مفيش.</div>
      )}
      {oo.length > 0 && (
        <>
          <Sel label="اربط أوردر للعميل ده" value={lo} onChange={setLo}>
            <option value="">— اختار —</option>
            {oo.slice(0, 40).map((o) => (
              <option key={o.id} value={o.no}>
                {o.no} — {ago(o.createdAt)}
              </option>
            ))}
          </Sel>
          <Btn onClick={() => (lo ? run({ do: 'link', order: lo }, '✔ اتربط') : toast('اختار الأوردر', 'bad'))}>🔗 اربط</Btn>
        </>
      )}
      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--border)' }} />
      <b>الحالة</b>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {(Object.keys(CTST) as (keyof typeof CTST)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => (k !== 'cancel' || window.confirm('تلغي العقد ده؟')) && run({ do: 'status', status: k }, '✔')}
            style={{ flex: 1, minWidth: '46%', padding: '14px 4px', borderRadius: 12, fontWeight: 800, border: `2px solid ${CTST[k][1]}`, background: c.status === k ? CTST[k][1] : 'transparent', color: c.status === k ? '#fff' : CTST[k][1] }}
          >
            {CTST[k][0]}
          </button>
        ))}
      </div>
      <Field label="ميعاد التسليم (تعديل)" type="date" value={due} onChange={setDue} />
      <Btn onClick={() => run({ do: 'due', due }, '✔ اتحفظ')}>💾 حفظ الميعاد</Btn>
      <Btn
        onClick={() =>
          window.open(
            `https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent(`عقد رقم ${c.no} — هيدرولك\nالعميل: ${c.client}\nالشغل: ${c.title}\nقيمة العقد: ${money(t.tot)}\nاتدفع: ${money(t.paid)}\nالمتبقي: ${money(Math.max(0, t.rem))}${c.due ? `\nميعاد التسليم: ${c.due}` : ''}\nشكرًا لتعاملكم معانا`)}`,
            '_blank',
          )
        }
      >
        📲 ابعت ملخص للعميل واتساب
      </Btn>
      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        <b>السجل:</b>
        {[...c.hist]
          .reverse()
          .slice(0, 12)
          .map((h, i) => (
            <div key={i}>
              {h.at.slice(0, 16).replace('T', ' ')} — {h.by}: {h.txt}
            </div>
          ))}
      </div>
    </Sheet>
  );
}

export function CtTab() {
  const list = useContracts();
  const [st, setSt] = useState<'live' | 'late' | 'done' | 'cancel' | 'all'>('live');
  const [q, setQ] = useState('');
  const [newOpen, setNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const all = list.data ?? [];
  const live = all.filter((c) => c.status === 'open' || c.status === 'work');
  const T = live.map(ctSum);
  const sum = (f: (t: ReturnType<typeof ctSum>) => number) => T.reduce((a, t) => a + f(t), 0);
  const W = q.trim().split(/\s+/).filter(Boolean);
  const L = all
    .filter((c) => (st === 'live' ? c.status === 'open' || c.status === 'work' : st === 'late' ? ctLate(c) : st === 'all' ? true : c.status === st))
    .filter((c) => !W.length || W.every((w) => [c.no, c.client, c.phone, c.title].join(' ').includes(w)))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const cur = all.find((c) => c.id === openId);
  return (
    <>
      {list.isError && (
        <Card>
          <b style={{ color: 'var(--danger)' }}>⚠️ {errorMessage(list.error)}</b>
        </Card>
      )}
      <button type="button" onClick={() => setNew(true)} style={{ width: '100%', padding: 22, borderRadius: 18, fontWeight: 800, fontSize: 21, marginTop: 10, background: 'var(--blue)', color: '#fff', border: 0 }}>
        📑 عقد / عربون جديد
      </button>
      <Card>
        <b>الملخص (العقود الشغالة: {live.length})</b>
        <KV l="إجمالي قيمة العقود" v={money(sum((t) => t.tot))} />
        <KV l="اتحصّل" v={money(sum((t) => t.paid))} />
        <KV l="متبقي على العملاء" v={money(sum((t) => Math.max(0, t.rem)))} />
        <KV l="صرفنا عليهم (تكلفة)" v={money(sum((t) => t.cost))} />
        <KV l="فلوس عملاء لسه معانا (عرابين − تكلفة)" v={money(sum((t) => t.held))} />
        <KV l="متأخرين عن ميعاد التسليم" v={live.filter(ctLate).length} />
      </Card>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {(
          [
            ['live', 'شغالة'],
            ['late', 'متأخرة'],
            ['done', 'خلصت'],
            ['cancel', 'ملغية'],
            ['all', 'الكل'],
          ] as const
        ).map(([k, n]) => (
          <button key={k} type="button" onClick={() => setSt(k)} style={{ flex: 1, padding: '12px 2px', borderRadius: 12, fontWeight: 800, fontSize: 14, border: `2px solid ${st === k ? 'var(--blue)' : 'var(--border)'}`, background: st === k ? 'var(--blue)' : 'transparent', color: st === k ? '#fff' : 'inherit' }}>
            {n}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input placeholder="🔍 عميل / رقم عقد / شغل..." value={q} onChange={(e) => setQ(e.target.value)} style={{ ...IN, margin: 0, flex: 1, minWidth: 0 }} />
        <button
          type="button"
          onClick={() =>
            csvSave(`contracts-${today()}.csv`, ['الرقم', 'العميل', 'التليفون', 'النوع', 'الشغل', 'القيمة', 'اتحصّل', 'المتبقي', 'التكلفة', 'الحالة', 'البداية', 'التسليم'], L.map((c) => {
              const t = ctSum(c);
              return [c.no, c.client, c.phone, c.kind, c.title, t.tot, t.paid, t.rem, t.cost, CTST[c.status][0], c.start, c.due];
            }))
          }
          style={{ flex: 'none', padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card,#fff)', color: 'inherit', fontWeight: 800 }}
        >
          ⬇️ تصدير
        </button>
      </div>
      {L.length ? (
        L.map((c) => {
          const t = ctSum(c);
          return (
            <div key={c.id} onClick={() => setOpenId(c.id)} style={{ background: 'var(--card,#fff)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, margin: '10px 0', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>
                  {c.no} — {c.client}
                </b>
                <b>{money(t.tot)}</b>
              </div>
              <div style={{ fontSize: 14, marginTop: 2 }}>{c.title}</div>
              <div>
                <Chip t={CTST[c.status][0]} c={CTST[c.status][1]} />
                {ctLate(c) && <Chip t="⏰ متأخر" c="#dc2626" />}
                <Chip t={`اتحصّل ${money(t.paid)}`} c="#15803d" />
                {t.rem > 0.5 && <Chip t={`متبقي ${money(t.rem)}`} c="#d97706" />}
                {c.due && <Chip t={`📅 ${c.due}`} c="#0891b2" />}
              </div>
            </div>
          );
        })
      ) : (
        <Card>
          <div className="empty">مفيش عقود بالفلتر ده.</div>
        </Card>
      )}
      {newOpen && <NewContract onClose={() => setNew(false)} />}
      {cur && <ContractSheet c={cur} onClose={() => setOpenId(null)} />}
    </>
  );
}

// ---------- 📲 ----------

const waFmt = (p: string) => {
  const d = waNum(p);
  return d.startsWith('20') ? `0${d.slice(2)}` : d;
};

export function WaTab() {
  const toast = useToast();
  const admin = useIsAdmin();
  const me = useMe().data;
  const data = useAlerts();
  const save = useSaveAlerts();
  const send = useWaSend();
  const rules = useHyRules().data;
  const saveRules = useSaveHyRules();
  const orders = (useFieldOrders().data ?? []).filter((o) => o.lines.length && (o.status === 'new' || o.status === 'doing')).slice(0, 15);
  const [to, setTo] = useState<string | null>(null);
  const [on, setOn] = useState<boolean | null>(null);
  const [fOn, setFOn] = useState<boolean | null>(null);
  const [st, setSt] = useState('');
  const [rep, setRep] = useState({ n: '', p: '' });
  const [ms, setMs] = useState({ r: '0', o: '', m: '' });
  const A = data.data?.alerts;
  const R = rules?.reps ?? [];
  if (!A) return <Card>{data.isError ? errorMessage(data.error) : <div className="empty">بيحمّل...</div>}</Card>;
  const stc = (x: string) => (x === 'sent' ? ['✔ اتبعت', '#15803d'] : x === 'failed' ? ['✘ ماتبعتش', '#dc2626'] : ['⏳ مستني الجسر', '#d97706']);
  return (
    <>
      <Card>
        <b>📲 مين بيستلم أوردرات الميدان؟</b>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0', lineHeight: 1.9 }}>أول ما مندوب يبعت أوردر فيه حاجة مطلوبة من المخزن، السيرفر بيبعت رسالة واتساب للأرقام دي.</div>
        <Area label="أرقام الاستلام (سطر لكل رقم)" value={to ?? A.to.map(waFmt).join('\n')} onChange={setTo} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 15 }}>
          <input type="checkbox" checked={on ?? A.on !== false} onChange={(e) => setOn(e.target.checked)} style={{ width: 24, height: 24 }} /> التنبيهات شغّالة
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 15 }}>
          <input type="checkbox" checked={fOn ?? A.types.field !== false} onChange={(e) => setFOn(e.target.checked)} style={{ width: 24, height: 24 }} /> ابعت أوردرات الميدان
        </label>
        {admin ? (
          <Btn
            pri
            onClick={async () => {
              const list = [...new Set((to ?? A.to.join('\n')).split(/[\n,،/]+/).map(waNum).filter((x) => x.length >= 11))];
              if (!list.length) return toast('اكتب رقم واحد على الأقل', 'bad');
              try {
                await save.mutateAsync({ on: on ?? A.on !== false, to: list, types: { ...A.types, field: fOn ?? A.types.field !== false } });
                setTo(null);
                toast('✔ اتحفظت الأرقام');
              } catch (e) {
                toast(errorMessage(e), 'bad');
              }
            }}
          >
            حفظ الأرقام
          </Btn>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>التعديل للمدير بس.</div>
        )}
        <Btn
          onClick={async () => {
            try {
              for (const t of A.to.length ? A.to : ['201119199659']) await send.mutateAsync({ to: t, body: '🧪 تجربة من هيدرولك — لو وصلتك الرسالة دي يبقى الجسر شغّال ✅', byName: '🧪 تجربة' });
              setSt('⏳ بعتّ رسالة تجربة… مستني الجسر — اضغط «↻ تحديث» بعد شوية تشوف حالتها تحت.');
            } catch (e) {
              toast(errorMessage(e), 'bad');
            }
          }}
        >
          🧪 ابعت رسالة تجربة وتأكد إن الجسر شغّال
        </Btn>
        {st && <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--tint,#e3f2f3)', lineHeight: 1.8 }}>{st}</div>}
      </Card>
      <Card>
        <b>🛵 المناديب والعربية</b>
        <div style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0', lineHeight: 1.9 }}>سجّل أرقام المناديب والسواقين، وابعتلهم أي أوردر أو رسالة بضغطة. بتتبعت من رقم الشركة عن طريق الجسر.</div>
        {R.length ? (
          R.map((r, i) => (
            <KV
              key={i}
              l={
                <>
                  {r.n}
                  <br />
                  <small style={{ color: 'var(--muted)' }}>{waFmt(r.p)}</small>
                </>
              }
              v={
                admin ? (
                  <button type="button" onClick={() => window.confirm('تشيله؟') && saveRules.mutateAsync({ reps: R.filter((_, k) => k !== i) }).then(() => toast('اتشال'))} style={{ border: 0, background: 'transparent', color: 'var(--danger)', fontSize: 22, minWidth: 44, minHeight: 44 }}>
                    🗑️
                  </button>
                ) : (
                  ''
                )
              }
            />
          ))
        ) : (
          <div className="empty">مفيش مناديب متسجلين.</div>
        )}
        <Field label="اسم المندوب / السواق" value={rep.n} onChange={(x) => setRep({ ...rep, n: x })} />
        <Field label="رقمه" type="tel" value={rep.p} onChange={(x) => setRep({ ...rep, p: x })} />
        {admin && (
          <Btn
            onClick={async () => {
              const p = waNum(rep.p);
              if (!rep.n.trim() || p.length < 11) return toast('اكتب الاسم والرقم صح', 'bad');
              await saveRules.mutateAsync({ reps: [...R, { n: rep.n.trim(), p }] });
              setRep({ n: '', p: '' });
              toast('✔ اتضاف');
            }}
          >
            ➕ ضيف
          </Btn>
        )}
      </Card>
      {R.length > 0 && (
        <Card>
          <b>📤 ابعت لمندوب</b>
          <Sel label="لمين" value={ms.r} onChange={(x) => setMs({ ...ms, r: x })}>
            {R.map((r, i) => (
              <option key={i} value={i}>
                {r.n}
              </option>
            ))}
          </Sel>
          <Sel
            label="أوردر (اختياري)"
            value={ms.o}
            onChange={(x) => {
              const o = orders.find((y) => y.id === x);
              setMs({ ...ms, o: x, ...(o ? { m: waText(o) } : {}) });
            }}
          >
            <option value="">— رسالة حرة —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.no} — {o.customer}
              </option>
            ))}
          </Sel>
          <Area label="الرسالة" value={ms.m} onChange={(x) => setMs({ ...ms, m: x })} />
          <Btn
            pri
            onClick={async () => {
              const r = R[num(ms.r)];
              if (!r) return toast('اختار المندوب', 'bad');
              if (!ms.m.trim()) return toast('اكتب الرسالة', 'bad');
              try {
                await send.mutateAsync({ to: r.p, body: ms.m.trim(), byName: `📲 ${me?.name ?? ''} ← ${r.n}` });
                setMs({ ...ms, m: '' });
                toast('✔ في الطريق للمندوب');
              } catch (e) {
                toast(errorMessage(e), 'bad');
              }
            }}
          >
            📤 ابعت
          </Btn>
        </Card>
      )}
      <Card>
        <b>آخر الرسائل اللي عدّت على الجسر</b>
        {data.data!.outbox.length ? (
          data.data!.outbox.map((x) => {
            const c = stc(x.status);
            return (
              <div key={x.id} style={{ borderTop: '1px dashed var(--border)', padding: '8px 0', fontSize: 13 }}>
                <span style={{ color: c[1], fontWeight: 800 }}>{c[0]}</span> — {waFmt(x.toPhone)}{' '}
                <small style={{ color: 'var(--muted)' }}>
                  {ago(x.createdAt)} — {x.byName}
                </small>
                <div style={{ whiteSpace: 'pre-line', color: 'var(--muted)', maxHeight: 64, overflow: 'hidden' }}>{x.body.slice(0, 160)}</div>
                {x.err && <div style={{ color: 'var(--danger)' }}>{x.err}</div>}
              </div>
            );
          })
        ) : (
          <div className="empty">لسه مفيش.</div>
        )}
        <Btn onClick={() => data.refetch()}>↻ تحديث</Btn>
      </Card>
    </>
  );
}

// ---------- 🎨 ----------

export function IdTab() {
  const toast = useToast();
  const admin = useIsAdmin();
  const id = useIdent().data;
  const save = useSaveIdent();
  const [v, setV] = useState<Record<'MK' | 'HY', CoIdent> | null>(null);
  const cur = v ?? id;
  if (!cur) return <Card>⏳</Card>;
  const set = (c: 'MK' | 'HY', p: Partial<CoIdent>) => setV({ ...cur, [c]: { ...cur[c], ...p } });
  return (
    <>
      {(['MK', 'HY'] as const).map((c) => {
        const i = cur[c];
        return (
          <Card key={c}>
            <b style={{ color: i.color }}>
              {c === 'MK' ? '🏬' : '🔧'} {CO_NAME[c]}
            </b>
            <Field label="الاسم اللي يظهر على الفاتورة والملصق" value={i.name} onChange={(x) => set(c, { name: x })} />
            <Field label="التليفون (اختياري)" type="tel" value={i.phone} onChange={(x) => set(c, { phone: x })} />
            <Field label="واتساب الشركة (للرسائل)" type="tel" value={i.wa} onChange={(x) => set(c, { wa: x })} />
            <Field label="العنوان على الفاتورة (فاضي = العنوان العام)" value={i.addr} onChange={(x) => set(c, { addr: x })} />
            <Field label="الرقم الضريبي (اختياري)" value={i.tax} onChange={(x) => set(c, { tax: x })} />
            <Field label="جملة آخر الرسائل (مثلاً: شكرًا لتعاملكم)" value={i.foot} onChange={(x) => set(c, { foot: x })} />
            <Field label="اللون" type="color" value={i.color} onChange={(x) => set(c, { color: x })} style={{ ...IN, height: 54, padding: 4 }} />
          </Card>
        );
      })}
      {admin && (
        <Btn pri disabled={save.isPending} onClick={() => save.mutateAsync(cur).then(() => (setV(null), toast('اتحفظت')), (e) => toast(errorMessage(e), 'bad'))}>
          حفظ الهوية
        </Btn>
      )}
      <Card>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>الفواتير والملصقات بتاخد اسم ولون الشركة صاحبة الحركة. فاتورة هيدرولك مابتظهرش فيها شعار ميكانيزم.</div>
      </Card>
    </>
  );
}
