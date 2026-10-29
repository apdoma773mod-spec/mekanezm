'use client';

import { useMemo, useState } from 'react';
import type { KitDto, KitInput, KitSlot, ProductDto } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useDeleteKit, useKits, useSaveKit } from '@/lib/phase4-queries';
import { useContacts, useCreateInvoice, useProducts } from '@/lib/trade-queries';

const r3 = (n: number) => Math.round((+n || 0) * 1000) / 1000;
const r6 = (n: number) => Math.round((+n || 0) * 1e6) / 1e6;
const num = (v: string | number) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
/** «٢ ونص» style quantities, as the old fq(). */
const fq = (x: number) => {
  const n = r3(x);
  const w = Math.floor(n);
  const f = r3(n - w);
  if (!f) return String(w);
  if (f === 0.5) return w ? `${w} ونص` : 'نص';
  if (f === 0.25) return w ? `${w} وربع` : 'ربع';
  return String(n);
};
const M = (n: number) => money(Math.round(n));
const lab = (p?: ProductDto) => (p ? `${p.code ? `${p.code} — ` : ''}${p.name}` : '(صنف اتمسح)');

/** How much of the component's stock unit one sale of `n` takes (the old need()). */
const need = (s: KitSlot, n: number, m?: string | number) =>
  s.mode === 'fixed' ? s.qty : s.mode === 'len' ? (m !== undefined && m !== '' ? num(m) : s.qty) / (s.ulen || 1) : (s.qty / (s.per || 1)) * n;

function useAllProducts() {
  const r = useProducts({ pageSize: 200, sort: 'name' });
  return useMemo(() => new Map((r.data?.items ?? []).map((p) => [p.id, p])), [r.data]);
}

function maxN(k: KitDto, P: Map<string, ProductDto>) {
  let m = Infinity;
  for (const s of k.slots) {
    const st = s.products.reduce((a, id) => a + Math.max(0, P.get(id)?.qty ?? 0), 0);
    if (s.mode === 'len') continue;
    if (s.mode === 'fixed') {
      if (st < s.qty) m = 0;
    } else {
      const c = s.qty / (s.per || 1);
      if (c > 0) m = Math.min(m, Math.floor(r3(st / c + 1e-9)));
    }
  }
  return m === Infinity ? '∞' : m;
}
const priceOf = (k: KitDto, n: number, P: Map<string, ProductDto>) => Math.round(k.slots.reduce((t, s) => t + need(s, n) * (P.get(s.products[0]!)?.price ?? 0), 0));
const costOf = (k: KitDto, n: number, P: Map<string, ProductDto>) => Math.round(k.slots.reduce((t, s) => t + need(s, n) * (P.get(s.products[0]!)?.cost ?? 0), 0));

