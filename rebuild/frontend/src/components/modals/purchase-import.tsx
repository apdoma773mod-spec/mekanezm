'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InvoiceListItem, Paginated } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { vn } from '@/lib/import-daily';
import { useAllProducts } from '@/lib/trade-queries';
import { loadXlsx } from '../daybook/import-daily';
import { useCompany } from '../company';
import { Portal } from '../ui/portal';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';
import { useQueryClient } from '@tanstack/react-query';

/** 📥 استيراد فواتير شراء من أبلكيشن قديم (Excel / CSV / JSON): ربط الأعمدة ← مراجعة بدرجة ثقة ← منع تكرار ← حفظ. */
const ar = (s: unknown) => String(s == null ? '' : s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const nv = (v: unknown) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(ar(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.'));
  return Number.isNaN(n) ? 0 : n;
};
const r2 = (x: number) => Math.round(x * 100) / 100;

const FIELDS: [string, string, string[]][] = [
  ['sup', 'المورد', ['مورد', 'المورد', 'اسم المورد', 'supplier', 'vendor', 'العميل', 'الشركه', 'الشركة']],
  ['date', 'التاريخ', ['تاريخ', 'التاريخ', 'date', 'يوم']],
  ['no', 'رقم الفاتورة', ['رقم الفاتوره', 'رقم الفاتورة', 'رقم', 'فاتوره', 'فاتورة', 'invoice', 'invoice_no', 'no', 'number', 'inv']],
  ['prod', 'الصنف', ['الصنف', 'صنف', 'المنتج', 'اسم الصنف', 'البيان', 'بيان', 'item', 'product', 'name', 'description']],
  ['qty', 'الكمية', ['الكميه', 'الكمية', 'كميه', 'كمية', 'عدد', 'العدد', 'qty', 'quantity']],
  ['price', 'السعر', ['السعر', 'سعر', 'سعر الوحدة', 'سعر الوحده', 'سعر الشراء', 'price', 'unit_price', 'cost']],
  ['total', 'إجمالي السطر (اختياري)', ['الاجمالي', 'إجمالي', 'الإجمالي', 'المجموع', 'total', 'amount']],
  ['paid', 'المدفوع (اختياري)', ['مدفوع', 'المدفوع', 'paid', 'دفع']],
];

type Cell = unknown;
interface Item {
  name: string;
  qty: number;
  price: number;
  pid: string | null;
  pname: string;
  s: number;
  on: boolean;
}
interface Inv {
  sup: string;
  date: string;
  no: string;
  items: Item[];
  paid: number | null;
  on: boolean;
  total: number;
  conf: number;
  dup: boolean;
}

function pdate(v: Cell): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = ar(v).trim();
  let m = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  return '';
}

function flatJSON(j: unknown): Record<string, unknown>[] {
  if (Array.isArray(j) && j.length && j.every((x) => x && typeof x === 'object')) {
    const arr = j as Record<string, unknown>[];
    if (arr.some((x) => Array.isArray(x.items || x.lines || x.details))) {
      const out: Record<string, unknown>[] = [];
      arr.forEach((inv) => {
        ((inv.items || inv.lines || inv.details || []) as Record<string, unknown>[]).forEach((it) => out.push({ ...inv, ...it, items: undefined, lines: undefined, details: undefined }));
      });
      return out;
    }
    return arr;
  }
  if (j && typeof j === 'object') {
    const o = j as Record<string, unknown>;
    const k = Object.keys(o).find((k) => Array.isArray(o[k]));
    if (k) return flatJSON(o[k]);
  }
  return [];
}

export function PurchaseImport() {
  const { close } = useModal();
  const toast = useToast();
  const qc = useQueryClient();
  const { co } = useCompany();
  const products = useAllProducts({}).data;
  const [step, setStep] = useState<'start' | 'mapping' | 'review'>('start');
  const [hdr, setHdr] = useState<string[]>([]);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [credit, setCredit] = useState(false);
  const [inv, setInv] = useState<Inv[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pick = (accept: string, cb: (f: File) => void) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.style.display = 'none';
    document.body.appendChild(i);
    i.onchange = () => {
      const f = i.files?.[0];
      i.remove();
      if (f) cb(f);
    };
    i.click();
  };

  const readFile = async (f: File) => {
    try {
      let h: string[] = [];
      let r: Cell[][] = [];
      if (/\.json$/i.test(f.name) || /\.txt$/i.test(f.name)) {
        const arr = flatJSON(JSON.parse(await f.text()));
        if (!arr.length) throw new Error('الملف مفيهوش فواتير');
        h = [...new Set(arr.flatMap((x) => Object.keys(x).filter((k) => x[k] !== undefined)))];
        r = arr.map((x) => h.map((k) => (x[k] == null ? '' : x[k])));
      } else {
        const X = await loadXlsx();
        const wb = /[.](csv|tsv)$/i.test(f.name) ? X.read(await f.text(), { type: 'string', cellDates: true }) : X.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
        let best: Cell[][] | null = null;
        wb.SheetNames.forEach((n) => {
          const a = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).filter((row) => row.some((c) => c !== ''));
          if (a.length > 1 && (!best || a.length > best.length)) best = a;
        });
        if (!best) throw new Error('الملف فاضي');
        const b: Cell[][] = best;
        let hi = 0;
        for (let i = 0; i < Math.min(b.length, 15); i++) {
          if (b[i]!.filter((c) => typeof c === 'string' && c.trim()).length >= 3) {
            hi = i;
            break;
          }
        }
        h = b[hi]!.map((c, i) => String(c || `عمود ${i + 1}`).trim());
        r = b.slice(hi + 1);
      }
      const m: Record<string, number> = {};
      FIELDS.forEach(([k, , syn]) => {
        const sn = syn.map((x) => vn(x));
        const i = h.findIndex((x) => sn.includes(vn(x)));
        if (i >= 0) m[k] = i;
        else {
          const j = h.findIndex((x) => sn.some((s) => s.length > 2 && vn(x).includes(s)));
          if (j >= 0 && !Object.values(m).includes(j)) m[k] = j;
        }
      });
      setHdr(h);
      setRows(r);
      setMap(m);
      setStep('mapping');
    } catch (e) {
      toast(`❌ ${(e as Error)?.message || e}`, 'bad');
    }
  };

  const match = (name: string) => {
    const n = vn(name);
    if (!n) return { p: null, s: 0 };
    let best: { id: string; name: string } | null = null;
    let bs = 0;
    const nt = n.split(' ').filter(Boolean);
    for (const p of products ?? []) {
      const pn = vn(p.name);
      if (pn === n) return { p, s: 1 };
      const pt = pn.split(' ').filter(Boolean);
      if (!pt.length) continue;
      let sh = 0;
      nt.forEach((t) => {
        if (pt.some((q) => q === t || (t.length > 2 && q.length > 2 && (q.startsWith(t) || t.startsWith(q))))) sh++;
      });
      const sc = (sh / Math.max(nt.length, pt.length)) * 0.9 + (pn.includes(n) || n.includes(pn) ? 0.1 : 0);
      if (sc > bs) {
        bs = sc;
        best = p;
      }
    }
    return bs >= 0.5 ? { p: best, s: Math.min(0.99, bs) } : { p: null, s: 0 };
  };

  const build = async () => {
    const g = (r: Cell[], k: string) => (map[k] == null ? '' : r[map[k]!]);
    const grouped = new Map<string, Inv>();
    rows.forEach((r) => {
      const name = String(g(r, 'prod') || '').trim();
      const q = nv(g(r, 'qty'));
      if (!name || !(q > 0)) return;
      let pr = nv(g(r, 'price'));
      const tot = nv(g(r, 'total'));
      if (!pr && tot) pr = tot / q;
      const sup = String(g(r, 'sup') || '').trim();
      const date = pdate(g(r, 'date')) || new Date().toISOString().slice(0, 10);
      const no = String(g(r, 'no') || '').trim();
      const key = `${sup}|${no}|${no ? '' : date}`;
      if (!grouped.has(key)) grouped.set(key, { sup, date, no, items: [], paid: null, on: true, total: 0, conf: 0, dup: false });
      const I = grouped.get(key)!;
      if (map.paid != null && g(r, 'paid') !== '') I.paid = (I.paid || 0) + nv(g(r, 'paid'));
      const m = match(name);
      I.items.push({ name, qty: q, price: r2(pr), pid: m.p ? m.p.id : null, pname: m.p ? m.p.name : '', s: m.s, on: true });
    });
    // existing purchases, to catch the same invoice imported twice
    const exist: InvoiceListItem[] = [];
    try {
      for (let page = 1; page < 60; page++) {
        const r = await api.get<Paginated<InvoiceListItem>>('/invoices', { kind: 'PURCHASE', page, pageSize: 200 });
        exist.push(...r.items);
        if (exist.length >= r.total || !r.items.length) break;
      }
    } catch {
      /* the duplicate check is best effort */
    }
    const list = [...grouped.values()].map((I) => {
      I.total = r2(I.items.reduce((s, x) => s + x.qty * x.price, 0));
      I.conf = I.items.length ? Math.round((I.items.reduce((s, x) => s + (x.pid ? x.s : 0.3), 0) / I.items.length) * 100) : 0;
      I.dup = exist.some((r) => r.person.trim() === I.sup && ((I.no && r.note.includes(I.no)) || (r.date === I.date && Math.abs(r.total - I.total) < 0.01)));
      I.on = !I.dup && I.conf >= 50;
      return I;
    });
    setInv(list);
    setStep('review');
  };

  const sel = inv.filter((i) => i.on);
  const save = async () => {
    if (!sel.length) return;
    if (!window.confirm(`هيتسجل ${sel.length} فاتورة شراء على السيرفر وتتحدث المخزن. متأكد؟`)) return;
    setSaving(true);
    let n = 0;
    const errs: string[] = [];
    for (const I of sel) {
      const items = I.items.filter((x) => x.on).map((x) => ({ productId: x.pid || undefined, name: x.pid ? x.pname : x.name, qty: x.qty, price: x.price }));
      if (!items.length) continue;
      const tot = r2(items.reduce((s, x) => s + x.qty * x.price, 0));
      const paid = I.paid != null ? Math.min(tot, I.paid) : credit ? 0 : tot;
      try {
        await api.post('/invoices', {
          kind: 'PURCHASE',
          company: co,
          date: I.date,
          person: I.sup || 'مورد',
          note: `${I.no ? `فاتورة المورد: ${I.no} — ` : ''}مستورد من ملف`,
          paid,
          items,
        });
        n++;
      } catch (e) {
        errs.push(`${I.sup || '—'} ${I.no || ''}: ${errorMessage(e)}`);
      }
    }
    for (const key of ['invoices', 'products', 'contacts', 'market']) void qc.invalidateQueries({ queryKey: [key] });
    setSaving(false);
    toast(`✔ اتسجلت ${n} فاتورة`);
    if (errs.length) window.alert(`فواتير ماتسجلتش:\n${errs.join('\n')}`);
    close();
  };

  const seed = useMemo(() => rows[0] ?? [], [rows]);
  const bt = (primary: boolean) => ({ padding: '13px 16px', fontSize: 16, fontWeight: 700, borderRadius: 12, width: '100%', marginTop: 8 }) as const;
  const sel2 = { width: '100%', padding: 11, marginTop: 4, border: '1px solid var(--border)', borderRadius: 10, fontSize: 16 } as const;

  return (
    <Portal>
      <div id="mkPvImp" style={{ position: 'fixed', inset: 0, zIndex: 56, background: 'var(--bg,#f5f7f8)', color: 'var(--text,#18343a)', overflow: 'auto', direction: 'rtl', padding: '12px 14px 90px' }}>
        {step === 'start' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>📥 استيراد فواتير شراء</h2>
              <button type="button" className="secondary" onClick={close}>
                ✕
              </button>
            </div>
            <div className="card" style={{ marginTop: 12, lineHeight: 1.9 }}>
              اختار الطريقة:
              <br />
              <b>1) ملف</b> من الأبلكيشن القديم: Excel أو CSV أو JSON.
              <br />
              <b>2) صور</b> فواتير ورقية: بتتقري بالذكاء الاصطناعي وتلاقيها في «قراءة الفواتير بالصورة».
            </div>
            <button type="button" className="primary" style={bt(true)} onClick={() => pick('.xlsx,.xls,.xlsm,.csv,.json,.txt', (f) => void readFile(f))}>
              📄 اختار ملف (Excel / CSV / JSON)
            </button>
            <button type="button" className="secondary" style={bt(false)} onClick={() => toast('قراءة صور الفواتير بالذكاء الاصطناعي لسه محتاجة مفتاح الخدمة على السيرفر الجديد', 'bad')}>
              🖼️ ارفع صور فواتير (قراءة OCR)
            </button>
          </>
        )}
        {step === 'mapping' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>ربط الأعمدة</h2>
              <button type="button" className="secondary" onClick={() => setStep('start')}>
                ← رجوع
              </button>
            </div>
            <div className="card" style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
              السيستم خمّن الأعمدة. صحّح لو غلط. لازم تحدد: الصنف والكمية والسعر (والمورد لو موجود).
            </div>
            {FIELDS.map(([k, l]) => (
              <div key={k} className="card" style={{ marginTop: 8, padding: 10 }}>
                <label style={{ fontWeight: 700 }}>{l}</label>
                <select
                  value={map[k] ?? ''}
                  style={sel2}
                  onChange={(e) =>
                    setMap((m) => {
                      const n = { ...m };
                      if (e.target.value === '') delete n[k];
                      else n[k] = Number(e.target.value);
                      return n;
                    })
                  }
                >
                  <option value="">— مفيش —</option>
                  {hdr.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--muted)' }}>مثال: {String(map[k] != null ? (seed[map[k]!] ?? '') : '')}</small>
              </div>
            ))}
            <div className="card" style={{ marginTop: 8 }}>
              <label style={{ fontWeight: 700 }}>المدفوع لو مفيش عمود مدفوع</label>
              <select value={credit ? '1' : '0'} onChange={(e) => setCredit(e.target.value === '1')} style={sel2}>
                <option value="0">اعتبرها مدفوعة بالكامل</option>
                <option value="1">اعتبرها آجل (على المورد)</option>
              </select>
            </div>
            <button
              type="button"
              className="primary"
              style={bt(true)}
              onClick={() => {
                if (map.prod == null || map.qty == null || map.price == null) return toast('حدد أعمدة الصنف والكمية والسعر', 'bad');
                void build();
              }}
            >
              التالي: مراجعة الفواتير ←
            </button>
          </>
        )}
        {step === 'review' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>مراجعة قبل الحفظ</h2>
              <button type="button" className="secondary" onClick={() => setStep('mapping')}>
                ← رجوع
              </button>
            </div>
            <div className="card" style={{ marginTop: 10, lineHeight: 1.9 }}>
              <b>{inv.length}</b> فاتورة — هتتحفظ <b>{sel.length}</b> — إجمالي <b>{money(sel.reduce((s, i) => s + i.total, 0))}</b>
              <br />
              <small style={{ color: 'var(--muted)' }}>🟢 ثقة عالية (≥80%) • 🟡 متوسطة • 🔴 ضعيفة • ♻️ مكررة (مش هتتحفظ غير لو علّمتها)</small>
            </div>
            {inv.length ? (
              inv.map((I, n) => (
                <div key={n} className="card" style={{ marginTop: 10, opacity: I.dup ? 0.75 : 1 }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="checkbox" checked={I.on} style={{ width: 24, height: 24 }} onChange={(e) => setInv((L) => L.map((x, i) => (i === n ? { ...x, on: e.target.checked } : x)))} />
                    <div style={{ flex: 1 }}>
                      <b>{I.sup || 'بدون مورد'}</b>
                      {I.no ? ` — ${I.no}` : ''}
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {I.date} — {I.items.length} صنف — {money(I.total)}
                      </div>
                    </div>
                    <span>
                      {I.dup ? '♻️' : I.conf >= 80 ? '🟢' : I.conf >= 50 ? '🟡' : '🔴'} {I.conf}%
                    </span>
                  </label>
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer' }}>الأصناف</summary>
                    {I.items.map((x, j) => (
                      <div key={j} style={{ borderTop: '1px dashed var(--border)', padding: '6px 0', fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={x.on}
                          onChange={(e) => setInv((L) => L.map((y, i) => (i === n ? { ...y, items: y.items.map((z, k) => (k === j ? { ...z, on: e.target.checked } : z)) } : y)))}
                        />{' '}
                        {x.name} × {x.qty} @ {money(x.price)}
                        <div style={{ fontSize: 12, color: x.pid ? '#159447' : '#c0392b' }}>{x.pid ? `← ${x.pname} (${Math.round(x.s * 100)}%)` : 'صنف جديد — هيتسجل في المخزن'}</div>
                      </div>
                    ))}
                  </details>
                </div>
              ))
            ) : (
              <div className="card">
                <div className="empty">ما لقيتش فواتير — راجع ربط الأعمدة.</div>
              </div>
            )}
            {sel.length > 0 && (
              <button type="button" className="primary" style={bt(true)} disabled={saving} onClick={() => void save()}>
                {saving ? '⏳ بيحفظ...' : `✔ احفظ ${sel.length} فاتورة شراء`}
              </button>
            )}
          </>
        )}
      </div>
    </Portal>
  );
}
