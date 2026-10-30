/**
 * 🧾 قراءة رسالة العميل بالعامية وتحويلها لأصناف (mkOrderParse القديمة): الكمية، المقاس، المرادفات،
 * وبعدها مطابقة كل سطر مع أقرب أصناف المخزن. اللي ما اتعرفش عليه بيتسجل في «ناقص» عشان يتضاف بالبحث.
 */
const norm = (s: unknown) =>
  String(s ?? '')
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ء/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .toLowerCase()
    .replace(/[^؀-ۿa-z0-9\s×*/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NUM0: Record<string, number> = { واحد: 1, واحده: 1, وحده: 1, اتنين: 2, اثنين: 2, اثنان: 2, تلاته: 3, ثلاثه: 3, اربعه: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, تمنيه: 8, تمانيه: 8, ثمانيه: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, عشرين: 20, تلاتين: 30, اربعين: 40, خمسين: 50, ميه: 100, مية: 100, الف: 1000 };
const NUM: Record<string, number> = {};
Object.keys(NUM0).forEach((k) => (NUM[norm(k)] = NUM0[k]!));
const SYN0: Record<string, string[]> = { مجر: ['مجري', 'درج'], مجري: ['مجري', 'درج'], درج: ['درج', 'مجري'], سمت: ['سوفت', 'سمت'], سوفت: ['سوفت'], soft: ['سوفت'], مفصلات: ['مفصل'], مفصله: ['مفصل'], مفصل: ['مفصل'], كولين: ['كولين'], كولينات: ['كولين'], كوالين: ['كولين'], اهرم: ['اهرم', 'ذراع'], ذراع: ['ذراع', 'اهرم'], سفلي: ['سفلي'], سفلى: ['سفلي'], علوي: ['علوي'], علوى: ['علوي'], مقبض: ['مقبض'], ماسكه: ['مقبض'], ابواب: ['باب'], باب: ['باب'], ضلف: ['ضلفه'], ضلفه: ['ضلفه'] };
const SYN: Record<string, string[]> = {};
Object.keys(SYN0).forEach((k) => (SYN[norm(k)] = SYN0[k]!.map(norm)));
const STOP = new Set(['عدد', 'بتاع', 'بتاعت', 'بتاعه', 'من', 'ال', 'و', 'محتاج', 'عايز', 'عاوز', 'ابعت', 'لو', 'سمحت', 'مقاس', 'نوع', 'فيه', 'في', 'ده', 'دي', 'كام', 'اطلب', 'ممكن']);

const expand = (words: string[]) => {
  const out = new Set<string>();
  words.forEach((w) => {
    out.add(w);
    (SYN[w] ?? []).forEach((x) => out.add(x));
  });
  return out;
};

export interface OrderLine {
  raw: string;
  qty: number;
  size: string;
  words: string[];
}
export interface OrderMatch<P> {
  line: OrderLine;
  cands: { p: P; s: number }[];
  /** The product id when the match is good enough (>= 50%), else ''. */
  best: string;
}

function parseLine(raw: string): OrderLine | null {
  let t = norm(raw);
  if (!t) return null;
  let qty = 1;
  let size = '';
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(سم|ملي|مم|متر|م)(?=\s|$)/))) {
    size = m[1]!;
    t = (t.slice(0, m.index) + ' ' + t.slice(m.index! + m[0].length)).replace(/\s+/g, ' ').trim();
  }
  // «عايز تلاتة كولين»: the asking words in front must not hide the number
  t = t.replace(/^(?:(?:عدد|عايز|عاوز|محتاج|ابعت|اطلب|ممكن|لو|سمحت)\s+)+/, '');
  if ((m = t.match(/^(\d+(?:\.\d+)?)\s*(?:[×*x]\s*)?(?=\s|$)/))) {
    qty = +m[1]!;
    t = t.slice(m[0].length).trim();
  } else if ((m = t.match(/^(?:[×*x]\s*)?(\d+)\s*[×*x]?\s+/))) {
    qty = +m[1]!;
    t = t.slice(m[0].length).trim();
  } else {
    const w = t.split(' ')[0]!;
    if (NUM[w] != null) {
      qty = NUM[w]!;
      t = t.slice(w.length).trim();
    }
  }
  if ((m = t.match(/\s[×*x]\s*(\d+)$/))) {
    qty = +m[1]!;
    t = t.slice(0, m.index).trim();
  }
  const words = t.split(' ').filter((w) => w && !STOP.has(w) && !/^[×*x]$/.test(w) && NUM[w] == null);
  return { raw: String(raw).trim(), qty: qty || 1, size, words };
}

/** Every word in the request (or a synonym) must be found in the product name; a matching size scores extra. */
function score(line: OrderLine, name: string): number {
  const q = [...new Set(line.words)];
  if (!q.length) return 0;
  const pw = norm(name).split(' ');
  const pt = expand(pw);
  let hit = 0;
  q.forEach((w) => {
    let ok = false;
    expand([w]).forEach((v) => {
      pt.forEach((x) => {
        if (ok) return;
        if (x === v || (v.length >= 3 && x.length >= 3 && (x.indexOf(v) === 0 || v.indexOf(x) === 0))) ok = true;
      });
    });
    if (ok) hit++;
  });
  let s = hit / q.length;
  if (line.size && pw.includes(line.size)) s += 0.15;
  return Math.min(1, s);
}

export function parseOrder<P extends { id: string; name: string }>(text: string, products: P[]): OrderMatch<P>[] {
  return String(text ?? '')
    .split(/\n|،|,|\+|؛|;/)
    .map(parseLine)
    .filter((l): l is OrderLine => !!l)
    .map((line) => {
      const r = products
        .map((p) => ({ p, s: score(line, p.name) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s);
      return { line, cands: r.slice(0, 4), best: r.length && r[0]!.s >= 0.5 ? r[0]!.p.id : '' };
    });
}

/** The sale window's lines from a message: the same product asked twice is added up; what wasn't understood is listed. */
export function orderLines<P extends { id: string; name: string; price: number }>(text: string, products: P[]) {
  const parsed = parseOrder(text, products);
  const by = new Map<string, { productId: string; name: string; qty: number; price: number }>();
  for (const x of parsed) {
    if (!x.best) continue;
    const p = products.find((q) => q.id === x.best)!;
    const cur = by.get(p.id) ?? { productId: p.id, name: p.name, qty: 0, price: p.price };
    cur.qty += x.line.qty;
    by.set(p.id, cur);
  }
  return { lines: [...by.values()], missing: parsed.filter((x) => !x.best).map((x) => `${x.line.raw} (×${x.line.qty})`) };
}
