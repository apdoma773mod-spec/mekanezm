'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContactDto, ProductDto } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { waNum } from '@/components/hy/ui';
import { useModal } from '@/components/modals/modal-host';
import { HtmlPreview } from '@/components/ui/html-preview';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { useKv } from '@/lib/kv';
import { printHtml } from '@/lib/print';
import { useAllContacts, useAllProductInfo, useAllProducts, useUpdateProduct } from '@/lib/trade-queries';
import { fetchSite } from '@/lib/web-queries';

/** 📈 تحليلات ذكية للمدير (biz القديمة): كل التبويبات بنفس الترتيب والكلام. */
const DAY = 864e5;
const N = (n: number) => (Math.round((+n || 0) * 100) / 100).toLocaleString('ar-EG');
const ago = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / DAY);
const shop = 'ميكانيزم';

const TABS = [
  ['dead', '🧊 بضاعة راكدة'],
  ['abc', '🏆 الأصناف المهمة (ABC)'],
  ['fc', '⏳ هيخلص قريب'],
  ['res', '📌 الحجوزات'],
  ['kits', '🎁 كومبو'],
  ['usd', '💵 الدولار والاستيراد'],
  ['plist', '🏷️ قوائم أسعار'],
  ['credit', '🚦 حد الآجل'],
  ['follow', '⭐ متابعة بعد البيع'],
  ['lapsed', '😴 عملاء غايبين'],
  ['points', '⭐ نقاط الصنايعية'],
  ['sup', '⚖️ مقارنة الموردين'],
  ['cat', '📖 كتالوج'],
  ['log', '🕵️ سجل العمليات'],
] as const;
type Tab = (typeof TABS)[number][0];

const Note = ({ children }: { children: ReactNode }) => <p className="bz-note">{children}</p>;
const Cards = ({ children }: { children: ReactNode }) => <div className="bz-cards">{children}</div>;
const Card = ({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) => (
  <div className="bz-card">
    <small>{label}</small>
    <b style={color ? { color } : undefined}>{value}</b>
    {sub && <small>{sub}</small>}
  </div>
);
const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

function WaBtn({ phone, text, label = '💬 واتساب' }: { phone: string; text: string; label?: string }) {
  const n = waNum(phone);
  if (!n) return <small style={{ color: '#7b8a90' }}>مفيش رقم</small>;
  return (
    <a className="secondary" style={{ textDecoration: 'none', padding: '6px 10px', borderRadius: 9, border: '1px solid var(--border,#ddd)', whiteSpace: 'nowrap', display: 'inline-block' }} target="_blank" rel="noopener" href={`https://wa.me/${n}?text=${encodeURIComponent(text)}`}>
      {label}
    </a>
  );
}

/** معاينة جوه السيستم: نافذة فيها الورقة وزرار طباعة / PDF. */
function PrintPreview({ html, title, onClose }: { html: string; title: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} wide>
      <HtmlPreview html={html} />
      <div className="modal-foot">
        <button type="button" className="primary" onClick={() => printHtml(html)}>
          🖨️ طباعة / PDF
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          رجوع
        </button>
      </div>
    </Modal>
  );
}

function DaysSel({ value, opts, onChange }: { value: number; opts: number[]; onChange: (n: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: 'auto' }}>
      {opts.map((d) => (
        <option key={d} value={d}>
          {d} يوم
        </option>
      ))}
    </select>
  );
}

function useRows<T>(path: string, query?: Record<string, string | number>) {
  return useQuery({ queryKey: ['analytics', path, query], queryFn: ({ signal }) => api.get<T>(`/analytics/${path}`, query as Record<string, string>, signal), staleTime: 60_000 });
}

function Wait({ q, children }: { q: { isPending: boolean; isError: boolean; error: unknown; refetch?: () => unknown }; children: ReactNode }) {
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch?.()} />;
  return <>{children}</>;
}

