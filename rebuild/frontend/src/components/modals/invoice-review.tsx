'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { qtyText } from '@/lib/format';
import { best, matchRow, nameSim, normSup, normTxt, type Aliases, type Match } from '@/lib/invoice-match';
import { vn } from '@/lib/import-daily';
import { useAllContacts } from '@/lib/trade-queries';
import { useToast } from '../ui/toast';
import type { ReadInvoice } from './invoice-photo';

interface Row extends Partial<Match> {
  text: string;
  code: string;
  qty: number;
  price: number;
  inc: boolean;
  newName: string;
  open: boolean;
  skip?: boolean;
  manual?: boolean;
  /** Search text typed in the open picker. */
  q: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

/** What the review hands back: the read invoice with each kept line already pointed at a product (or a new name). */
export interface Reviewed extends ReadInvoice {
  items: (ReadInvoice['items'][number] & { pid?: string; newName?: string })[];
}

/**
 * The old «📷 راجع بنود الفاتورة» screen (index.html 3760–3815): every read line gets 🟢 matched / 🟡 check it /
 * 🔴 new, the supplier's own names are remembered (`/work/aliases`) so the next invoice lands by itself,
 * «➕ ضيف بند ناقص» adds a line the reader missed, and the 📊 bar compares the read sum with the written total.
 */
export function InvoiceReview({
  data,
  supplier,
  all,
  scanId,
  onApply,
  onClose,
  onDeep,
}: {
  data: ReadInvoice;
  supplier: string;
  all: ProductDto[];
  scanId: string | null;
  onApply: (r: Reviewed, supplier: string) => void | Promise<void>;
  onClose: () => void;
  onDeep?: () => void;
}) {
  const toast = useToast();
  const suppliers = useAllContacts('SUPPLIER').data ?? [];
  const [al, setAl] = useState<Aliases | null>(null);
  useEffect(() => {
    let live = true;
    api
      .get<{ value: Aliases | null }>('/work/kv/invoice_aliases')
      .then((r) => live && setAl(r.value ?? {}))
      .catch(() => live && setAl({}));
    return () => {
      live = false;
    };
  }, []);

  const supMatch = useMemo(() => {
    if (supplier.trim() || !data.supplier?.trim()) return null;
    const c = suppliers.map((x) => ({ x, s: nameSim(data.supplier!, x.name) })).sort((a, b) => b.s - a.s)[0];
    return c && c.s >= 0.7 ? c.x : null;
  }, [supplier, data.supplier, suppliers]);
  const supName = supplier.trim() || supMatch?.name || (data.supplier ?? '').trim();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [save, setSave] = useState(true);
  useEffect(() => {
    if (al === null || rows) return;
    const items = data.items.filter((x) => String(x.text ?? '').trim());
    setRows(
      items.map((x) => {
        const qty = Number(x.qty) > 0 ? Number(x.qty) : 1;
        let price = Number(x.price) >= 0 && x.price != null ? Number(x.price) : 0;
        if (!(price > 0) && Number(x.total) > 0) price = r2(Number(x.total) / qty);
        const text = String(x.text).trim();
        return { text, code: x.code ?? '', qty, price, inc: true, newName: text, open: false, q: '', ...matchRow(al, supName, { text, code: x.code }, all) };
      }),
    );
  }, [al, rows, data.items, supName, all]);

  if (!rows) return null;
  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const kept = rows.filter((x) => x.inc && !x.skip);
  const tot = r2(kept.reduce((t, x) => t + x.qty * x.price, 0));

  // 📊 read count + sum against the invoice's written total
  const c = data._check ?? {};
  const L = rows.filter((x) => !x.manual);
  const sum = r2(L.reduce((t, x) => t + (x.qty || 0) * (x.price || 0), 0));
  const gt = Number(c.grand_total) || 0;
  const diff = r2(gt - sum);
  const nrows = Number(c.rows) || 0;
  const bad = (gt > 0 && Math.abs(diff) > Math.max(1, gt * 0.01)) || (nrows > 0 && L.length < nrows);

  const matchBtn = (it: Row, i: number) => {
    const p = it.pid ? all.find((x) => x.id === it.pid) : undefined;
    if (p)
      return (
        <button type="button" className={`ivm ${it.conf}`} onClick={() => set(i, { open: !it.open })}>
          {it.conf === 'g' ? '✓' : '❓'} {p.name}
          <small>{it.src === 'alias' ? 'اسم محفوظ للمورد' : it.conf === 'g' ? 'مطابق بالتشابه' : 'اقتراح — راجعه'} • اضغط للتغيير</small>
        </button>
      );
    if (it.pid === null && !it.skip)
      return (
        <button type="button" className="ivm r" onClick={() => set(i, { open: !it.open })}>
          ➕ صنف جديد: {it.newName}
          <small>
            {it.near ? `أقرب صنف: ${it.near} (مختلف) — ` : 'مفيش صنف شبهه — '}اضغط تختار صنف موجود أو تعدّل الاسم
          </small>
        </button>
      );
    return (
      <button type="button" className="ivm r" onClick={() => set(i, { open: !it.open })}>
        ⏭ البند ده متجاهل<small>اضغط لو عايزه يرجع</small>
      </button>
    );
  };

  const pickList = (it: Row, i: number) => {
    const cands = it.q
      ? all
          .map((p) => ({ p, s: nameSim(it.q, p.name) + (vn(p.name).includes(vn(it.q)) ? 0.5 : 0) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, 8)
      : best(it.text, it.code, all);
    return (
      <div className="ivpk">
        <input placeholder="ابحث عن صنف..." value={it.q} onChange={(e) => set(i, { q: e.target.value })} autoComplete="off" />
        <div>
          {cands.map((o) => (
            <div key={o.p.id} className="opt" onClick={() => set(i, { pid: o.p.id, conf: 'g', src: 'fuzzy', skip: false, open: false, q: '' })}>
              {o.p.name} <small>({qtyText(o.p.qty)} {o.p.unit})</small>
            </div>
          ))}
          <div
            className="opt"
            style={{ color: 'var(--blue)', fontWeight: 700 }}
            onClick={() => {
              const n = window.prompt('اسم الصنف الجديد', it.newName);
              if (n === null) return;
              set(i, { newName: n.trim() || it.newName, pid: null, skip: false, conf: 'r', open: false, q: '' });
            }}
          >
            ➕ صنف جديد باسم «{it.newName}»
          </div>
          <div className="opt" style={{ color: 'var(--danger)' }} onClick={() => set(i, { skip: !it.skip, pid: it.skip ? null : undefined, open: false, q: '' })}>
            ⏭ تجاهل البند ده
          </div>
        </div>
      </div>
    );
  };

  const addMissing = () => {
    const n = window.prompt('اسم الصنف الناقص زي ما هو في الفاتورة')?.trim();
    if (!n) return;
    setRows((rs) => [...rs!, { text: n, code: '', qty: 1, price: 0, inc: true, newName: n, open: false, manual: true, q: '', ...matchRow(al ?? {}, supName, { text: n }, all) }]);
    setTimeout(() => {
      const els = document.querySelectorAll('#mkInv .ivrow');
      const r = els[els.length - 1];
      r?.scrollIntoView({ block: 'center' });
      (r?.querySelector('.ivn input') as HTMLInputElement | null)?.focus();
    }, 60);
  };

  const apply = async () => {
    const use = rows.filter((x) => x.inc && !x.skip && x.qty > 0);
    if (!use.length) return toast('مفيش بنود تتضاف', 'bad');
    if (save) {
      const map: Record<string, string> = {};
      for (const it of use) {
        if (!it.pid) continue;
        map[normTxt(it.text)] = it.pid;
        if (it.code) map['#' + normTxt(it.code)] = it.pid;
      }
      if (Object.keys(map).length) {
        try {
          await api.post('/work/aliases', { sup: normSup(supName), map });
        } catch (e) {
          toast(`الأسماء ماتحفظتش: ${errorMessage(e)}`, 'bad');
        }
      }
    }
    await onApply(
      {
        ...data,
        supplier: supName,
        items: use.map((x) => ({ text: x.text, code: x.code, qty: x.qty, price: x.price, pid: x.pid ?? undefined, newName: x.pid ? undefined : x.newName })),
      },
      supName,
    );
    onClose();
  };

  return (
    <div id="mkInv" className="show">
      <div className="ivh">
        <h2>📷 راجع بنود الفاتورة</h2>
        <button type="button" className="secondary" onClick={onClose}>
          رجوع
        </button>
      </div>
      <div className="card" style={{ marginBottom: 10, lineHeight: 1.9 }}>
        {supName || data.supplier ? (
          <>
            المورد: <b>{supName || data.supplier}</b>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>اسم المورد مش ظاهر</span>
        )}
        {data.invoice_no ? (
          <>
            {' '}
            • فاتورة <b>{data.invoice_no}</b>
          </>
        ) : null}
        {data.date ? ` • ${data.date}` : ''}
        <br />
        <small style={{ color: 'var(--muted)' }}>🟢 مطابق • 🟡 راجعه • 🔴 جديد أو مش لاقيله شبه. بعد ما تأكد، الأسماء بتتحفظ للمورد والفاتورة الجاية تنزل لوحدها.</small>
        {data.notes ? (
          <>
            <br />
            <small style={{ color: '#8a4b00' }}>ملاحظة القراءة: {data.notes}</small>
          </>
        ) : null}
      </div>
      <div className="card" style={{ marginBottom: 10, lineHeight: 1.9, border: `2px solid ${bad ? '#e0a100' : '#9fd7b3'}`, background: bad ? '#fff8e6' : '#f2fbf5' }}>
        📊 قرأنا <b>{L.length}</b> بند — مجموعهم <b>{num(sum)}</b>
        {gt > 0 && (
          <>
            {' '}
            • إجمالي الفاتورة المكتوب <b>{num(gt)}</b> {Math.abs(diff) <= Math.max(1, gt * 0.01) ? '✅ مطابق' : <>⚠️ فرق <b>{num(diff)}</b></>}
          </>
        )}
        {nrows > 0 && L.length < nrows && (
          <>
            {' '}
            • ⚠️ الجدول فيه حوالي <b>{nrows}</b> صف
          </>
        )}
        {c.strips ? ' • 🔍 اتقرت بالتقطيع' : ''}
        {bad && (
          <>
            <br />
            <small>
              {gt > 0 && diff < 0 && !(nrows && L.length < nrows)
                ? 'مجموع البنود أكبر من إجمالي الفاتورة — راجع الكميات والأسعار (أو فيه خصم).'
                : 'شكل فيه بنود ناقصة — جرّب «اقرا تاني بدقة أعلى» أو ضيف البند الناقص بإيدك.'}
            </small>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {scanId && onDeep && (
            <button type="button" className={bad ? 'primary' : 'secondary'} style={{ flex: 1, minWidth: '46%' }} onClick={onDeep}>
              🔍 اقرا تاني بدقة أعلى
            </button>
          )}
          <button type="button" className="secondary" id="ivAdd" style={{ flex: 1, minWidth: '46%' }} onClick={addMissing}>
            ➕ ضيف بند ناقص
          </button>
        </div>
      </div>
      {rows.map((it, i) => (
        <div key={i} className={`ivrow${it.inc ? '' : ' off'}`} data-i={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div className="ivt">
              {it.text}
              {it.code ? <small> كود {it.code}</small> : null}
            </div>
            <label className="chk">
              <input type="checkbox" checked={it.inc} onChange={(e) => set(i, { inc: e.target.checked })} />
            </label>
          </div>
          {matchBtn(it, i)}
          <div className="ivn">
            <div>
              <small>الكمية</small>
              <input type="number" min={0} step="0.01" value={it.qty} onChange={(e) => set(i, { qty: +e.target.value })} />
            </div>
            <div>
              <small>سعر الشراء</small>
              <input type="number" min={0} step="0.01" value={it.price} onChange={(e) => set(i, { price: +e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <small>الإجمالي</small>
              <b>{num(it.qty * it.price)}</b>
            </div>
          </div>
          {it.open && pickList(it, i)}
        </div>
      ))}
      <div className="ivbar">
        <label className="chk" style={{ width: '100%' }}>
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> احفظ أسماء الأصناف للمورد ده (الفاتورة الجاية تنزل لوحدها)
        </label>
        <button type="button" className="primary" id="ivApply" onClick={() => void apply()}>
          ✅ أضف {kept.length} صنف للفاتورة — {num(tot)} ج.م
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
