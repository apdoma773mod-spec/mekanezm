'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContactDto, Paginated, ProductDto } from '@mk/shared';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import { fingerprint, groupRows, matchAll, parseAoa, vn, type ImpGroup, type ImpRow, type ImpSheet } from '@/lib/import-daily';
import { invalidateTrade } from '@/lib/trade-queries';

/** 📥 استيراد يومية من Excel — نفس شاشة القديم: ملف، ورقة، تاريخ، تجميع الصفوف، مطابقة الأصناف، تأكيد. */
const XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
interface Xlsx {
  read: (data: ArrayBuffer, o: unknown) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (s: unknown, o: unknown) => unknown[][] };
}
const loadXlsx = () =>
  new Promise<Xlsx>((ok, bad) => {
    const w = window as unknown as { XLSX?: Xlsx };
    if (w.XLSX) return ok(w.XLSX);
    const s = document.createElement('script');
    s.src = XLSX_SRC;
    s.onload = () => (w.XLSX ? ok(w.XLSX) : bad(new Error('x')));
    s.onerror = () => bad(new Error('مكتبة الإكسل ما اتحملتش — اتأكد من النت'));
    document.head.appendChild(s);
  });

async function fetchAll<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 100; page++) {
    const r = await api.get<Paginated<T>>(path, { ...query, page, pageSize: 200 });
    out.push(...r.items);
    if (out.length >= r.total || !r.items.length) break;
  }
  return out;
}

const btnSm = { padding: '3px 8px', fontSize: 12 } as const;

export function ImportDailyButton({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [sheets, setSheets] = useState<ImpSheet[] | null>(null);
  return (
    <>
      <button
        type="button"
        className="secondary"
        onClick={async () => {
          try {
            await loadXlsx();
            file.current?.click();
          } catch (e) {
            toast(errorMessage(e), 'bad');
          }
        }}
      >
        {children}
      </button>
      <input
        ref={file}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const X = await loadXlsx();
            const wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
            const list: ImpSheet[] = [];
            for (const n of wb.SheetNames) {
              const p = parseAoa(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
              if (p && p.rows.length) list.push({ name: n, ...p });
            }
            if (!list.length) return toast('ما لقيتش جدول يومية (لازم أعمدة: الصنف، عدد، سعر)', 'bad');
            setSheets(list);
          } catch {
            toast('تعذر قراءة الملف', 'bad');
          }
        }}
      />
      {sheets && <ImportModal sheets={sheets} onClose={() => setSheets(null)} />}
    </>
  );
}