// ───────────────────────── 🧊 راكد
function Dead() {
  const { open } = useModal();
  const [days, setDays] = useState(60);
  const q = useRows<{ rows: { id: string; name: string; code: string; unit: string; qty: number; last: string; val: number }[] }>('dead', { days });
  const R = q.data?.rows ?? [];
  const val = R.reduce((a, x) => a + x.val, 0);
  return (
    <Wait q={q}>
      <Note>
        أصناف عندك في المخزن ومااتباعش منها ولا حتة من <DaysSel value={days} opts={[30, 60, 90, 180]} onChange={setDays} />. دي فلوس نايمة — اعمل عليها عرض، أو حطها في كومبو مع صنف ماشي، أو ابعتها للصنايعية.
      </Note>
      <Cards>
        <Card label="عدد الأصناف الراكدة" value={R.length} />
        <Card label="فلوس نايمة في المخزن (بالتكلفة)" value={money(val)} />
      </Cards>
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الرصيد</th>
                <th>قيمته</th>
                <th>آخر بيع</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {R.slice(0, 200).map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                    <br />
                    <small style={{ color: '#7b8a90' }}>{x.code}</small>
                  </td>
                  <td>
                    {N(x.qty)} {x.unit}
                  </td>
                  <td>{money(x.val)}</td>
                  <td>
                    {x.last ? (
                      <>
                        {x.last} <small style={{ color: '#b33' }}>({ago(x.last)} يوم)</small>
                      </>
                    ) : (
                      <span style={{ color: '#b33' }}>عمره مااتباع</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="secondary" onClick={() => open({ kind: 'product', id: x.id })}>
                      فتح
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>👌 مفيش بضاعة راكدة في المدة دي.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 🏆 ABC
function Abc() {
  const q = useRows<{ rows: { id: string; name: string; qtyNow: number; min: number; sold: number; val: number; share: number; cls: 'A' | 'B' | 'C' }[] }>('abc');
  const R = q.data?.rows ?? [];
  const A = R.filter((x) => x.cls === 'A');
  const low = A.filter((x) => x.qtyNow <= Math.max(x.min, 1));
  return (
    <Wait q={q}>
      <Note>
        آخر ٩٠ يوم: الأصناف <span className="bz-tag bz-A">A</span> هي اللي بتجيبلك ٨٠٪ من فلوسك — دول ممنوع يخلصوا أبداً. <span className="bz-tag bz-B">B</span> متوسطين، و<span className="bz-tag bz-C">C</span> قليلين.
      </Note>
      <Cards>
        <Card label="أصناف A" value={A.length} sub={`من ${R.length} صنف اتباع`} />
        <Card label="⚠️ أصناف A قربت تخلص" value={low.length} color={low.length ? '#b33' : undefined} />
      </Cards>
      {low.length > 0 && (
        <div className="card" style={{ padding: 10, marginBottom: 10, border: '1px solid #f3c2c2' }}>
          <b>اطلب دول دلوقتي:</b> {low.map((x) => `${x.name} (${N(x.qtyNow)})`).join('، ')}
        </div>
      )}
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>الصنف</th>
                <th>اتباع</th>
                <th>القيمة</th>
                <th>النسبة</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {R.slice(0, 150).map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className={`bz-tag bz-${x.cls}`}>{x.cls}</span>
                  </td>
                  <td>{x.name}</td>
                  <td>{N(x.sold)}</td>
                  <td>{money(x.val)}</td>
                  <td>
                    <div className="bz-bar">
                      <i style={{ width: `${Math.max(3, Math.round((x.share / R[0]!.share) * 100))}%` }} />
                    </div>
                    <small>{(x.share * 100).toFixed(1)}%</small>
                  </td>
                  <td style={{ color: x.qtyNow <= Math.max(x.min, 0) ? '#b33' : 'inherit' }}>{N(x.qtyNow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>مفيش مبيعات آخر ٩٠ يوم.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── ⏳ هيخلص قريب
function Forecast() {
  const q = useRows<{ rows: { id: string; name: string; unit: string; qty: number; perDay: number; cover: number; order: number; supplier: string }[]; phones: Record<string, string> }>('forecast');
  const R = q.data?.rows ?? [];
  const by = new Map<string, typeof R>();
  R.forEach((x) => by.set(x.supplier, [...(by.get(x.supplier) ?? []), x]));
  return (
    <Wait q={q}>
      <Note>السيستم بيحسب متوسط بيع كل صنف في آخر ٣٠ يوم، ويقولك الرصيد هيكفي كام يوم. اللي تحت دول هيخلصوا خلال أسبوعين — والكمية المقترحة تكفي شهر. ومتقسمين على آخر مورد اشتريت منه عشان تبعتله الطلبية بضغطة.</Note>
      {R.length ? (
        [...by.entries()].map(([s, L]) => (
          <div key={s} className="card" style={{ padding: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b>🏭 {s}</b>
              {s !== '—' && <WaBtn phone={q.data?.phones[s] ?? ''} label="📲 ابعتله الطلبية" text={`السلام عليكم، محتاج الأصناف دي:\n${L.map((x) => `• ${x.name} — ${x.order} ${x.unit}`).join('\n')}\nوإمتى ممكن تتسلم؟ شكراً`} />}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>الرصيد</th>
                    <th>بيتباع في اليوم</th>
                    <th>هيكفي</th>
                    <th>اطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {L.map((x) => (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td>{N(x.qty)}</td>
                      <td>{N(x.perDay)}</td>
                      <td>
                        <b style={{ color: x.cover <= 3 ? '#b33' : x.cover <= 7 ? '#a66a00' : 'inherit' }}>{x.cover < 1 ? 'خلص تقريباً' : `${Math.round(x.cover)} يوم`}</b>
                      </td>
                      <td>
                        <b>{x.order}</b> {x.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <Empty>👌 مفيش صنف هيخلص خلال أسبوعين.</Empty>
      )}
    </Wait>
  );
}

const ProdList = ({ list }: { list: ProductDto[] }) => (
  <datalist id="bzPL">
    {list.slice(0, 3000).map((p) => (
      <option key={p.id} value={p.code}>
        {p.name}
      </option>
    ))}
  </datalist>
);
const CustList = ({ list }: { list: ContactDto[] }) => (
  <datalist id="bzCL">
    {list.map((c) => (
      <option key={c.id} value={c.name} />
    ))}
  </datalist>
);
const findProd = (list: ProductDto[], s: string) => {
  const t = s.trim();
  return list.find((p) => p.code === t || p.name === t);
};

// ───────────────────────── 📌 الحجوزات
interface Res {
  pid: string;
  name: string;
  qty: number;
  cust: string;
  phone: string;
  dep: number;
  until: string;
  at: string;
}
function Reservations() {
  const toast = useToast();
  const kv = useKv<Res[]>('reservations', []);
  const prods = useAllProducts({}).data ?? [];
  const custs = useAllContacts('CUSTOMER').data ?? [];
  const [f, setF] = useState({ p: '', q: '1', c: '', ph: '', d: '0', u: new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10) });
  const L = kv.value ?? [];
  const phoneOf = (n: string) => custs.find((c) => c.name === n)?.phone ?? '';
  const add = async () => {
    const p = findProd(prods, f.p);
    const q = +f.q || 0;
    if (!p) return toast('اختار الصنف بالكود', 'bad');
    if (q <= 0 || !f.c.trim()) return toast('اكتب الكمية واسم العميل', 'bad');
    await kv.save([...L, { pid: p.id, name: p.name, qty: q, cust: f.c.trim(), phone: f.ph.trim(), dep: +f.d || 0, until: f.u, at: new Date().toISOString().slice(0, 10) }]);
    toast('✔ اتحجز');
  };
  const del = async (i: number, ok: boolean) => {
    await kv.save(L.filter((_, k) => k !== i));
    toast(ok ? '✔ اتشال من الحجز — اعمل فاتورة البيع' : 'اتلغى الحجز');
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>عميل دفع عربون أو طلب يحجزله كمية؟ سجّلها هنا — والسيستم يوريك المتاح الحقيقي (الرصيد ناقص المحجوز) في شاشة المنتج ويفكّرك لما ميعاد الحجز يقرب.</Note>
      <ProdList list={prods} />
      <CustList list={custs} />
      <div className="form">
        <div className="field">
          <label>الصنف (الكود)</label>
          <input list="bzPL" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })} />
        </div>
        <div className="field">
          <label>الكمية</label>
          <input type="number" min={0} step="any" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <div className="field">
          <label>العميل</label>
          <input list="bzCL" value={f.c} onChange={(e) => setF({ ...f, c: e.target.value })} />
        </div>
        <div className="field">
          <label>الموبايل</label>
          <input dir="ltr" value={f.ph} onChange={(e) => setF({ ...f, ph: e.target.value })} />
        </div>
        <div className="field">
          <label>العربون</label>
          <input type="number" min={0} value={f.d} onChange={(e) => setF({ ...f, d: e.target.value })} />
        </div>
        <div className="field">
          <label>محجوز لحد</label>
          <input type="date" value={f.u} onChange={(e) => setF({ ...f, u: e.target.value })} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="primary" disabled={kv.saving} onClick={add}>
            📌 احجز
          </button>
        </div>
      </div>
      {L.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>العميل</th>
                <th>العربون</th>
                <th>لحد</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {L.map((r, i) => {
                const p = prods.find((x) => x.id === r.pid);
                const late = r.until < today;
                return (
                  <tr key={i}>
                    <td>
                      {p?.name ?? r.name}
                      <br />
                      <small style={{ color: (p?.qty ?? 0) < r.qty ? '#b33' : '#7b8a90' }}>الرصيد {N(p?.qty ?? 0)}</small>
                    </td>
                    <td>{N(r.qty)}</td>
                    <td>{r.cust}</td>
                    <td>{money(r.dep)}</td>
                    <td style={{ color: late ? '#b33' : 'inherit' }}>
                      {r.until}
                      {late ? ' ⚠️' : ''}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <WaBtn phone={r.phone || phoneOf(r.cust)} label="💬" text={`أهلاً يا ${r.cust} 👋\nحجزك (${p?.name ?? r.name} × ${r.qty}) جاهز في ${shop}، مستنيينك 🙏`} />
                        <button type="button" className="secondary" onClick={() => del(i, true)}>
                          ✔ اتسلم
                        </button>
                        <button type="button" className="secondary" onClick={() => del(i, false)}>
                          ✕ إلغاء
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>مفيش حجوزات.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 🎁 كومبو
interface Combo {
  name: string;
  price: number;
  items: { pid: string; q: number }[];
}
function Combos() {
  const toast = useToast();
  const kv = useKv<Combo[]>('combos', []);
  const prods = useAllProducts({}).data ?? [];
  const [n, setN] = useState('');
  const [pr, setPr] = useState('');
  const [lines, setLines] = useState('');
  const K = kv.value ?? [];
  const calc = (k: Combo) => {
    let cost = 0;
    let sep = 0;
    let can = Infinity;
    k.items.forEach((it) => {
      const p = prods.find((x) => x.id === it.pid);
      if (!p) {
        can = 0;
        return;
      }
      cost += (p.cost ?? 0) * it.q;
      sep += p.price * it.q;
      can = Math.min(can, Math.floor(p.qty / it.q));
    });
    return { cost, sep, can: can === Infinity ? 0 : can };
  };
  const text = (k: Combo) =>
    `🎁 ${k.name} من ${shop}\n${k.items.map((it) => {
      const p = prods.find((x) => x.id === it.pid);
      return p ? `• ${p.name} × ${it.q}` : '';
    }).filter(Boolean).join('\n')}\nسعر الطقم كله: ${k.price} ج بس 🔥\nللطلب ابعت هنا 🙏`;
  const add = async () => {
    const items: Combo['items'] = [];
    const bad: string[] = [];
    lines.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      const f = l.split(/[|،\t]/).map((s) => s.trim());
      const p = findProd(prods, f[0] ?? '');
      if (p) items.push({ pid: p.id, q: +(f[1] ?? 1) || 1 });
      else bad.push(f[0] ?? '');
    });
    if (!n.trim() || !items.length) return toast(`اكتب الاسم والأصناف${bad.length ? ` — مش لاقي: ${bad.join('، ')}` : ''}`, 'bad');
    await kv.save([...K, { name: n.trim(), price: +pr || 0, items }]);
    toast(`✔ اتحفظ${bad.length ? ` — مش لاقي: ${bad.join('، ')}` : ''}`);
    setN('');
    setPr('');
    setLines('');
  };
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>اعمل «كومبو» من كذا صنف بسعر واحد (مثلاً: طقم مطبخ = مفصلات + مجاري + مقابض). السيستم بيحسبلك تكلفته ومكسبك وكام طقم تقدر تبيع من الرصيد، وتبعته للصنايعية على الواتساب.</Note>
      <ProdList list={prods} />
      <div className="form">
        <div className="field">
          <label>اسم الكومبو</label>
          <input placeholder="طقم مطبخ ٣ متر" value={n} onChange={(e) => setN(e.target.value)} />
        </div>
        <div className="field">
          <label>سعر الكومبو</label>
          <input type="number" min={0} value={pr} onChange={(e) => setPr(e.target.value)} />
        </div>
        <div className="field full">
          <label>الأصناف — كل سطر: كود الصنف | الكمية</label>
          <textarea rows={4} placeholder={'P0012 | 20\nP0045 | 6'} value={lines} onChange={(e) => setLines(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="primary" onClick={add}>
            ➕ حفظ الكومبو
          </button>
        </div>
      </div>
      {K.length ? (
        K.map((k, i) => {
          const c = calc(k);
          return (
            <div key={i} className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>🎁 {k.name}</b>
                <span>
                  سعره <b>{money(k.price)}</b> · لو اتباع منفصل {money(c.sep)} · تكلفته {money(c.cost)} · <b style={{ color: '#087f8c' }}>مكسبك {money(k.price - c.cost)}</b> · متاح <b>{c.can}</b> طقم
                </span>
              </div>
              <div style={{ fontSize: 13, margin: '6px 0', lineHeight: 1.9 }}>
                {k.items.map((it) => {
                  const p = prods.find((x) => x.id === it.pid);
                  return p ? `${p.name} × ${it.q}` : '(صنف اتمسح)';
                }).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(text(k));
                    toast('اتنسخ — ابعته على الواتساب');
                  }}
                >
                  📋 نسخ رسالة للصنايعية
                </button>
                <button type="button" className="secondary" onClick={() => kv.save(K.filter((_, j) => j !== i))}>
                  ✕ حذف
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <Empty>لسه مفيش كومبو.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 💵 الدولار
interface Usd {
  rate: number;
  margin: number;
  items: Record<string, { usd: number; extra: number }>;
}
function UsdTab() {
  const toast = useToast();
  const kv = useKv<Usd>('usd', { rate: 50, margin: 30, items: {} });
  const prods = useAllProducts({}).data ?? [];
  const upd = useUpdateProduct();
  const U = kv.value ?? { rate: 50, margin: 30, items: {} };
  const [rate, setRate] = useState('');
  const [margin, setMargin] = useState('');
  const [f, setF] = useState({ p: '', u: '', e: '25' });
  useEffect(() => {
    if (kv.value) {
      setRate(String(kv.value.rate));
      setMargin(String(kv.value.margin));
    }
  }, [kv.value]);
  const rows = Object.entries(U.items)
    .map(([pid, v]) => {
      const p = prods.find((x) => x.id === pid);
      if (!p) return null;
      const land = Math.round(v.usd * U.rate * (1 + (+v.extra || 0) / 100) * 100) / 100;
      return { pid, p, v, land, sug: Math.ceil(land * (1 + (+U.margin || 0) / 100)) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const apply = async (pid: string) => {
    const list = pid === '*' ? rows : rows.filter((r) => r.pid === pid);
    let done = 0;
    for (const r of list) {
      try {
        await upd.mutateAsync({ id: r.pid, input: { cost: r.land, price: r.sug } });
        done++;
      } catch (e) {
        toast(`${r.p.name}: ${errorMessage(e)}`, 'bad');
      }
    }
    if (done) toast(`✔ اتحدث ${done} صنف (التكلفة والسعر)`);
  };
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>للبضاعة المستوردة: اكتب سعرها بالدولار ومصاريف الجمارك والشحن كنسبة، ولما الدولار يتغير غيّر السعر هنا بس — السيستم يحسب التكلفة الجديدة (Landed cost) والسعر المقترح بالمكسب اللي تحدده، وتطبقه بضغطة.</Note>
      <ProdList list={prods} />
      <div className="form">
        <div className="field">
          <label>سعر الدولار النهارده</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="field">
          <label>نسبة المكسب %</label>
          <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="primary" onClick={() => kv.save({ ...U, rate: +rate || U.rate, margin: +margin || 0 })}>
            حفظ وإعادة الحساب
          </button>
        </div>
      </div>
      <div className="form">
        <div className="field">
          <label>صنف (الكود)</label>
          <input list="bzPL" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })} />
        </div>
        <div className="field">
          <label>سعره بالدولار</label>
          <input type="number" step="0.01" value={f.u} onChange={(e) => setF({ ...f, u: e.target.value })} />
        </div>
        <div className="field">
          <label>جمارك وشحن ومصاريف %</label>
          <input type="number" value={f.e} onChange={(e) => setF({ ...f, e: e.target.value })} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const p = findProd(prods, f.p);
              const u = +f.u || 0;
              if (!p || u <= 0) return toast('اختار الصنف واكتب سعره بالدولار', 'bad');
              await kv.save({ ...U, items: { ...U.items, [p.id]: { usd: u, extra: +f.e || 0 } } });
              setF({ p: '', u: '', e: f.e });
            }}
          >
            ➕ ضيف
          </button>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>$</th>
                  <th>مصاريف</th>
                  <th>التكلفة الحالية</th>
                  <th>التكلفة الجديدة</th>
                  <th>السعر الحالي</th>
                  <th>المقترح</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.pid}>
                    <td>{x.p.name}</td>
                    <td>{x.v.usd}</td>
                    <td>{+x.v.extra || 0}%</td>
                    <td>{money(x.p.cost ?? 0)}</td>
                    <td>
                      <b style={{ color: x.land > (x.p.cost ?? 0) ? '#b33' : '#087f8c' }}>{money(x.land)}</b>
                    </td>
                    <td>{money(x.p.price)}</td>
                    <td>
                      <b>{money(x.sug)}</b>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="primary" disabled={upd.isPending} onClick={() => apply(x.pid)}>
                          طبّق
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            const { [x.pid]: _gone, ...rest } = U.items;
                            void kv.save({ ...U, items: rest });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="primary" disabled={upd.isPending} onClick={() => apply('*')}>
              ✔ طبّق على الكل
            </button>
          </div>
        </>
      ) : (
        <Empty>ضيف الأصناف المستوردة.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 🏷️ قوائم أسعار
interface PGroup {
  name: string;
  pct: number;
  members: string[];
}
const PL_DEFAULT: { groups: PGroup[] } = {
  groups: [
    { name: 'صنايعية', pct: -5, members: [] },
    { name: 'معارض وتجار', pct: -10, members: [] },
  ],
};
function PriceLists() {
  const toast = useToast();
  const kv = useKv<{ groups: PGroup[] }>('plists', PL_DEFAULT);
  const prods = useAllProducts({}).data ?? [];
  const custs = useAllContacts('CUSTOMER').data ?? [];
  const [G, setG] = useState<PGroup[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [view, setView] = useState<{ html: string; title: string } | null>(null);
  useEffect(() => {
    if (kv.value) {
      setG(kv.value.groups.map((g) => ({ ...g })));
      setMembers(kv.value.groups.map((g) => (g.members ?? []).join('\n')));
      setCats(kv.value.groups.map(() => ''));
    }
  }, [kv.value]);
  const allCats = useMemo(() => [...new Set(prods.map((p) => p.category || 'بدون تصنيف'))].sort(), [prods]);
  const collect = (): PGroup[] => G.map((g, i) => ({ name: g.name.trim() || 'مجموعة', pct: +g.pct || 0, members: (members[i] ?? '').split('\n').map((s) => s.trim()).filter(Boolean) }));
  const save = async (list = collect(), silent = false) => {
    await kv.save({ groups: list });
    if (!silent) toast('✔ اتحفظ');
  };
  const print = (i: number) => {
    const g = G[i]!;
    const cat = cats[i] ?? '';
    const P = prods
      .filter((p) => (!cat || (p.category || 'بدون تصنيف') === cat) && p.price > 0)
      .sort((a, b) => String(a.category).localeCompare(String(b.category)) || a.name.localeCompare(b.name));
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:Cairo,Tahoma,sans-serif;margin:0;color:#14262b}@page{size:A4;margin:12mm}.h{background:linear-gradient(120deg,#087f8c,#0b4e57);color:#fff;border-radius:14px;padding:16px 20px;border-bottom:5px solid #c9971f}.h h1{margin:0;font-size:26px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}th{background:#e3f4f5;color:#0b4e57;text-align:right;padding:7px}td{border-bottom:1px solid #e6eef0;padding:6px 7px}td.p{font-weight:900;color:#087f8c;white-space:nowrap}</style></head><body><div style="width:794px"><div class="h"><h1>${shop} — قايمة أسعار ${esc(g.name)}</h1><div>${cat ? `${esc(cat)} · ` : ''}${new Date().toLocaleDateString('ar-EG')} · الأسعار سارية لحد إشعار آخر</div></div><table><thead><tr><th>الكود</th><th>الصنف</th><th>التصنيف</th><th>الوحدة</th><th>السعر</th></tr></thead><tbody>${P.map((p) => `<tr><td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.category || '')}</td><td>${esc(p.unit || '')}</td><td class="p">${N(Math.round(p.price * (1 + (+g.pct || 0) / 100)))} ج</td></tr>`).join('')}</tbody></table></div></body></html>`;
    setView({ html, title: `قايمة أسعار ${g.name}` });
  };
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>كل مجموعة عملاء ليها نسبة على سعرك (الصنايعية −٥٪، المعارض −١٠٪…). اطبع لكل مجموعة قايمة أسعارها الخاصة PDF وابعتهالهم — ومن غير ما حد يعرف سعر التاني.</Note>
      <CustList list={custs} />
      {G.map((g, i) => (
        <div key={i} className="card" style={{ padding: 10, marginBottom: 8 }}>
          <div className="form">
            <div className="field">
              <label>اسم المجموعة</label>
              <input value={g.name} onChange={(e) => setG(G.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <div className="field">
              <label>النسبة على السعر % (سالب = خصم)</label>
              <input type="number" value={g.pct} onChange={(e) => setG(G.map((x, k) => (k === i ? { ...x, pct: +e.target.value } : x)))} />
            </div>
            <div className="field full">
              <label>الأعضاء (اسم في كل سطر)</label>
              <textarea rows={2} value={members[i] ?? ''} onChange={(e) => setMembers(members.map((m, k) => (k === i ? e.target.value : m)))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={cats[i] ?? ''} style={{ width: 'auto' }} onChange={(e) => setCats(cats.map((c, k) => (k === i ? e.target.value : c)))}>
              <option value="">كل التصنيفات</option>
              {allCats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="primary" onClick={() => print(i)}>
              🖨️ قايمة أسعار المجموعة
            </button>
            <button type="button" className="secondary" onClick={() => save(collect().filter((_, k) => k !== i), true)}>
              ✕
            </button>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="secondary" onClick={() => save([...collect(), { name: 'مجموعة جديدة', pct: 0, members: [] }], true)}>
          ➕ مجموعة جديدة
        </button>
        <button type="button" className="primary" disabled={kv.saving} onClick={() => save()}>
          💾 حفظ المجموعات
        </button>
      </div>
      {view && <PrintPreview html={view.html} title={view.title} onClose={() => setView(null)} />}
    </Wait>
  );
}

// ───────────────────────── 🚦 حد الآجل
interface Credit {
  def: number;
  lim: Record<string, number>;
}
function CreditTab() {
  const toast = useToast();
  const kv = useKv<Credit>('credit', { def: 0, lim: {} });
  const custs = useAllContacts('CUSTOMER').data ?? [];
  const C = kv.value ?? { def: 0, lim: {} };
  const [def, setDef] = useState('0');
  const [lim, setLim] = useState<Record<string, string>>({});
  useEffect(() => {
    if (kv.value) {
      setDef(String(kv.value.def || 0));
      setLim(Object.fromEntries(Object.entries(kv.value.lim).map(([k, v]) => [k, String(v)])));
    }
  }, [kv.value]);
  const L = custs.filter((c) => c.balance > 0 || C.lim[c.name]).sort((a, b) => b.balance - a.balance);
  const save = async () => {
    const out: Record<string, number> = {};
    Object.entries(lim).forEach(([k, v]) => {
      if (v !== '') out[k] = +v;
    });
    await kv.save({ def: +def || 0, lim: out });
    toast('✔ اتحفظ');
  };
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>حدد لكل عميل أقصى مبلغ يتسجل عليه آجل. أول ما تكتب اسمه في فاتورة البيع السيستم يوريك رصيده وحده، ويحمّر لو عدّى الحد — عشان الفلوس متتوهش برّه.</Note>
      <div className="form">
        <div className="field">
          <label>الحد الافتراضي لأي عميل (0 = مفيش حد)</label>
          <input type="number" value={def} onChange={(e) => setDef(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="primary" disabled={kv.saving} onClick={save}>
            💾 حفظ
          </button>
        </div>
      </div>
      {L.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>عليه</th>
                <th>الحد</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {L.map((c) => {
                const own = lim[c.name];
                const l = +(own !== undefined && own !== '' ? own : def) || 0;
                const over = l && c.balance > l;
                return (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>{money(c.balance)}</td>
                    <td>
                      <input type="number" style={{ width: 110 }} value={own ?? ''} placeholder={+def ? String(+def) : '—'} onChange={(e) => setLim({ ...lim, [c.name]: e.target.value })} />
                    </td>
                    <td>{!l ? '—' : over ? <span style={{ color: '#b33', fontWeight: 700 }}>🔴 عدّى الحد</span> : c.balance > l * 0.8 ? '🟡 قرب' : '🟢 تمام'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>مفيش عملاء عليهم فلوس.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── ⭐ متابعة بعد البيع
interface Follow {
  link: string;
  done: Record<string, string>;
}
function FollowTab() {
  const toast = useToast();
  const kv = useKv<Follow>('follow', { link: '', done: {} });
  const q = useRows<{ rows: { name: string; date: string; items: string[]; phone: string }[] }>('follow');
  const F = kv.value ?? { link: '', done: {} };
  const [link, setLink] = useState('');
  useEffect(() => {
    if (kv.value) setLink(kv.value.link ?? '');
  }, [kv.value]);
  const msg = (o: { name: string; items: string[] }) =>
    `أهلاً يا ${o.name} 👋\nإن شاء الله ${o.items.slice(0, 2).join(' و')} عجبك؟\nلو عندك أي ملاحظة إحنا موجودين 🙏${F.link ? `\nولو عجبتك خدمتنا، تقييمك على جوجل بيفرق معانا جداً ⭐:\n${F.link}` : ''}\n— ${shop}`;
  const R = q.data?.rows ?? [];
  return (
    <Wait q={q}>
      <Note>العملاء اللي اشتروا من ٥ لـ ٩ أيام: ابعتلهم رسالة «إيه رأيك؟» واطلب تقييم على جوجل — ده بيرفع ترتيبك في البحث ويرجّع العميل تاني.</Note>
      <div className="form">
        <div className="field full">
          <label>لينك التقييم على جوجل (من Google Business ← «اطلب تقييمات»)</label>
          <input dir="ltr" value={link} placeholder="https://g.page/r/..." onChange={(e) => setLink(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button
            type="button"
            className="primary"
            onClick={async () => {
              await kv.save({ ...F, link: link.trim() });
              toast('✔ اتحفظ');
            }}
          >
            حفظ
          </button>
        </div>
      </div>
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>اشترى</th>
                <th>يوم</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {R.map((o) => (
                <tr key={o.name}>
                  <td>
                    <b>{o.name}</b>
                  </td>
                  <td>
                    <small>{o.items.slice(0, 3).join('، ')}</small>
                  </td>
                  <td>{o.date}</td>
                  <td>
                    {F.done[o.name] === o.date ? (
                      '✅ اتبعت'
                    ) : (
                      <span onClick={() => void kv.save({ ...F, done: { ...F.done, [o.name]: o.date } })}>
                        <WaBtn phone={o.phone} label="⭐ ابعت" text={msg(o)} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>مفيش عملاء (بأرقام) اشتروا من ٥ لـ ٩ أيام.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 😴 عملاء غايبين
function Lapsed() {
  const [days, setDays] = useState(60);
  const q = useRows<{ rows: { name: string; last: string; total: number; visits: number; phone: string; days: number }[] }>('lapsed', { days });
  const R = q.data?.rows ?? [];
  return (
    <Wait q={q}>
      <Note>
        عملاء كانوا بيشتروا منك أكتر من مرة وبقالهم أكتر من <DaysSel value={days} opts={[30, 45, 60, 90, 120]} onChange={setDays} /> مجوش. ابعتلهم رسالة «وحشتنا» — أرخص من إنك تجيب عميل جديد.
      </Note>
      <Cards>
        <Card label="عملاء غايبين" value={R.length} />
        <Card label="كانوا اشتروا بـ" value={money(R.reduce((a, x) => a + x.total, 0))} />
      </Cards>
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>اشترى بـ</th>
                <th>مرات</th>
                <th>آخر مرة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {R.slice(0, 200).map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                    {x.phone ? (
                      <>
                        <br />
                        <small dir="ltr">{x.phone}</small>
                      </>
                    ) : null}
                  </td>
                  <td>{money(x.total)}</td>
                  <td>{x.visits}</td>
                  <td>
                    {x.last}
                    <br />
                    <small style={{ color: '#b33' }}>{x.days} يوم</small>
                  </td>
                  <td>
                    <WaBtn phone={x.phone} label="💬 وحشتنا" text={`أهلاً يا ${x.name} 👋\nوحشتنا في ${shop}! نزلت عندنا حاجات جديدة في الإكسسوارات والمفصلات والمقابض.\nلو محتاج أي حاجة لشغلك ابعتلنا هنا وإحنا نجهزهالك 🙏`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>👌 مفيش عملاء غايبين.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── ⭐ نقاط الصنايعية
interface Points {
  per: number;
  crafts: string[];
  used: Record<string, number>;
}
function PointsTab() {
  const toast = useToast();
  const kv = useKv<Points>('points', { per: 100, crafts: [], used: {} });
  const custs = useAllContacts('CUSTOMER').data ?? [];
  const cfg = kv.value ?? { per: 100, crafts: [], used: {} };
  const [per, setPer] = useState('100');
  const [add, setAdd] = useState('');
  const [use, setUse] = useState<{ n: string; left: number } | null>(null);
  const [u, setU] = useState('');
  useEffect(() => {
    if (kv.value) setPer(String(kv.value.per || 100));
  }, [kv.value]);
  const spent = useQuery({
    queryKey: ['analytics', 'spent', cfg.crafts],
    queryFn: () => api.post<{ spent: Record<string, number> }>('/analytics/spent', { names: cfg.crafts }).then((r) => r.spent),
    enabled: !!kv.value && cfg.crafts.length > 0,
  });
  const R = cfg.crafts
    .map((n) => {
      const s = spent.data?.[n] ?? 0;
      const earned = Math.floor(s / (+cfg.per || 100));
      const used = +(cfg.used[n] ?? 0);
      return { n, spent: s, earned, used, left: earned - used };
    })
    .sort((a, b) => b.spent - a.spent);
  return (
    <Wait q={{ isPending: kv.isPending, isError: !!kv.error, error: kv.error }}>
      <Note>كل صنايعي بياخد نقطة على كل {cfg.per || 100} جنيه بيشتريها. لما يجمّع نقط يستبدلها بهدية (من «🎁 هدية» في شاشة المنتج) — ده بيخلّيه مايروحش لحد غيرك.</Note>
      <div className="form" style={{ marginBottom: 10 }}>
        <div className="field">
          <label>نقطة لكل كام جنيه؟</label>
          <input type="number" min={10} value={per} onChange={(e) => setPer(e.target.value)} />
        </div>
        <div className="field">
          <label>ضيف صنايعي للبرنامج</label>
          <input list="bzNames" placeholder="اسمه زي ما هو في الفواتير" value={add} onChange={(e) => setAdd(e.target.value)} />
          <datalist id="bzNames">
            {custs.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button
            type="button"
            className="primary"
            onClick={async () => {
              const n = add.trim();
              await kv.save({ ...cfg, per: Math.max(10, +per || 100), crafts: n && !cfg.crafts.includes(n) ? [...cfg.crafts, n] : cfg.crafts });
              setAdd('');
              toast('✔ اتحفظ');
            }}
          >
            ➕ ضيف / حفظ
          </button>
        </div>
      </div>
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>الصنايعي</th>
                <th>اشترى بـ</th>
                <th>النقط</th>
                <th>استبدل</th>
                <th>الرصيد</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {R.map((x, i) => (
                <tr key={x.n}>
                  <td>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td>
                    <b>{x.n}</b>
                  </td>
                  <td>{money(x.spent)}</td>
                  <td>{x.earned}</td>
                  <td>{x.used}</td>
                  <td>
                    <b style={{ color: '#087f8c' }}>{x.left}</b>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setUse({ n: x.n, left: x.left });
                          setU(String(Math.max(0, x.left)));
                        }}
                      >
                        🎁 استبدال
                      </button>
                      <button type="button" className="secondary" onClick={() => kv.save({ ...cfg, crafts: cfg.crafts.filter((c) => c !== x.n) })}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>لسه مفيش صنايعية في البرنامج — ضيف أسماءهم فوق.</Empty>
      )}
      {use && (
        <Modal title={`🎁 استبدال نقط ${use.n}`} onClose={() => setUse(null)}>
          <p>
            رصيده <b>{use.left}</b> نقطة.
          </p>
          <div className="form">
            <div className="field">
              <label>كام نقطة هيستبدل؟</label>
              <input type="number" min={1} max={Math.max(0, use.left)} value={u} onChange={(e) => setU(e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#7b8a90' }}>بعد كده افتح المنتج اللي هياخده ودوس «🎁 هدية» عشان يتخصم من المخزن.</p>
          <div className="modal-foot">
            <button
              type="button"
              className="primary"
              onClick={async () => {
                const n = Math.round(+u || 0);
                if (n <= 0 || n > use.left) return toast('الرقم مش مظبوط', 'bad');
                await kv.save({ ...cfg, used: { ...cfg.used, [use.n]: (+cfg.used[use.n]! || 0) + n } });
                setUse(null);
                toast(`✔ اتخصم ${n} نقطة`);
              }}
            >
              استبدل
            </button>
            <button type="button" className="secondary" onClick={() => setUse(null)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </Wait>
  );
}

// ───────────────────────── ⚖️ مقارنة الموردين
function Suppliers() {
  const q = useRows<{ rows: { name: string; list: { s: string; price: number; iso: string }[]; save: number }[] }>('suppliers');
  const R = q.data?.rows ?? [];
  return (
    <Wait q={q}>
      <Note>أصناف اشتريتها من أكتر من مورد — السيستم بيقارن آخر سعر من كل واحد ويقولك مين الأرخص وبتوفر كام في الحتة.</Note>
      {R.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الأرخص</th>
                <th>باقي الموردين</th>
                <th>الفرق في الحتة</th>
              </tr>
            </thead>
            <tbody>
              {R.slice(0, 200).map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td style={{ color: '#087f8c' }}>
                    <b>{x.list[0]!.s}</b>
                    <br />
                    {money(x.list[0]!.price)} <small style={{ color: '#7b8a90' }}>{x.list[0]!.iso}</small>
                  </td>
                  <td>
                    {x.list.slice(1).map((l) => (
                      <div key={l.s}>
                        {l.s}: {money(l.price)} <small style={{ color: '#7b8a90' }}>{l.iso}</small>
                      </div>
                    ))}
                  </td>
                  <td>
                    <b style={{ color: '#b33' }}>{money(x.save)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>لسه مفيش صنف اشتريته من أكتر من مورد.</Empty>
      )}
    </Wait>
  );
}

// ───────────────────────── 📖 كتالوج (من غير أسعار)
function Catalog() {
  const toast = useToast();
  const prods = useAllProducts({}).data ?? [];
  const infos = useAllProductInfo().data ?? {};
  const site = useQuery({ queryKey: ['web', 'site-admin'], queryFn: fetchSite, staleTime: 120_000 });
  const cats = useMemo(() => [...new Set(prods.map((p) => p.category || 'بدون تصنيف'))].sort(), [prods]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [stock, setStock] = useState(true);
  const [needImg, setNeedImg] = useState(false);
  const [view, setView] = useState<{ html: string } | null>(null);
  const sp = site.data?.data.products ?? [];
  const imgOf = (p: ProductDto) => {
    const s = sp.find((x) => String(x.code || '') === String(p.code || '')) ?? sp.find((x) => x.name && x.name === p.name);
    return s?.imgs?.[0] || s?.img || infos[p.id]?.imgs?.[0] || '';
  };
  const picked = prods.filter((p) => !off.has(p.category || 'بدون تصنيف') && (!stock || p.qty > 0)).map((p) => ({ p, img: imgOf(p) })).filter((x) => !needImg || x.img);
  const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const build = () => {
    if (!picked.length) return toast('مفيش أصناف بالشروط دي', 'bad');
    const by: Record<string, typeof picked> = {};
    picked.forEach((x) => ((by[x.p.category || 'بدون تصنيف'] ??= []).push(x)));
    const abs = (u: string) => (u.startsWith('http') ? u : `${location.origin}${u}`);
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{font-family:Cairo,Tahoma,sans-serif;margin:0;color:#14262b}@page{size:A4;margin:12mm}
.cover{height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,#087f8c,#0b4e57);color:#fff;border-radius:18px;page-break-after:always;text-align:center}
.cover h1{font-size:54px;margin:0;font-weight:900}.cover p{font-size:20px;opacity:.9;margin:8px 0}.cover .g{width:90px;height:5px;background:#c9971f;border-radius:9px;margin:18px auto}
h2{font-size:22px;border-right:6px solid #c9971f;padding-right:10px;margin:18px 0 10px;page-break-after:avoid}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.it{border:1px solid #e1e8ea;border-radius:12px;padding:8px;text-align:center;page-break-inside:avoid}
.it img{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:8px}.it .ph{width:100%;aspect-ratio:1;background:#f2f6f7;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9aa;font-size:40px}
.it b{display:block;font-size:13px;margin-top:6px;line-height:1.5}.it span{display:inline-block;margin-top:4px;background:#087f8c;color:#fff;border-radius:6px;padding:0 8px;font-size:12px;font-weight:700;direction:ltr}
.foot{margin-top:20px;text-align:center;color:#087f8c;font-weight:700;font-size:15px}
</style></head><body><div style="width:794px"><div class="cover"><h1>${shop}</h1><div class="g"></div><p>كتالوج المنتجات</p><p style="font-size:16px">${picked.length} منتج · ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</p></div>
${Object.keys(by).sort().map((c) => `<h2>${esc(c)}</h2><div class="grid">${by[c]!.map((x) => `<div class="it">${x.img ? `<img src="${esc(abs(x.img))}">` : '<div class="ph">📦</div>'}<b>${esc(x.p.name)}</b><span>${esc(x.p.code)}</span></div>`).join('')}</div>`).join('')}
<div class="foot">للأسعار والطلب: كلمنا واتساب واذكر كود المنتج 🙏</div></div></body></html>`;
    setView({ html });
  };
  return (
    <>
      <Note>
        كتالوج PDF بصور المنتجات والأكواد — <b>من غير أسعار</b> — تبعته للصنايعية والمهندسين على الواتساب أو تطبعه.
      </Note>
      <div className="form">
        <div className="field full">
          <label>التصنيفات</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map((c) => (
              <label key={c} style={{ display: 'flex', gap: 5, alignItems: 'center', border: '1px solid var(--border,#ddd)', borderRadius: 99, padding: '4px 10px', color: 'inherit' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={!off.has(c)}
                  onChange={(e) => {
                    const s = new Set(off);
                    if (e.target.checked) s.delete(c);
                    else s.add(c);
                    setOff(s);
                  }}
                />{' '}
                {c}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={stock} onChange={(e) => setStock(e.target.checked)} /> المتوفر بس
          </label>
        </div>
        <div className="field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={needImg} onChange={(e) => setNeedImg(e.target.checked)} /> اللي ليه صورة بس
          </label>
        </div>
      </div>
      <div className="bz-note" style={{ background: '#e3f4f5', borderRadius: 10, padding: '8px 12px', color: '#0b4e57' }}>
        هيطلع في الكتالوج <b>{N(picked.length)}</b> منتج من {N(prods.length)}
        {picked.length < prods.length ? ' — شيل علامة «المتوفر بس» أو «اللي ليه صورة بس» لو عايز الكل' : ''}
      </div>
      <div className="modal-foot" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="primary" onClick={build}>
          📖 اعمل الكتالوج
        </button>
      </div>
      {view && <PrintPreview html={view.html} title="كتالوج المنتجات" onClose={() => setView(null)} />}
    </>
  );
}

// ───────────────────────── 🕵️ سجل العمليات
function LogTab() {
  const q = useRows<{ rows: { at: string; who: string; what: string }[] }>('log');
  const R = q.data?.rows ?? [];
  return (
    <Wait q={q}>
      <Note>مين عمل إيه وإمتى — تعديلات الأرصدة، الجرد، الهدايا، الدرجة التانية، وكل العمليات اللي السيرفر سجلها.</Note>
      {R.length ? (
        R.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border,#eee)', padding: '7px 0', fontSize: 13, lineHeight: 1.7 }}>
            <b>{r.who || '—'}</b> · {r.what}
            <br />
            <small style={{ color: '#7b8a90' }}>{new Date(r.at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</small>
          </div>
        ))
      ) : (
        <Empty>مفيش سجل.</Empty>
      )}
    </Wait>
  );
}

const VIEWS: Record<Tab, () => ReactNode> = {
  dead: () => <Dead />,
  abc: () => <Abc />,
  fc: () => <Forecast />,
  res: () => <Reservations />,
  kits: () => <Combos />,
  usd: () => <UsdTab />,
  plist: () => <PriceLists />,
  credit: () => <CreditTab />,
  follow: () => <FollowTab />,
  lapsed: () => <Lapsed />,
  points: () => <PointsTab />,
  sup: () => <Suppliers />,
  cat: () => <Catalog />,
  log: () => <LogTab />,
};

function Biz() {
  const [tab, setTab] = useState<Tab>('dead');
  return (
    <>
      <PageHeader title="📈 تحليلات ذكية" subtitle="السيستم بيقرا كل اللي حصل في المحل ويقولك تعمل إيه" />
      <div className="bz-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div id="bzBody">{VIEWS[tab]()}</div>
    </>
  );
}

export default function BizPage() {
  return (
    <AdminOnly>
      <Biz />
    </AdminOnly>
  );
}
