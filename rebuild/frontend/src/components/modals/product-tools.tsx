'use client';

import { useMemo, useRef, useState } from 'react';
import { CO_NAME, type ProductDto } from '@mk/shared';
import { COL, useCompany } from '../company';
import { errorMessage } from '@/lib/api';
import { vn } from '@/lib/import-daily';
import { money, qtyText } from '@/lib/format';
import { code128Svg } from '@/lib/code128';
import { esc, printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import {
  useAddOldGoods,
  useAllProducts,
  useBulkPrice,
  useCategories,
  useEstimateCosts,
  useImportNames,
  useProducts,
  useRecat,
  useSplitProduct,
  useUpdateProduct,
  useZeroCost,
} from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

export type ProductToolSpec =
  | { kind: 'bulkPrice' }
  | { kind: 'printProducts'; q: string; stock: 'all' | 'low' | 'out' }
  | { kind: 'labels'; all?: boolean }
  | { kind: 'linkBarcode'; code: string }
  | { kind: 'oldGoods' }
  | { kind: 'importFile' }
  | { kind: 'split' }
  | { kind: 'recat' };

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,]/g, '').replace(/٫/g, '.'));
  return Number.isNaN(n) ? 0 : n;
};
const words = (s: string) => vn(s).split(' ').filter(Boolean);
const matches = (p: ProductDto, w: string[]) => {
  const hay = vn(`${p.name} ${p.code}`);
  return w.every((x) => hay.includes(x));
};

// ---------- 💲 أسعار جماعي ----------