function ImportModal({ sheets, onClose }: { sheets: ImpSheet[]; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [customers, setCustomers] = useState<ContactDto[]>([]);
  const [cur, setCur] = useState(0);
  const [iso, setIso] = useState('');
  const [mode, setMode] = useState<'each' | 'one'>('one');
  const [rows, setRows] = useState<ImpRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([fetchAll<ProductDto>('/products'), fetchAll<ContactDto>('/contacts', { type: 'CUSTOMER' })]).then(([p, c]) => {
      setProducts(p);
      setCustomers(c.filter((x) => x.type === 'CUSTOMER'));
    });
  }, []);

  // pick a sheet: copy its rows, match registered customers by name, then match the products
  useEffect(() => {
    if (!products.length && !customers.length) return;
    const s = sheets[cur];
    const R = s.rows.map((r) => ({ ...r }));
    R.forEach((r) => {
      const k = vn(r.cust || '');
      if (k) {
        const c = customers.find((x) => vn(x.name) === k);
        if (c) r.cust = c.name;
      }
    });
    matchAll(R, products);
    setIso(s.iso || todayYmd());
    setRows(R);
    setMode('one');
  }, [cur, sheets, products, customers]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const G: ImpGroup[] = useMemo(() => groupRows(rows, mode), [rows, mode]);
  const upd = (i: number, patch: Partial<ImpRow>) => setRows((R) => R.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const setGroup = (gi: number, patch: Partial<ImpRow>) => setRows((R) => R.map((r, k) => (G[gi]?.idx.includes(k) ? { ...r, ...patch } : r)));

  const tot = rows.reduce((s, r) => s + r.qty * r.price, 0);
  const bad = rows.filter((r) => !r.pid && !r.isNew).length;
  const credit = rows.filter((r) => r.pay === 'credit').reduce((s, r) => s + r.qty * r.price, 0);
  const need = new Map<string, number>();
  rows.forEach((r) => r.pid && need.set(r.pid, (need.get(r.pid) || 0) + r.qty));
  const warn = [...need].filter(([id, q]) => q > (byId.get(id)?.qty ?? 0)).map(([id]) => byId.get(id)!.name);

  const go = async () => {
    const ok = rows.filter((r) => r.pid || r.isNew);
    if (!ok.length) return toast('مفيش أصناف متطابقة نستورد منها', 'bad');
    const groups = G.map((g) => ({ ...g, idx: g.idx.filter((i) => rows[i].pid || rows[i].isNew) })).filter((g) => g.idx.length);
    if (groups.some((g) => !vn(g.cust) && g.idx.some((i) => rows[i].pay === 'credit'))) return toast('فيه فاتورة آجل من غير اسم عميل — اكتب الاسم', 'bad');
    const date = iso || todayYmd();
    const sig = fingerprint(date, sheets[cur].rows);
    let seenMsg = '';
    try {
      const s = await api.get<{ seen: { at: string; n: number } | null }>('/daybook-import/seen', { sig });
      if (s.seen) seenMsg = `⛔ الملف ده اتستورد قبل كده (${s.seen.at.slice(0, 16).replace('T', ' ')} — ${s.seen.n} فاتورة).\n\n`;
    } catch {
      /* the server checks again on save */
    }
    const skipped = rows.length - ok.length;
    const msg = `${seenMsg}${skipped ? `${skipped} صنف مش متطابق هيتخطى.\n\n` : ''}هيتسجل ${groups.length} فاتورة بتاريخ ${date} — الإجمالي ${money(ok.reduce((s, r) => s + r.qty * r.price, 0))}.\nالمخزون هيتخصم بعد الموافقة. متأكد؟`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const invoices = groups.map((g) => {
        const nm = (g.cust || '').trim();
        return {
          person: nm || 'يومية',
          noContact: !nm,
          paid: Math.round(g.idx.filter((i) => rows[i].pay !== 'credit').reduce((s, i) => s + rows[i].qty * rows[i].price, 0) * 100) / 100,
          note: `استيراد يومية Excel${g.idx.map((i) => rows[i].note).filter(Boolean).length ? ` — ${g.idx.map((i) => rows[i].note).filter(Boolean).join(' - ')}` : ''}`,
          items: g.idx.map((i) => {
            const r = rows[i];
            const p = r.pid ? byId.get(r.pid) : undefined;
            return { productId: p?.id, name: p?.name ?? r.prod, qty: r.qty, price: r.price, pay: r.pay };
          }),
        };
      });
      const res = await api.post<{ invoices: { no: string }[] }>('/daybook-import', { date, sig, force: !!seenMsg, invoices });
      invalidateTrade(qc);
      void qc.invalidateQueries({ queryKey: ['daybook'] });
      toast(`✔ تم استيراد ${res.invoices.length} فاتورة — وظهرت في «📒 يومية المحل» بتاريخ ${date}`);
      onClose();
    } catch (e) {
      setBusy(false);
      window.alert(`الاستيراد اتلغى — مفيش ولا فاتورة اتسجلت.\n\n${errorMessage(e)}`);
    }
  };

  const status = (i: number) => {
    const r = rows[i];
    if (r.pid) return <span style={{ color: '#159447' }}>✓ متطابق</span>;
    if (r.isNew)
      return (
        <>
          <span style={{ color: '#1d4ed8' }}>➕ هيتضاف صنف جديد بالاسم ده</span>{' '}
          <button type="button" className="secondary" style={btnSm} onClick={() => upd(i, { isNew: false })}>
            تراجع
          </button>
        </>
      );
    const h = r.hint ? byId.get(r.hint) : undefined;
    return (
      <>
        <span style={{ color: '#c0392b' }}>⚠ مش لاقيه في المخزون — اختار الصح من الخانة أو</span>
        {h && (
          <>
            {' '}
            <button type="button" className="secondary" style={btnSm} onClick={() => upd(i, { pid: r.hint, isNew: false })}>
              تقصد: {h.name}؟
            </button>
          </>
        )}{' '}
        <button type="button" className="secondary" style={btnSm} onClick={() => upd(i, { isNew: true, pid: '' })}>
          ➕ صنف جديد
        </button>
      </>
    );
  };

  return (
    <Modal title="استيراد يومية البيع" onClose={onClose} wide>
      <datalist id="impList">
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <div className="form">
        {sheets.length > 1 && (
          <div className="field">
            <label>الورقة</label>
            <select value={cur} onChange={(e) => setCur(+e.target.value)}>
              {sheets.map((s, k) => (
                <option key={k} value={k}>
                  {s.name} ({s.rows.length} صنف)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>تاريخ اليومية</label>
          <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
        </div>
        <div className="field">
          <label>الصفوف من غير اسم عميل</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'each' | 'one')}>
            <option value="each">فاتورة لكل صف</option>
            <option value="one">فاتورة واحدة باسم «يومية»</option>
          </select>
        </div>
      </div>
      <div className="card" style={{ margin: '10px 0', lineHeight: 1.9, fontSize: 14 }}>
        <b>{G.length}</b> فاتورة • <b>{rows.length}</b> صنف • الإجمالي <b>{money(tot)}</b>
        <br />
        {credit > 0 && (
          <>
            آجل: <b>{money(credit)}</b> • نقدي: <b>{money(tot - credit)}</b>
            <br />
          </>
        )}
        {bad ? <span style={{ color: '#c0392b' }}>{bad} صنف مش متطابق (هيتخطى لو سبته)</span> : <span style={{ color: '#159447' }}>كل الأصناف متطابقة</span>}
        <br />
        {warn.length > 0 && (
          <span style={{ color: '#b9770e' }}>
            المخزون هيبقى بالسالب في {warn.length} صنف: {warn.slice(0, 4).join('، ')}
            {warn.length > 4 ? '…' : ''}
          </span>
        )}
      </div>
      {G.map((g, gi) => {
        const T = g.idx.reduce((s, i) => s + rows[i].qty * rows[i].price, 0);
        const isCredit = g.idx.some((i) => rows[i].pay === 'credit');
        const registered = customers.some((x) => x.name === g.cust);
        return (
          <div key={`${mode}-${gi}`} className="card" style={{ marginBottom: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                defaultValue={g.cust}
                placeholder="يومية (من غير اسم عميل)"
                onChange={(e) => setGroup(gi, { cust: e.target.value.trim() })}
                style={{ flex: 1 }}
                list="impCust"
              />
              {vn(g.cust) ? <span className={`badge${registered ? ' green' : ''}`}>{registered ? 'عميل مسجل' : 'عميل جديد'}</span> : <span className="badge">يومية</span>}
              <select value={isCredit ? 'credit' : 'cash'} onChange={(e) => setGroup(gi, { pay: e.target.value as 'cash' | 'credit' })} style={{ flex: 'none', width: 'auto' }}>
                <option value="cash">نقدي</option>
                <option value="credit">آجل</option>
              </select>
            </div>
            {isCredit && !vn(g.cust) && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 6 }}>⚠ آجل — اكتب اسم العميل فوق</div>}
            {g.idx.map((i) => {
              const r = rows[i];
              const p = r.pid ? byId.get(r.pid) : undefined;
              return (
                <div key={i} style={{ borderTop: '1px solid var(--border)', padding: 6, borderRadius: 8, background: r.pid ? undefined : r.isNew ? '#eef6ff' : '#fdecec' }}>
                  <input
                    list="impList"
                    defaultValue={p ? p.name : r.prod}
                    key={`${i}-${r.pid}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      const q = products.find((x) => x.name === v) ?? products.find((x) => vn(x.name) === vn(v));
                      upd(i, { pid: q?.id ?? '', ...(q ? { isNew: false } : {}) });
                    }}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                    {r.qty} × {money(r.price)} = <b>{money(r.qty * r.price)}</b>
                    {r.mism ? ' (السعر اتعدل عشان يطابق الإجمالي)' : ''}
                    {r.note ? ` • ${r.note}` : ''}
                  </div>
                  <div style={{ fontSize: 13 }}>{status(i)}</div>
                </div>
              );
            })}
            <div style={{ textAlign: 'left', marginTop: 6, fontWeight: 700 }}>إجمالي الفاتورة: {money(T)}</div>
          </div>
        );
      })}
      <datalist id="impCust">
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={busy} onClick={go}>
          {busy ? 'جاري الحفظ...' : 'تأكيد الاستيراد'}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}
