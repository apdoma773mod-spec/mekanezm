/**
 * استيراد يومية البيع من إكسل — المنطق نفسه بتاع القديم (parseAoa / groupRows / matchAll):
 * بيدوّر على صف العناوين (الصنف + العدد + السعر)، وبيقرا التاريخ، وبيطابق الأصناف بالاسم أو بأقرب اسم.
 */

/** Same normalizer as the old VN(): Arabic letters, digits and punctuation made comparable. */
export const vn = (s: unknown) =>
  String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[,،؟?!:;()]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const A = (s: unknown) => String(s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const nv = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(A(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.'));
  return Number.isNaN(n) ? 0 : n;
};
const HD: Record<string, string[]> = {
  prod: ['الصنف', 'المنتج', 'الاصناف', 'البيان'],
  qty: ['عدد', 'العدد', 'الكمية'],
  price: ['سعر', 'السعر', 'سعر الوحدة'],
  total: ['الاجمالي', 'اجمالي', 'المجموع'],
  pay: ['طريقة الدفع', 'الدفع'],
  note: ['ملاحظات', 'ملاحظة'],
  cust: ['اسم العميل', 'العميل'],
};
const z2 = (v: number) => String(v).padStart(2, '0');

export interface ImpRow {
  prod: string;
  qty: number;
  price: number;
  mism: boolean;
  pay: 'cash' | 'credit';
  note: string;
  cust: string;
  pid: string;
  hint: string;
  isNew?: boolean;
}
export interface ImpSheet {
  name: string;
  iso: string;
  rows: ImpRow[];
}

export function parseAoa(aoa: unknown[][]): { iso: string; rows: ImpRow[] } | null {
  const hn: Record<string, string[]> = {};
  for (const k in HD) hn[k] = HD[k].map((x) => vn(x));
  let hi = -1;
  let col: Record<string, number> = {};
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const c: Record<string, number> = {};
    (aoa[r] || []).forEach((v, j) => {
      if (v == null || v === '') return;
      const t = vn(v);
      for (const k in hn) if (c[k] == null && hn[k].includes(t)) c[k] = j;
    });
    if (c.prod != null && c.qty != null && c.price != null) {
      hi = r;
      col = c;
      break;
    }
  }
  if (hi < 0) return null;
  let iso = '';
  for (let r = 0; r < hi && !iso; r++) {
    for (const v of aoa[r] || []) {
      if (v instanceof Date && !Number.isNaN(v.getTime())) {
        iso = `${v.getFullYear()}-${z2(v.getMonth() + 1)}-${z2(v.getDate())}`;
        break;
      }
      if (typeof v === 'string') {
        const m = A(v).match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
        if (m) {
          iso = `${m[3]}-${z2(+m[2])}-${z2(+m[1])}`;
          break;
        }
      }
    }
  }
  const rows: ImpRow[] = [];
  for (let r = hi + 1; r < aoa.length; r++) {
    const a = aoa[r] || [];
    const g = (k: string) => (col[k] == null ? '' : a[col[k]]);
    const prod = String(g('prod') ?? '').trim();
    const qty = nv(g('qty'));
    if (!prod || !qty) continue;
    let price = nv(g('price'));
    const total = col.total != null ? nv(g('total')) : 0;
    let mism = false;
    if (total && price && Math.abs(total - qty * price) > 0.01) {
      price = total / qty;
      mism = true;
    } else if (!price && total) price = total / qty;
    const pr = String(g('pay') ?? '').trim();
    const pn = vn(pr);
    const pay: 'cash' | 'credit' = pn.includes('اجل') ? 'credit' : 'cash';
    const extra = pr && !pn.includes('اجل') && !pn.includes('نقد') ? pr : '';
    const note = [String(g('note') ?? '').trim(), extra].filter(Boolean).join(' - ');
    rows.push({ prod, qty, price: +price.toFixed(4), mism, pay, note, cust: String(g('cust') ?? '').trim(), pid: '', hint: '' });
  }
  return { iso, rows };
}

export interface ImpGroup {
  cust: string;
  idx: number[];
}
export function groupRows(rows: ImpRow[], mode: 'each' | 'one'): ImpGroup[] {
  const m = new Map<string, ImpGroup>();
  rows.forEach((r, i) => {
    const nm = vn(r.cust);
    const k = nm || (mode === 'one' ? '' : `#${i}`);
    if (!m.has(k)) m.set(k, { cust: r.cust, idx: [] });
    const g = m.get(k)!;
    if (!g.cust && r.cust) g.cust = r.cust;
    g.idx.push(i);
  });
  return [...m.values()];
}

const dice = (a: string, b: string) => {
  const ta = new Set(vn(a).split(' '));
  const tb = new Set(vn(b).split(' '));
  let c = 0;
  ta.forEach((t) => {
    if (tb.has(t)) c++;
  });
  return (2 * c) / (ta.size + tb.size || 1);
};

/** Match every row to a product by exact name, else suggest the closest one (hint). */
export function matchAll(rows: ImpRow[], products: { id: string; name: string }[]) {
  const idx = new Map<string, { id: string; name: string }>();
  products.forEach((p) => {
    const k = vn(p.name);
    if (!idx.has(k)) idx.set(k, p);
  });
  rows.forEach((r) => {
    const p = idx.get(vn(r.prod));
    r.pid = p ? p.id : '';
    r.hint = '';
    if (!p) {
      let best = 0;
      let bp: { id: string } | null = null;
      products.forEach((q) => {
        const d = dice(r.prod, q.name);
        if (d > best) {
          best = d;
          bp = q;
        }
      });
      if (bp && best >= 0.5) r.hint = (bp as { id: string }).id;
    }
  });
}

/** Same fingerprint idea as the old file check: date + every line's name, quantity and price. */
export function fingerprint(iso: string, rows: ImpRow[]): string {
  const sig = `${iso}|${rows.map((r) => `${vn(r.prod)}:${r.qty}:${r.price}`).join('|')}`;
  let h = 0;
  for (let k = 0; k < sig.length; k++) h = (h * 31 + sig.charCodeAt(k)) | 0;
  return `d${(h >>> 0).toString(36)}_${rows.length}`;
}