function BulkPrice() {
  const { close } = useModal();
  const toast = useToast();
  const { co } = useCompany();
  const cats = useCategories().data ?? [];
  const all = useAllProducts({ company: co }).data;
  const bulk = useBulkPrice();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [field, setField] = useState<'price' | 'cost' | 'both'>('price');
  const [pct, setPct] = useState('10');
  const [round, setRound] = useState('0');
  const [confirming, setConfirming] = useState(false);

  const list = useMemo(() => {
    const w = words(q);
    return (all ?? []).filter((p) => (!cat || p.category === cat) && matches(p, w));
  }, [all, cat, q]);
  const f = 1 + (num(pct) || 0) / 100;
  const r = Number(round);
  const calc = (v: number) => (r > 0 ? Math.round((v * f) / r) * r : Math.round(v * f * 100) / 100);
  const label = field === 'price' ? 'سعر البيع' : field === 'cost' ? 'سعر الشراء' : 'سعر البيع والشراء';

  const go = async () => {
    if (!list.length) return toast('مفيش أصناف', 'bad');
    if (!num(pct)) return toast('اكتب النسبة', 'bad');
    setConfirming(true);
  };
  const apply = async () => {
    try {
      const n = await bulk.mutateAsync({ ids: list.map((p) => p.id), field, pct: num(pct), round: r });
      close();
      toast(`✔ اتحدث ${n} صنف`);
    } catch (e) {
      setConfirming(false);
      toast(errorMessage(e), 'bad');
    }
  };

  if (confirming)
    return (
      <Modal title="💲 تحديث أسعار جماعي" onClose={() => setConfirming(false)}>
        <p style={{ margin: '0 0 10px', fontSize: 16, lineHeight: 1.9 }}>
          تحديث {label} لـ {list.length} صنف بنسبة {num(pct)}%؟
        </p>
        <div className="modal-foot">
          <button type="button" className="primary" onClick={apply} disabled={bulk.isPending}>
            تطبيق
          </button>
          <button type="button" className="secondary" onClick={() => setConfirming(false)}>
            رجوع
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title="💲 تحديث أسعار جماعي" onClose={close}>
      <div className="form">
        <div className="field">
          <label>التصنيف</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">كل التصنيفات</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>الاسم فيه (اختياري)</label>
          <input placeholder="مثلاً: بلوم" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label>السعر اللي يتغير</label>
          <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
            <option value="price">سعر البيع</option>
            <option value="cost">سعر الشراء</option>
            <option value="both">الاتنين</option>
          </select>
        </div>
        <div className="field">
          <label>النسبة % (زيادة 10 — نقص اكتب -10)</label>
          <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="field">
          <label>التقريب</label>
          <select value={round} onChange={(e) => setRound(e.target.value)}>
            <option value="0">من غير تقريب</option>
            <option value="1">لأقرب جنيه</option>
            <option value="5">لأقرب 5 جنيه</option>
            <option value="10">لأقرب 10 جنيه</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {!all ? (
          <Loading />
        ) : (
          <>
            <div style={{ marginBottom: 6 }}>
              هيتغير <b>{list.length}</b> صنف
            </div>
            <div className="table-wrap" style={{ maxHeight: '40vh' }}>
              <table className="table" style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th>الصنف</th>
                    {field !== 'cost' && (
                      <>
                        <th>البيع دلوقتي</th>
                        <th>البيع الجديد</th>
                      </>
                    )}
                    {field !== 'price' && (
                      <>
                        <th>الشراء دلوقتي</th>
                        <th>الشراء الجديد</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 40).map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      {field !== 'cost' && (
                        <>
                          <td>{money(p.price)}</td>
                          <td>
                            <b>{money(calc(p.price))}</b>
                          </td>
                        </>
                      )}
                      {field !== 'price' && (
                        <>
                          <td>{money(p.cost)}</td>
                          <td>
                            <b>{money(calc(p.cost ?? 0))}</b>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.length > 40 && <small style={{ color: 'var(--muted)' }}>ظاهر أول 40</small>}
          </>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" onClick={go}>
          تطبيق
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

// ---------- 🖨️ طباعة المنتجات ----------

function PrintProducts({ q, stock }: { q: string; stock: 'all' | 'low' | 'out' }) {
  const { close } = useModal();
  const { co } = useCompany();
  const settings = useSettings().data;
  const all = useAllProducts({ company: co, stock }).data;
  const [price, setPrice] = useState(true);
  const [cost, setCost] = useState(false);
  const [val, setVal] = useState(false);

  const list = useMemo(() => {
    const w = words(q);
    return (all ?? []).filter((p) => matches(p, w));
  }, [all, q]);

  const go = () => {
    if (!settings) return;
    const head = ['#', 'الكود', 'الصنف', 'التصنيف', 'الكمية'];
    if (price) head.push('سعر البيع');
    if (cost) head.push('سعر الشراء');
    if (val) head.push('القيمة');
    const rows = list.map((p, i) => {
      const r = [String(i + 1), p.code, p.name, p.category || '', `${qtyText(p.qty)} ${p.unit || ''}`];
      if (price) r.push(money(p.price));
      if (cost) r.push(money(p.cost));
      if (val) r.push(money(p.qty * (p.cost ?? 0)));
      return r;
    });
    const total = list.reduce((s, p) => s + p.qty * (p.cost ?? 0), 0);
    close();
    printHtml(reportHtml({ title: `قائمة المنتجات (${list.length} صنف)`, range: '', sum: val ? [['إجمالي قيمة المخزون', money(total)]] : [], head, rows }, settings));
  };

  return (
    <Modal title="🖨️ طباعة المنتجات" onClose={close}>
      <p style={{ marginTop: 0 }}>
        هيتطبع <b>{all ? list.length : '…'}</b> صنف (حسب البحث والفلتر اللي على الشاشة).
      </p>
      <label className="chk">
        <input type="checkbox" checked={price} onChange={(e) => setPrice(e.target.checked)} /> سعر البيع
      </label>
      <label className="chk">
        <input type="checkbox" checked={cost} onChange={(e) => setCost(e.target.checked)} /> سعر الشراء
      </label>
      <label className="chk">
        <input type="checkbox" checked={val} onChange={(e) => setVal(e.target.checked)} /> قيمة المخزون
      </label>
      <div className="modal-foot">
        <button type="button" className="primary" onClick={go} disabled={!all || !settings}>
          🖨️ طباعة
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

// ---------- 🏷️ ملصقات باركود ----------

interface LabelRow {
  id: string;
  n: number;
}

function Labels({ all: preAll }: { all?: boolean }) {
  const { close } = useModal();
  const toast = useToast();
  const { co } = useCompany();
  const settings = useSettings().data;
  const products = useAllProducts({ company: co }).data;
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [size, setSize] = useState('50x30');
  const [price, setPrice] = useState(false);
  const [shop, setShop] = useState(true);
  const [add, setAdd] = useState('');
  const [allN, setAllN] = useState('1');
  const seeded = useRef(false);
  if (preAll && products && !seeded.current) {
    seeded.current = true;
    setRows(products.map((p) => ({ id: p.id, n: 1 })));
  }
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const found = useMemo(() => {
    const w = words(add);
    return w.length ? (products ?? []).filter((p) => matches(p, w)).slice(0, 12) : [];
  }, [add, products]);

  const addAll = () => {
    const n = Math.max(1, parseInt(allN) || 1);
    const L = products ?? [];
    if (!L.length) return toast('مفيش منتجات', 'bad');
    if (rows.length && !confirm(`القايمة الحالية هتتستبدل بكل المنتجات (${L.length} منتج × ${n} ملصق = ${L.length * n} ملصق). تكمّل؟`)) return;
    setRows(L.map((p) => ({ id: p.id, n })));
    toast(`✔ ${L.length} منتج — ${L.length * n} ملصق`);
  };

  const print = () => {
    if (!rows.length) return toast('ضيف صنف واحد على الأقل', 'bad');
    const a4 = size === 'a4';
    const dims = size === '38x25' ? [38, 25] : [50, 30];
    const shopName = shop ? esc(settings?.store.name || '') : '';
    const items: ProductDto[] = [];
    rows.forEach((x) => {
      const p = byId.get(x.id);
      if (p) for (let i = 0; i < x.n; i++) items.push(p);
    });
    const lab = (p: ProductDto) => {
      const v = String(p.barcode || p.code || '').trim();
      const ok = /^[\x20-\x7E]+$/.test(v);
      const color = COL[p.company];
      const bc = ok
        ? `<div class="bcw">${code128Svg(v, 40).replace('<svg ', '<svg class="bc" ')}<div class="bt">${esc(v)}</div></div>`
        : v
          ? `<div class="tx">${esc(v)}</div>`
          : '<div class="tx">مفيش كود</div>';
      return `<div class="lb" style="border-top:1.2mm solid ${color}"><div class="sh" style="color:${color};font-weight:800">${shop ? esc(CO_NAME[p.company]) : shopName}</div><div class="nm">${esc(p.name)}</div>${bc}${price ? `<div class="pr">${esc(money(p.price))}</div>` : ''}</div>`;
    };
    const css = a4
      ? '@page{size:A4;margin:8mm}body{margin:0}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.lb{height:35mm;padding:2mm;box-sizing:border-box;border:1px dashed #ccc}'
      : `@page{size:${dims[0]}mm ${dims[1]}mm;margin:0}body{margin:0}.lb{width:${dims[0]}mm;height:${dims[1]}mm;padding:1.5mm;box-sizing:border-box;page-break-after:always;overflow:hidden}`;
    printHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap"><title>ملصقات</title><style>${css}*{font-family:Cairo,Tahoma,sans-serif}.lb{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.sh{font-size:7pt;color:#555}.nm{font-size:${a4 ? 9 : 8}pt;font-weight:700;line-height:1.2;max-height:2.4em;overflow:hidden}.bcw{width:95%;display:flex;flex-direction:column;align-items:center}.bc{width:100%;height:${a4 ? 12 : dims[1]! > 28 ? 10 : 7}mm}.bt{font-size:8pt;direction:ltr;line-height:1}.tx{font-size:9pt;direction:ltr}.pr{font-size:9pt;font-weight:800}</style></head><body><div class="${a4 ? 'g' : ''}">${items.map(lab).join('')}</div></body></html>`);
  };

  return (
    <Modal title="🏷️ طباعة ملصقات باركود" onClose={close}>
      <div className="form">
        <div className="field">
          <label>المقاس</label>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="50x30">رول 50×30 مم</option>
            <option value="38x25">رول 38×25 مم</option>
            <option value="a4">ورق A4 (3×8 = 24 ملصق)</option>
          </select>
        </div>
        <div className="field">
          <label>يظهر على الملصق</label>
          <label className="chk">
            <input type="checkbox" checked={price} onChange={(e) => setPrice(e.target.checked)} /> سعر البيع
          </label>
          <label className="chk">
            <input type="checkbox" checked={shop} onChange={(e) => setShop(e.target.checked)} /> اسم المحل
          </label>
        </div>
        <div className="field full">
          <label>ضيف أصناف</label>
          <input placeholder="اكتب اسم الصنف..." autoComplete="off" value={add} onChange={(e) => setAdd(e.target.value)} />
          {found.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 200, overflow: 'auto' }}>
              {found.map((p) => (
                <div
                  key={p.id}
                  className="prow"
                  style={{ padding: 9 }}
                  onClick={() => {
                    setRows((r) => (r.some((x) => x.id === p.id) ? r : [...r, { id: p.id, n: 1 }]));
                    setAdd('');
                  }}
                >
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="field full">
          <label>كل المنتجات</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={1} value={allN} onChange={(e) => setAllN(e.target.value)} style={{ width: 80, textAlign: 'center' }} />
            <span style={{ fontSize: 13 }}>ملصق لكل منتج</span>
            <button type="button" className="secondary" style={{ flex: 1 }} onClick={addAll}>
              ➕ ضيف كل المنتجات
            </button>
          </div>
          <small style={{ color: 'var(--muted)' }}>العدد ده بيتطبق على الكل، وبعدها تقدر تغيّر عدد أي منتج لوحده.</small>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {preAll && !products ? (
          <Loading />
        ) : rows.length ? (
          rows.map((x, i) => {
            const p = byId.get(x.id);
            if (!p) return null;
            return (
              <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{p.name}</b>
                  <br />
                  <small style={{ color: 'var(--muted)' }} dir="ltr">
                    {p.barcode || p.code || '—'}
                  </small>
                </div>
                <input
                  type="number"
                  min={1}
                  value={x.n}
                  style={{ width: 70, textAlign: 'center' }}
                  onChange={(e) => setRows((r) => r.map((y, j) => (j === i ? { ...y, n: Math.max(1, parseInt(e.target.value) || 1) } : y)))}
                />
                <button className="secondary danger" type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty">ضيف الأصناف اللي عايز تطبعلها ملصقات</div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" onClick={print}>
          🖨️ طباعة
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

// ---------- باركود جديد ← ربطه بصنف ----------

function LinkBarcode({ code }: { code: string }) {
  const { close } = useModal();
  const toast = useToast();
  const { co } = useCompany();
  const products = useAllProducts({ company: co }).data;
  const update = useUpdateProduct();
  const [q, setQ] = useState('');
  const L = useMemo(() => {
    const w = words(q);
    return (products ?? []).filter((p) => matches(p, w)).slice(0, 40);
  }, [products, q]);
  const link = async (p: ProductDto) => {
    try {
      await update.mutateAsync({ id: p.id, input: { barcode: code } });
      close();
      toast(`✔ الباركود اتربط بـ ${p.name}`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <Modal
      title={
        <>
          باركود جديد: <span dir="ltr">{code}</span>
        </>
      }
      onClose={close}
    >
      <p style={{ marginTop: 0, color: 'var(--muted)' }}>الباركود ده مش متسجل على أي صنف. اختار الصنف اللي تربطه بيه:</p>
      <input placeholder="اكتب اسم الصنف أو الكود..." style={{ width: '100%' }} autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: '50vh', overflow: 'auto', marginTop: 8 }}>
        {L.length ? (
          L.map((p) => (
            <div key={p.id} className="prow" style={{ padding: 11, borderBottom: '1px solid var(--border)' }} onClick={() => void link(p)}>
              <b>{p.name}</b>{' '}
              <small style={{ color: 'var(--muted)' }}>
                {p.code}
                {p.barcode ? ` • عنده باركود ${p.barcode}` : ''}
              </small>
            </div>
          ))
        ) : (
          <div className="empty">مفيش</div>
        )}
      </div>
    </Modal>
  );
}

// ---------- 💰 البضاعة القديمة ----------

function OldGoods() {
  const { close } = useModal();
  const toast = useToast();
  const zero = useZeroCost();
  const estimate = useEstimateCosts();
  const addOld = useAddOldGoods();
  const [pct, setPct] = useState('75');
  const [bulk, setBulk] = useState('');
  const [cat, setCat] = useState('بضاعة قديمة');
  const [unit, setUnit] = useState('قطعة');
  const k = Math.min(99, Math.max(10, num(pct) || 75));
  const z = zero.data;

  const est = async () => {
    try {
      const n = await estimate.mutateAsync(k);
      toast(`✔ اتحسب سعر شراء تقديري لـ ${n} صنف`);
      close();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const add = async () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return toast('اكتب صنف واحد على الأقل', 'bad');
    const bad: string[] = [];
    const ok: { name: string; qty: number; price: number; cost?: number }[] = [];
    for (const l of lines) {
      const f = l.split(/[|،\t]/).map((s) => s.trim());
      const price = num(f[2]);
      if (!f[0] || !(price > 0)) {
        bad.push(l);
        continue;
      }
      const cost = num(f[3]);
      ok.push({ name: f[0], qty: num(f[1]), price, ...(cost > 0 ? { cost } : {}) });
    }
    if (!ok.length) return toast('مفيش سطر سليم — اكتب الاسم | الكمية | السعر', 'bad');
    try {
      const r = await addOld.mutateAsync({ pct: k, category: cat.trim(), unit: unit.trim() || 'قطعة', lines: ok });
      const left = [...bad, ...r.skipped];
      toast(`✔ اتضاف ${r.added} صنف${r.estimated ? ` (${r.estimated} سعر شراء تقديري)` : ''}${left.length ? ` — ${left.length} سطر ماتضافش` : ''}`);
      if (left.length) setBulk(left.join('\n'));
      else close();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <Modal title="💰 البضاعة القديمة" onClose={close}>
      <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>١) أصناف مش فاكر سعر شرائها</h3>
      <p style={{ margin: '0 0 8px', color: '#6b7c82', fontSize: 13, lineHeight: 1.8 }}>
        عندك <b>{z ? z.count : '…'}</b> صنف ليه سعر بيع ومن غير سعر شراء — وده بيبوّظ حساب المكسب. حط نسبة تقريبية والسيستم يحسب سعر الشراء من سعر البيع، ويتعلّم عليه «تقديري» لحد ما تشتريه تاني بسعر حقيقي.
      </p>
      <div className="form">
        <div className="field">
          <label>سعر الشراء = كام % من سعر البيع؟</label>
          <input type="number" min={10} max={99} value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="primary" disabled={!z?.count || estimate.isPending} onClick={est}>
            💰 احسبهم ({z?.count ?? 0} صنف)
          </button>
        </div>
      </div>
      {!!z?.count && (
        <details style={{ margin: '6px 0 0' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>شوف الأصناف</summary>
          <div style={{ maxHeight: 180, overflow: 'auto', fontSize: 13, lineHeight: 1.9 }}>
            {z.items.map((p) => (
              <div key={p.code}>
                {p.code} — {p.name} · {money(p.price)}
              </div>
            ))}
          </div>
        </details>
      )}
      <h3 style={{ fontSize: 15, margin: '16px 0 6px' }}>٢) ضيف بضاعة قديمة بسرعة</h3>
      <p style={{ margin: '0 0 6px', color: '#6b7c82', fontSize: 13, lineHeight: 1.8 }}>
        كل صنف في سطر: <b>الاسم | الكمية | سعر البيع | سعر الشراء</b> — سعر الشراء لو مش فاكره سيبه فاضي والسيستم يحطه تقديري بالنسبة اللي فوق.
      </p>
      <textarea rows={6} placeholder={'مفصلة سوستة 45 سم | 20 | 85\nمقبض ألومنيوم 128 | 50 | 40 | 28'} value={bulk} onChange={(e) => setBulk(e.target.value)} />
      <div className="form">
        <div className="field">
          <label>التصنيف</label>
          <input value={cat} onChange={(e) => setCat(e.target.value)} />
        </div>
        <div className="field">
          <label>الوحدة</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" onClick={add} disabled={addOld.isPending}>
          ➕ ضيف الأصناف
        </button>
        <button type="button" className="secondary" onClick={close}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

// ---------- استيراد أصناف من ملف (PDF / CSV / نصي) ----------

interface ImpRow {
  name: string;
  price: number;
  on: boolean;
  dup: boolean;
}

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }> }> };
}
const loadPdf = () =>
  new Promise<PdfLib>((ok, bad) => {
    const w = window as unknown as { pdfjsLib?: PdfLib };
    if (w.pdfjsLib) return ok(w.pdfjsLib);
    const s = document.createElement('script');
    s.src = PDFJS;
    s.onload = () => (w.pdfjsLib ? ok(w.pdfjsLib) : bad(new Error('lib')));
    s.onerror = () => bad(new Error('lib'));
    document.head.appendChild(s);
  });

const hasAr = (t: string) => (t.match(/[؀-ۿ]/g) || []).length > (t.match(/[A-Za-z]/g) || []).length;
async function pdfLines(file: File): Promise<string[]> {
  const lib = await loadPdf();
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    const it = tc.items.filter((i) => i.str.trim()).map((i) => ({ s: i.str.trim(), x: i.transform[4]!, y: i.transform[5]! })).sort((a, b) => b.y - a.y);
    const cl: { y: number; items: typeof it }[] = [];
    it.forEach((i) => {
      const c = cl.find((c) => Math.abs(c.y - i.y) < 4);
      if (c) c.items.push(i);
      else cl.push({ y: i.y, items: [i] });
    });
    cl.forEach((c) => {
      const rtl = hasAr(c.items.map((i) => i.s).join(' '));
      c.items.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
      out.push(c.items.map((i) => i.s).join(' '));
    });
  }
  return out;
}

function ImportFile() {
  const { close } = useModal();
  const toast = useToast();
  const { co } = useCompany();
  const existing = useAllProducts({ company: co }).data;
  const importNames = useImportNames();
  const [raw, setRaw] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'name' | 'price' | 'cost'>('name');
  const [cat, setCat] = useState('إكسسوارات مطابخ');
  const [edits, setEdits] = useState<Record<number, Partial<ImpRow>>>({});
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const seen = useMemo(() => new Set((existing ?? []).map((p) => p.name.trim())), [existing]);
  const base = useMemo<ImpRow[]>(() => {
    if (!raw) return [];
    return raw
      .map((l) => {
        const t = l.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[،;,\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
        let price = 0;
        let name = t;
        if (mode !== 'name') {
          const m = [...t.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g)];
          if (m.length) {
            price = Number(m[m.length - 1]![1]);
            name = t.replace(/(?:^|\s)\d+(?:\.\d+)?(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }
        return { name, price, on: name.length > 1 && !/^[\d\s.\-]+$/.test(name) && !seen.has(name), dup: seen.has(name) };
      })
      .filter((r) => r.name);
  }, [raw, mode, seen]);
  const rows = base.map((r, i) => ({ ...r, ...edits[i] }));
  const on = rows.filter((r) => r.on).length;
  const patch = (i: number, p: Partial<ImpRow>) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...p } }));

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg('جاري قراءة الملف...');
    try {
      const lines = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfLines(f) : (await f.text()).split(/\r?\n/);
      const clean = lines.map((x) => x.trim()).filter(Boolean);
      if (!clean.length) throw new Error('empty');
      setEdits({});
      setRaw(clean);
      setMsg('');
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'lib' ? 'أداة قراءة الـ PDF لم تتحمل — تأكد من الإنترنت وجرب تاني.' : m === 'empty' ? 'مفيش نص في الملف (ممكن يكون صورة ممسوحة).' : 'تعذّر قراءة الملف.');
    }
  };

  const add = async () => {
    const sel = rows.filter((r) => r.on && r.name.trim());
    if (!sel.length) return toast('اختار صنف واحد على الأقل', 'bad');
    try {
      await importNames.mutateAsync({
        category: cat.trim() || 'إكسسوارات مطابخ',
        rows: sel.map((r) => ({ name: r.name.trim(), price: mode === 'price' ? r.price || 0 : 0, cost: mode === 'cost' ? r.price || 0 : 0 })),
      });
      close();
      toast(`تمت إضافة ${sel.length} صنف بكمية صفر`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <Modal title="استيراد أصناف من ملف" onClose={close}>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13 }}>
        اختار ملف PDF (أو CSV / نصي) فيه أسماء الأصناف. الأصناف بتتضاف <b>بكمية صفر</b> وانت بتجرد وتضيف الكميات بعدين.
      </p>
      <button type="button" className="primary" style={{ width: '100%', padding: 14 }} onClick={() => fileRef.current?.click()}>
        اختيار ملف
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv,.txt,application/pdf,text/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void pick(f);
        }}
      />
      <div style={{ marginTop: 14 }}>
        {msg ? (
          <div className={msg.startsWith('جاري') ? 'empty' : undefined} style={msg.startsWith('جاري') ? undefined : { color: 'var(--danger)' }}>
            {msg}
          </div>
        ) : raw ? (
          <>
            <div className="form" style={{ marginBottom: 10 }}>
              <div className="field">
                <label>شكل السطر في الملف</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                  <option value="name">اسم الصنف فقط</option>
                  <option value="price">اسم + آخر رقم = سعر البيع</option>
                  <option value="cost">اسم + آخر رقم = سعر الشراء</option>
                </select>
              </div>
              <div className="field">
                <label>التصنيف</label>
                <input value={cat} onChange={(e) => setCat(e.target.value)} />
              </div>
            </div>
            <div className="btnrow" style={{ marginBottom: 8 }}>
              <button type="button" className="secondary" onClick={() => setEdits(Object.fromEntries(base.map((_, i) => [i, { ...edits[i], on: true }])))}>
                تحديد الكل
              </button>
              <button type="button" className="secondary" onClick={() => setEdits(Object.fromEntries(base.map((_, i) => [i, { ...edits[i], on: false }])))}>
                إلغاء الكل
              </button>
            </div>
            <div style={{ maxHeight: '46vh', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={r.on} onChange={(e) => patch(i, { on: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--blue)', flex: 'none' }} />
                  <input value={r.name} onChange={(e) => patch(i, { name: e.target.value })} style={{ flex: 1, minWidth: 0, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} />
                  {mode !== 'name' && (
                    <input type="number" step="0.01" value={r.price || ''} onChange={(e) => patch(i, { price: Number(e.target.value) })} style={{ width: 80, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} />
                  )}
                  {r.dup && <span className="badge red">موجود</span>}
                </div>
              ))}
            </div>
            <button type="button" className="primary" style={{ width: '100%', padding: 14, marginTop: 12 }} onClick={add} disabled={importNames.isPending}>
              إضافة {on} صنف
            </button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------- 🔪 فك لفة / تقسيم ----------

function PickProduct({ label, value, onPick }: { label: string; value: ProductDto | null; onPick: (p: ProductDto | null) => void }) {
  const [q, setQ] = useState('');
  const list = useProducts({ q: q.trim() || undefined, pageSize: 6 }, !!q.trim() && !value).data?.items ?? [];
  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div style={{ padding: 12, border: '1.5px solid var(--green)', borderRadius: 10 }}>
          <b>{value.name}</b> — رصيد {qtyText(value.qty)} {value.unit}{' '}
          <button type="button" style={{ float: 'left', border: 0, background: 'transparent', color: 'var(--danger)' }} onClick={() => onPick(null)}>
            تغيير
          </button>
        </div>
      ) : (
        <>
          <input placeholder={`🔍 ابحث عن ${label.includes('الكبير') ? 'الصنف الكبير' : 'الصنف الصغير'}`} style={{ width: '100%', padding: 14 }} value={q} onChange={(e) => setQ(e.target.value)} />
          {list.map((p) => (
            <div key={p.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, marginTop: 6, cursor: 'pointer' }} onClick={() => onPick(p)}>
              <b>{p.name}</b> <small style={{ color: 'var(--muted)' }}>رصيد {qtyText(p.qty)} {p.unit}</small>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Split() {
  const { close } = useModal();
  const toast = useToast();
  const split = useSplitProduct();
  const [s, setS] = useState<ProductDto | null>(null);
  const [t, setT] = useState<ProductDto | null>(null);
  const [ratio, setRatio] = useState('');
  const [qty, setQty] = useState('');
  const r = num(ratio);
  const q = num(qty);
  const add = r * q;
  const unitCost = s && r ? (s.cost ?? 0) / r : 0;
  const newCost = t && add > 0 ? (t.qty * (t.cost ?? 0) + add * unitCost) / (t.qty + add) : 0;
  const ready = !!s && !!t && add > 0;
  const round = (v: number) => Math.round(v * 100) / 100;

  const go = async () => {
    if (!s || !t) return;
    if (s.id === t.id) return toast('اختار صنفين مختلفين', 'bad');
    try {
      await split.mutateAsync({ sourceId: s.id, targetId: t.id, ratio: r, qty: q });
      close();
      toast(`✔ اتفك: ${q} ← ${add}`);
    } catch (e) {
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };

  return (
    <Modal title="🔪 فك لفة / تقسيم صنف" onClose={close}>
      <div style={{ lineHeight: 1.9, color: 'var(--muted)', fontSize: 14 }}>مثال: لفة ٥٠ متر ← متر. بتخصم لفات من الصنف الكبير وتزوّد الصغير بالعدد المقابل، والتكلفة بتتوزع لوحدها.</div>
      <PickProduct label="الصنف الكبير (اللي هتفكه)" value={s} onPick={setS} />
      <PickProduct label="الصنف الصغير (اللي هيتزوّد)" value={t} onPick={setT} />
      <div className="field">
        <label>الوحدة الكبيرة فيها كام وحدة صغيرة؟</label>
        <input type="number" step="any" inputMode="decimal" placeholder="مثال: 50" value={ratio} onChange={(e) => setRatio(e.target.value)} />
      </div>
      <div className="field">
        <label>هتفك كام وحدة كبيرة؟</label>
        <input type="number" step="any" inputMode="decimal" placeholder="مثال: 2" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      {ready && (
        <div className="card" style={{ background: 'var(--tint2)', border: 0, lineHeight: 2 }}>
          {s.name}: {qtyText(s.qty)} ← <b>{qtyText(round(s.qty - q))}</b>
          <br />
          {t.name}: {qtyText(t.qty)} ← <b>{qtyText(round(t.qty + add))}</b>
          <br />
          تكلفة الوحدة الصغيرة: <b>{money(unitCost)}</b>
          {(t.cost ?? 0) !== round(newCost) ? ` (المتوسط الجديد ${money(newCost)})` : ''}
        </div>
      )}
      <button type="button" className="primary" style={{ width: '100%', padding: 16, marginTop: 10 }} disabled={!ready || split.isPending} onClick={go}>
        تنفيذ الفك
      </button>
      {s && q > s.qty && <div style={{ color: '#b45309', marginTop: 6 }}>⚠️ الكمية أكبر من رصيد الصنف الكبير — هيتنفذ والرصيد يبقى بالسالب.</div>}
    </Modal>
  );
}

// ---------- إعادة تصنيف الأصناف (openRecat القديمة) ----------

const RC_DEF = 'إكسسوارات مطابخ';
const RC_H = 'مفصلات';
const RC_R = 'مجرى الادراج';
const reHinge = /(^| )عدل|باكم|3d|ثري دي|مفصل/;
const reRunS = /مجري|مجار/;
const reRunW = /جانبي|سفلي/;
function classify(name: string) {
  const t = vn(name);
  const h = reHinge.test(t);
  const rs = reRunS.test(t);
  const rw = reRunW.test(t);
  return { cat: rs ? RC_R : h ? RC_H : rw ? RC_R : '', conflict: h && (rs || rw) };
}

function Recat() {
  const { close } = useModal();
  const toast = useToast();
  const all = useAllProducts({}).data;
  const recat = useRecat();
  const [forceAll, setForceAll] = useState(false);
  const res = useMemo(
    () =>
      (all ?? []).map((p) => {
        const c = classify(p.name);
        return { p, to: c.cat, conflict: c.conflict, manual: !!p.category && p.category !== RC_DEF && p.category !== c.cat };
      }),
    [all],
  );
  if (!all)
    return (
      <Modal title="إعادة تصنيف الأصناف" onClose={close}>
        <Loading />
      </Modal>
    );
  const H = res.filter((x) => x.to === RC_H);
  const R = res.filter((x) => x.to === RC_R);
  const M = res.filter((x) => x.to && x.manual);
  const eff = res.filter((x) => x.to && (forceAll || !x.manual) && x.p.category !== x.to);
  const rows = (list: typeof res, n: number) => (
    <>
      {list.slice(0, n).map((x) => (
        <div key={x.p.id} style={{ fontSize: 13, padding: '2px 0' }}>
          {x.p.name}
          {x.conflict && (
            <>
              {' '}
              <span className="badge red">تعارض</span>
            </>
          )}
        </div>
      ))}
      {list.length > n && <div style={{ fontSize: 12, color: 'var(--muted)' }}>و {list.length - n} غيرهم…</div>}
    </>
  );
  const go = () => {
    if (!eff.length) {
      close();
      return toast('مفيش حاجة اتغيرت');
    }
    recat.mutate(
      eff.map((x) => ({ id: x.p.id, category: x.to })),
      {
        onSuccess: (n) => {
          close();
          toast(`تم تغيير تصنيف ${n} صنف`);
        },
        onError: (e) => toast(errorMessage(e), 'bad'),
      },
    );
  };
  return (
    <Modal title="إعادة تصنيف الأصناف" onClose={close}>
      <div className="card" style={{ lineHeight: 1.9 }}>
        <b>{H.length}</b> صنف → <b>{RC_H}</b>
        <br />
        <b>{R.length}</b> صنف → <b>{RC_R}</b>
        <br />
        باقي الأصناف (<b>{res.length - H.length - R.length}</b>) هتفضل زي ما هي.
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0', fontSize: 14 }}>
        <input type="checkbox" checked={forceAll} onChange={(e) => setForceAll(e.target.checked)} /> غيّر كمان الأصناف اللي تصنيفها اتعدل يدوي ({M.length} صنف)
      </label>
      <div className="card" style={{ marginBottom: 8 }}>
        <b>{RC_H}</b>
        {rows(H, 10)}
      </div>
      <div className="card" style={{ marginBottom: 8 }}>
        <b>{RC_R}</b>
        {rows(R, 10)}
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={recat.isPending} onClick={go}>
          تطبيق على {eff.length} صنف
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

export function ProductToolModal({ spec }: { spec: ProductToolSpec }) {
  switch (spec.kind) {
    case 'recat':
      return <Recat />;
    case 'bulkPrice':
      return <BulkPrice />;
    case 'printProducts':
      return <PrintProducts q={spec.q} stock={spec.stock} />;
    case 'labels':
      return <Labels key={spec.all ? 'all' : 'some'} all={spec.all} />;
    case 'linkBarcode':
      return <LinkBarcode code={spec.code} />;
    case 'oldGoods':
      return <OldGoods />;
    case 'importFile':
      return <ImportFile />;
    case 'split':
      return <Split />;
  }
}