function ProductSearch({ onPick, placeholder = '🔎 دوّر على صنف واضغطه' }: { onPick: (p: ProductDto) => void; placeholder?: string }) {
  const [t, setT] = useState('');
  const r = useProducts({ q: t.trim(), pageSize: 10 }, t.trim().length >= 2);
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <input placeholder={placeholder} value={t} onChange={(e) => setT(e.target.value)} />
      {t.trim().length >= 2 && (
        <div className="txbox">
          {r.data?.items.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                onPick(p);
                setT('');
              }}
            >
              {lab(p)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const newSlot = (): KitSlot => ({ label: '', mode: 'fixed', qty: 1, per: 1, ulen: 1, opt: false, products: [] });

function KitEditor({ kit, P, onClose }: { kit?: KitDto; P: Map<string, ProductDto>; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveKit();
  const [k, setK] = useState<KitInput>(
    kit ? { name: kit.name, param: kit.param, def: kit.def, sp: kit.sp, slots: kit.slots } : { name: '', param: 'دلفة', def: 2, sp: null, slots: [newSlot()] },
  );
  const [names, setNames] = useState<Map<string, ProductDto>>(new Map());
  const pname = (id: string) => lab(P.get(id) ?? names.get(id));
  const setSlot = (j: number, p: Partial<KitSlot>) => setK({ ...k, slots: k.slots.map((s, i) => (i === j ? { ...s, ...p } : s)) });
  const go = async () => {
    if (!k.name.trim()) return toast('اكتب اسم الطقم', 'bad');
    if (k.slots.some((s) => !s.products.length || !(s.qty > 0))) return toast('كل مكوّن لازم يبقى فيه صنف وكمية', 'bad');
    try {
      await save.mutateAsync({ id: kit?.id, input: { ...k, name: k.name.trim(), slots: k.slots.map((s) => ({ ...s, label: s.label || pname(s.products[0]!) })) } });
      onClose();
      toast('✔ اتحفظ الطقم');
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title={kit ? `✏️ ${kit.name}` : '➕ طقم جديد'} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label>اسم الطقم</label>
          <input value={k.name} placeholder="مثلاً: طقم جرار دولاب قطاع" onChange={(e) => setK({ ...k, name: e.target.value })} />
        </div>
        <div className="field">
          <label>سعر بيع الطقم (اختياري — بيظهر لما تمسح باركود الطقم في الفاتورة)</label>
          <input inputMode="decimal" value={k.sp ?? ''} placeholder="فاضي = مجموع أسعار المكونات" onChange={(e) => setK({ ...k, sp: num(e.target.value) || null })} />
        </div>
        <div className="kt-row field full">
          <div className="field">
            <label>بيتباع بعدد إيه؟</label>
            <input value={k.param} placeholder="دلفة" onChange={(e) => setK({ ...k, param: e.target.value })} />
          </div>
          <div className="field">
            <label>العدد الافتراضي</label>
            <input inputMode="numeric" value={k.def} onChange={(e) => setK({ ...k, def: num(e.target.value) || 1 })} />
          </div>
        </div>
        <div className="field full">
          {k.slots.map((s, j) => (
            <div key={j} className="kt-slot">
              <div className="kt-row" style={{ marginTop: 0 }}>
                <div style={{ flex: 2 }}>
                  <label>المكوّن</label>
                  <input value={s.label} placeholder="مثلاً: عود الألمنيوم / علبة اللوازم / البالتة" onChange={(e) => setSlot(j, { label: e.target.value })} />
                </div>
                {k.slots.length > 1 && (
                  <button type="button" className="secondary danger" style={{ flex: '0 0 auto' }} onClick={() => setK({ ...k, slots: k.slots.filter((_, i) => i !== j) })}>
                    ✕
                  </button>
                )}
              </div>
              <div className="kt-row">
                <div>
                  <label>كميته</label>
                  <select value={s.mode} onChange={(e) => setSlot(j, { mode: e.target.value as KitSlot['mode'] })}>
                    <option value="fixed">ثابتة لكل طقم</option>
                    <option value="param">بتتغير بعدد الـ {k.param || 'وحدة'}</option>
                    <option value="len">بالطول (بتكتب الأمتار وقت البيع)</option>
                  </select>
                </div>
                <div>
                  <label>{s.mode === 'fixed' ? 'كام وحدة مخزن لكل طقم' : s.mode === 'len' ? 'الطول الافتراضي (متر)' : 'بياخد (وحدة مخزن)'}</label>
                  <input inputMode="decimal" value={s.qty} onChange={(e) => setSlot(j, { qty: num(e.target.value) })} />
                </div>
                {s.mode === 'len' && (
                  <div>
                    <label>طول وحدة المخزن (متر) — 1 لو الصنف متسجل بالمتر</label>
                    <input inputMode="decimal" value={s.ulen} onChange={(e) => setSlot(j, { ulen: num(e.target.value) || 1 })} />
                  </div>
                )}
                {s.mode === 'param' && (
                  <div>
                    <label>لكل كام {k.param || 'وحدة'}</label>
                    <input inputMode="numeric" value={s.per} onChange={(e) => setSlot(j, { per: num(e.target.value) || 1 })} />
                  </div>
                )}
              </div>
              {s.mode === 'param' && s.per > 1 && (
                <small style={{ color: 'var(--muted)' }}>
                  يعني الصنف ده بيتباع بالوحدة وفيه {s.per} {k.param || 'وحدة'} — لو بعت واحدة بيخصم {fq(s.qty / s.per)} وحدة
                </small>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 14 }}>
                <input type="checkbox" checked={s.opt} onChange={(e) => setSlot(j, { opt: e.target.checked })} style={{ width: 20, height: 20 }} /> مكوّن اختياري (ممكن الزبون مياخدوش)
              </label>
              <div style={{ marginTop: 6 }}>
                <label>الأصناف المسموحة (لو أكتر من واحد: بتختار وقت البيع)</label>
                {s.products.map((id) => (
                  <span key={id} className="kt-chip">
                    {pname(id)}{' '}
                    <a style={{ cursor: 'pointer', color: '#b33' }} onClick={() => setSlot(j, { products: s.products.filter((x) => x !== id) })}>
                      ✕
                    </a>
                  </span>
                ))}
                <ProductSearch
                  onPick={(p) => {
                    setNames(new Map(names).set(p.id, p));
                    if (!s.products.includes(p.id)) setSlot(j, { products: [...s.products, p.id], label: s.label || p.name });
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" className="secondary" onClick={() => setK({ ...k, slots: [...k.slots, newSlot()] })}>
              ➕ مكوّن
            </button>
            <button type="button" className="primary" disabled={save.isPending} onClick={go}>
              💾 حفظ الطقم
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface SaleRow {
  pid: string;
  q: string | null;
}

/** «💰 بيع طقم»: an ordinary sale invoice of the components, priced so the total matches the kit price. */
function KitSale({ k, P, onClose }: { k: KitDto; P: Map<string, ProductDto>; onClose: () => void }) {
  const toast = useToast();
  const { open } = useModal();
  const create = useCreateInvoice();
  const [n, setN] = useState(k.def || 1);
  const [off, setOff] = useState<Record<number, boolean>>({});
  const [len, setLen] = useState<Record<number, string>>({});
  const [rows, setRows] = useState<SaleRow[][]>(k.slots.map((s) => [{ pid: s.products[0]!, q: null }]));
  const [extra, setExtra] = useState<{ p: ProductDto; q: string }[]>([]);
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('');
  const customers = useContacts({ type: 'CUSTOMER', q: person.trim() || undefined, pageSize: 20 });
  const [names, setNames] = useState<Map<string, ProductDto>>(new Map());
  const prod = (id: string) => P.get(id) ?? names.get(id);

  const plan = () => {
    const out: { slot: number | null; pid: string; q: number }[] = [];
    k.slots.forEach((s, j) => {
      if (off[j]) return;
      const req = r3(need(s, n, len[j]));
      if (s.products.length < 2) return out.push({ slot: j, pid: s.products[0]!, q: r6(need(s, n, len[j])) });
      const typed = (r: SaleRow) => r.q !== null && r.q !== '' && !Number.isNaN(parseFloat(r.q));
      const R = rows[j]!;
      const typedSum = R.reduce((a, r) => a + (typed(r) ? num(r.q!) : 0), 0);
      const rest = Math.max(0, req - typedSum);
      const firstBlank = R.findIndex((r) => !typed(r));
      R.forEach((r, x) => out.push({ slot: j, pid: r.pid, q: r3(typed(r) ? num(r.q!) : x === firstBlank ? rest : 0) }));
    });
    extra.forEach((e) => num(e.q) > 0 && out.push({ slot: null, pid: e.p.id, q: r3(num(e.q)) }));
    return out;
  };
  const pl = plan();
  const lines = pl.filter((x) => x.q > 0).map((x) => ({ p: prod(x.pid), q: x.q }));
  const sum = lines.reduce((a, x) => a + x.q * (x.p?.price ?? 0), 0);
  const tot = total !== '' ? num(total) : Math.round(sum);
  const cost = lines.reduce((a, x) => a + x.q * (x.p?.cost ?? 0), 0);
  const byP = new Map<string, number>();
  lines.forEach((x) => x.p && byP.set(x.p.id, (byP.get(x.p.id) ?? 0) + x.q));
  const short = [...byP].map(([id, q]) => ({ p: prod(id)!, q })).filter((x) => x.p && x.q > x.p.qty + 1e-9);
  const mx = maxN(k, P);

  const go = async () => {
    const L = pl.filter((x) => x.q > 0);
    if (!L.length) return toast('مفيش كميات', 'bad');
    for (const [j, s] of k.slots.entries()) {
      if (s.products.length < 2 || off[j]) continue;
      const want = r3(need(s, n, len[j]));
      const got = r3(L.filter((x) => x.slot === j).reduce((a, x) => a + x.q, 0));
      if (Math.abs(got - want) > 0.001) return toast(`كميات «${s.label}» مش مطابقة للمطلوب (${fq(want)})`, 'bad');
    }
    const agg = new Map<string, number>();
    L.forEach((x) => agg.set(x.pid, (agg.get(x.pid) ?? 0) + x.q));
    const items = [...agg].map(([id, q]) => ({ id, q: r6(q), p: prod(id) }));
    const s0 = items.reduce((a, x) => a + x.q * (x.p?.price ?? 0), 0);
    const f = s0 > 0 ? tot / s0 : 1;
    const its = items.map((x) => ({ productId: x.id, name: x.p?.name ?? '', qty: x.q, price: Math.round((x.p?.price ?? 0) * f * 100) / 100 }));
    const t2 = Math.round(its.reduce((a, x) => a + x.qty * x.price, 0) * 100) / 100;
    const pd = paid === '' ? t2 : num(paid);
    if (pd > t2 + 0.001) return toast('المدفوع أكبر من الإجمالي', 'bad');
    if (t2 - pd > 0.001 && !person.trim()) return toast('اكتب اسم العميل عشان نسجل الباقي عليه', 'bad');
    if (short.length) toast(`⚠️ الرصيد هيبقى بالسالب: ${short.map((x) => x.p.name).join(' • ')}`);
    try {
      const inv = await create.mutateAsync({
        kind: 'SALE',
        company: 'MK',
        person: person.trim(),
        phone: phone.trim(),
        address: '',
        note: `🧩 ${k.name} × ${n} ${k.param}`,
        shipping: 0,
        discount: 0,
        paid: t2 > 0 ? pd : 0,
        payMethod: 'CASH',
        items: its,
      });
      onClose();
      toast(`✔ تم تسجيل البيع ${inv.no}`);
      open({ kind: 'invoice', id: inv.id });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <Modal title={`💰 بيع ${k.name}`} onClose={onClose}>
      <div className="form">
        <div className="kt-row field full">
          <div className="field">
            <label>عدد الـ {k.param || 'طقم'}</label>
            <input
              inputMode="numeric"
              value={n}
              style={{ fontSize: 20, fontWeight: 800 }}
              onChange={(e) => {
                setN(num(e.target.value) || 1);
                setRows(rows.map((r) => r.map((y) => ({ pid: y.pid, q: null }))));
              }}
            />
          </div>
          <div className="field">
            <label>المتاح يكفي</label>
            <input readOnly value={mx === '∞' ? '—' : mx} />
          </div>
        </div>
        <div className="field full">
          {k.slots.map((s, j) => {
            const req = r3(need(s, n, len[j]));
            const multi = s.products.length > 1;
            const isOff = !!off[j];
            const got = r3(pl.filter((x) => x.slot === j).reduce((a, x) => a + x.q, 0));
            const diff = multi && !isOff ? r3(got - req) : 0;
            return (
              <div key={j} className="kt-slot" style={isOff ? { opacity: 0.55 } : undefined}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                    <input type="checkbox" checked={!isOff} style={{ width: 22, height: 22 }} onChange={(e) => setOff({ ...off, [j]: !e.target.checked })} />
                    <b>{s.label}</b>
                  </label>
                  <span className="kt-chip">{isOff ? 'مش ضمن البيعة' : `المطلوب ${fq(req)}`}</span>
                </div>
                {s.mode === 'len' && !isOff && (
                  <div className="kt-row">
                    <div className="field">
                      <label>الطول (متر)</label>
                      <input inputMode="decimal" value={len[j] ?? String(s.qty)} onChange={(e) => setLen({ ...len, [j]: e.target.value })} />
                    </div>
                  </div>
                )}
                {!isOff &&
                  (multi ? (
                    <>
                      {rows[j]!.map((r, x) => (
                        <div key={x} className="kt-row">
                          <div style={{ flex: 2 }}>
                            <select value={r.pid} onChange={(e) => setRows(rows.map((R, i) => (i === j ? R.map((y, z) => (z === x ? { ...y, pid: e.target.value } : y)) : R)))}>
                              {s.products.map((id) => (
                                <option key={id} value={id}>
                                  {prod(id)?.name ?? '؟'} (متاح {fq(prod(id)?.qty ?? 0)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              inputMode="decimal"
                              placeholder={x === 0 && rows[j]!.length === 1 ? fq(req) : 'الكمية'}
                              value={r.q ?? ''}
                              onChange={(e) => setRows(rows.map((R, i) => (i === j ? R.map((y, z) => (z === x ? { ...y, q: e.target.value } : y)) : R)))}
                            />
                          </div>
                          {rows[j]!.length > 1 && (
                            <button type="button" className="secondary danger" style={{ flex: '0 0 auto' }} onClick={() => setRows(rows.map((R, i) => (i === j ? R.filter((_, z) => z !== x) : R)))}>
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setRows(rows.map((R, i) => (i === j ? [...R, { pid: s.products[0]!, q: '' }] : R)))}>
                        ➕ نوع/مقاس تاني
                      </button>
                      {diff !== 0 && (
                        <div style={{ color: '#b33', fontWeight: 700, marginTop: 4 }}>
                          الكميات {diff > 0 ? 'زيادة' : 'ناقصة'} {fq(Math.abs(diff))} عن المطلوب
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 14, marginTop: 4 }}>
                      {lab(prod(s.products[0]!))} — هيتخصم {fq(req)} (متاح {fq(prod(s.products[0]!)?.qty ?? 0)})
                    </div>
                  ))}
              </div>
            );
          })}
          <div className="kt-slot">
            <b>➕ أصناف زيادة مع الطقم</b>
            {extra.map((e, x) => (
              <div key={x} className="kt-row">
                <div style={{ flex: 2 }}>{lab(e.p)}</div>
                <div>
                  <input inputMode="decimal" value={e.q} placeholder="العدد" onChange={(ev) => setExtra(extra.map((y, z) => (z === x ? { ...y, q: ev.target.value } : y)))} />
                </div>
                <button type="button" className="secondary danger" style={{ flex: '0 0 auto' }} onClick={() => setExtra(extra.filter((_, z) => z !== x))}>
                  ✕
                </button>
              </div>
            ))}
            <ProductSearch
              placeholder="➕ صنف (عجل / مقبض / غيره)"
              onPick={(p) => {
                setNames(new Map(names).set(p.id, p));
                setExtra([...extra, { p, q: '1' }]);
              }}
            />
          </div>
        </div>
        {short.length > 0 && (
          <div className="field full" style={{ background: '#fdecec', color: '#b33', borderRadius: 10, padding: '8px 10px', margin: '8px 0', fontWeight: 700 }}>
            ⚠️ ناقص في المخزن (البيع هيتسجل والرصيد هيبقى بالسالب):
            {short.map((x) => (
              <div key={x.p.id}>
                {x.p.name}: المطلوب {fq(x.q)} والمتاح {fq(x.p.qty)}
              </div>
            ))}
          </div>
        )}
        <div className="field">
          <label>اسم العميل</label>
          <input list="ktCL" value={person} onChange={(e) => setPerson(e.target.value)} />
          <datalist id="ktCL">{customers.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </div>
        <div className="field">
          <label>موبايل</label>
          <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>سعر الطقم النهائي (سيبه فاضي = مجموع الأسعار {M(sum)})</label>
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="field">
          <label>المدفوع (فاضي = كله)</label>
          <input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </div>
        <div className="field full">
          <div style={{ fontSize: 20, fontWeight: 900, margin: '6px 0' }}>الإجمالي: {M(tot)}</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            التكلفة: {M(cost)} — ربحك: <b style={{ color: '#159447' }}>{M(tot - cost)}</b>
          </div>
          <button type="button" className="primary" disabled={create.isPending} onClick={go}>
            {create.isPending ? '⏳ بيسجّل…' : '✔ سجّل البيع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function KitsScreen() {
  const toast = useToast();
  const kits = useKits();
  const P = useAllProducts();
  const save = useSaveKit();
  const del = useDeleteKit();
  const [view, setView] = useState<{ kind: 'edit'; k?: KitDto } | { kind: 'sell'; k: KitDto } | null>(null);
  const K = kits.data ?? [];
  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>🧩 الأطقم والتركيبات</h1>
          <p>طقم الجرار والبالتة وغيرهم: بتشتري المكوّنات لوحدها وتبيعها مع بعض، والمخزن بيتخصم من كل مكوّن لوحده</p>
        </div>
        <div className="btnrow">
          <button type="button" className="primary" onClick={() => setView({ kind: 'edit' })}>
            ➕ طقم جديد
          </button>
        </div>
      </div>
      {kits.isPending ? (
        <Loading label="⏳" />
      ) : kits.isError ? (
        <ErrorBox message={errorMessage(kits.error)} onRetry={() => kits.refetch()} />
      ) : K.length ? (
        K.map((k) => {
          const mx = maxN(k, P);
          const n = k.def || 1;
          const pr = priceOf(k, n, P);
          const co = costOf(k, n, P);
          return (
            <div key={k.id} className="kt-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 17, flex: 1 }}>{k.name}</b>
                <span className="kt-chip">كود {k.code}</span>
                <span className="kt-chip" dir="ltr">
                  {k.barcode}
                </span>
                <span className="kt-chip">{k.slots.length} مكوّن</span>
                {k.param && (
                  <span className="kt-chip" style={{ background: '#fff4e0', color: '#a66a00' }}>
                    بيتغير بـ {k.param}
                  </span>
                )}
              </div>
              <div style={{ margin: '6px 0', fontSize: 14, lineHeight: 1.9 }}>
                {k.slots.map((s, i) => (
                  <div key={i}>
                    • <b>{s.label}</b>: {s.mode === 'fixed' ? `${fq(s.qty)} لكل طقم` : s.mode === 'len' ? `بالطول (افتراضي ${fq(s.qty)} م)` : `${fq(s.qty)} لكل ${s.per > 1 ? `${s.per} ` : ''}${k.param || 'وحدة'}`}
                    {s.opt && <span className="kt-chip">اختياري</span>}
                    {s.products.length > 1 ? (
                      <span className="kt-chip">اختيار من {s.products.length} صنف</span>
                    ) : (
                      <small style={{ color: 'var(--muted)' }}> — {lab(P.get(s.products[0]!))}</small>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 14 }}>
                المتاح يكفي {mx === '∞' ? '—' : (
                  <>
                    لحد <b>{mx}</b> {k.param || 'طقم'}
                  </>
                )}
              </div>
              {pr > 0 && (
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  💰 لـ {n} {k.param}: السعر <b>{M(pr)}</b> — التكلفة {M(co)} — ربحك <b style={{ color: '#159447' }}>{M(pr - co)}</b>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="primary" onClick={() => setView({ kind: 'sell', k })}>
                  💰 بيع طقم
                </button>
                <button type="button" className="secondary" onClick={() => setView({ kind: 'edit', k })}>
                  ✏️ تعديل
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    try {
                      await save.mutateAsync({ input: { name: `${k.name} (نسخة)`, param: k.param, def: k.def, sp: k.sp, slots: k.slots } });
                      toast('✔ اتنسخ — عدّل الاسم والمكونات');
                    } catch (e) {
                      toast(errorMessage(e), 'bad');
                    }
                  }}
                >
                  📋 نسخ
                </button>
                <button type="button" className="secondary danger" onClick={() => window.confirm('تمسح الطقم ده؟ (الأصناف والمخزن مش هيتأثروا)') && del.mutate(k.id)}>
                  🗑️
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty">لسه مفيش أطقم — دوس «طقم جديد». مثال: طقم جرار دولاب = عود ألمنيوم + علبة لوازم (٢ دلفة).</div>
      )}
      {view?.kind === 'edit' && <KitEditor key={view.k?.id ?? 'new'} kit={view.k} P={P} onClose={() => setView(null)} />}
      {view?.kind === 'sell' && <KitSale key={view.k.id} k={view.k} P={P} onClose={() => setView(null)} />}
    </>
  );
}

export default function KitsPage() {
  return (
    <AdminOnly>
      <KitsScreen />
    </AdminOnly>
  );
}
