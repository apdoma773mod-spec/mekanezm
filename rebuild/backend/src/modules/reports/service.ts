import type { Prisma, PrismaClient } from '@prisma/client';
import type { ReportCell, ReportHeadline, ReportId, ReportPeriods, ReportResult, ReportRow } from '@mk/shared';
import { addDays, dateToDay, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { num } from '../../lib/money.js';
import { CashService } from '../cash/service.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const sumBy = <T>(a: T[], f: (x: T) => number) => r2(a.reduce((s, x) => s + f(x), 0));
function grp<T>(a: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of a) {
    const k = key(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}
const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / DAY_MS);

const SALE_INCLUDE = {
  items: { select: { name: true, productId: true, qty: true, total: true, unitCost: true, unit: true, product: { select: { category: true } } } },
} satisfies Prisma.InvoiceInclude;
type Inv = Prisma.InvoiceGetPayload<{ include: typeof SALE_INCLUDE }>;

interface Range {
  from?: string;
  to?: string;
  /** One company only (Hydrolek's own figures); omitted = both. */
  company?: 'MK' | 'HY';
}
const co = (r: Range) => (r.company ? { company: r.company } : {});

/** Number view of an invoice line: what the old reports call a sale/purchase row. */
interface Line {
  invoiceId: string;
  date: string;
  name: string;
  productId: string | null;
  cat: string;
  unit: string;
  qty: number;
  total: number;
  cost: number;
}

const linesOf = (invs: Inv[]): Line[] =>
  invs.flatMap((i) =>
    i.items.map((it) => ({
      invoiceId: i.id,
      date: dateToDay(i.date),
      name: it.name,
      productId: it.productId,
      cat: it.product?.category || 'بدون تصنيف',
      unit: it.unit,
      qty: num(it.qty),
      total: num(it.total),
      cost: r2(num(it.unitCost) * num(it.qty)),
    })),
  );

/** Sales net of the invoice discount (shipping is income on its own line, as in the old «إيراد النقل»). */
const invNet = (i: Inv) => num(i.subtotal) - num(i.discount);

export class ReportsService {
  private readonly cash: CashService;
  constructor(private readonly prisma: PrismaClient) {
    this.cash = new CashService(prisma);
  }

  private invoices(kind: 'SALE' | 'PURCHASE', r: Range) {
    return this.prisma.invoice.findMany({
      where: { kind, status: 'ACTIVE', date: dayRange(r.from, r.to), ...co(r) },
      include: SALE_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }
  private returns(r: Range) {
    return this.prisma.return.findMany({
      where: { date: dayRange(r.from, r.to), ...co(r) },
      include: { product: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
  }
  private expenses(r: Range) {
    return this.prisma.expense.findMany({ where: { deletedAt: null, date: dayRange(r.from, r.to), ...co(r) }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
  }
  private products() {
    return this.prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }

  /** The old perf(): the period's performance, used by the summary, the comparison and the home cards. */
  async perf(r: Range) {
    const [S, P, RT, E, pays] = await Promise.all([
      this.invoices('SALE', r),
      this.invoices('PURCHASE', r),
      this.returns(r),
      this.expenses(r),
      this.prisma.payment.aggregate({ where: { direction: 'IN', cancelledAt: null, date: dayRange(r.from, r.to), ...co(r) }, _sum: { amount: true } }),
    ]);
    const rs = RT.filter((x) => x.kind === 'SALE');
    const rp = RT.filter((x) => x.kind === 'PURCHASE');
    const tot = sumBy(S, invNet);
    const shp = sumBy(S, (i) => num(i.shipping));
    const rtT = sumBy(rs, (x) => num(x.total));
    const cogs = r2(sumBy(linesOf(S), (l) => l.cost) - sumBy(rs, (x) => num(x.unitCost) * num(x.qty)));
    const net = r2(tot - rtT);
    const gross = r2(net - cogs);
    const exp = sumBy(E, (x) => num(x.amount));
    const n = S.length;
    return {
      tot,
      shp,
      rtT,
      net,
      cogs,
      gross,
      exp,
      np: r2(gross + shp - exp),
      n,
      avg: n ? r2((tot + shp) / n) : 0,
      coll: r2(sumBy(S, (i) => num(i.paid)) + num(pays._sum.amount)),
      rem: sumBy(S, (i) => num(i.remaining)),
      pur: r2(sumBy(P, (i) => num(i.total)) - sumBy(rp, (x) => num(x.total))),
      qty: sumBy(linesOf(S), (l) => l.qty),
    };
  }

  async headline(r: Range): Promise<ReportHeadline> {
    const p = await this.perf(r);
    return { net: p.net, gross: p.gross, np: p.np };
  }

  /** The old «تقرير الفترات» table: today, this month, this year and everything. */
  async periods(): Promise<ReportPeriods> {
    const t = todayYmd();
    const ranges: [keyof ReportPeriods, Range][] = [
      ['day', { from: t, to: t }],
      ['month', { from: `${t.slice(0, 8)}01`, to: t }],
      ['year', { from: `${t.slice(0, 5)}01-01`, to: t }],
      ['all', {}],
    ];
    const out = await Promise.all(
      ranges.map(async ([k, r]) => {
        const p = await this.perf(r);
        return [k, { sales: p.net, purch: p.pur, ret: p.rtT, exp: p.exp, gross: p.gross, net: p.np }] as const;
      }),
    );
    return Object.fromEntries(out) as unknown as ReportPeriods;
  }

  /** Last sale day of every product (for low stock and dead stock). */
  private async lastSales() {
    const rows = await this.prisma.$queryRaw<{ productId: string; last: Date }[]>`
      SELECT ii."productId", MAX(i."date") AS last
      FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
      WHERE i.kind = 'SALE' AND i.status = 'ACTIVE' AND ii."productId" IS NOT NULL
      GROUP BY ii."productId"`;
    return new Map(rows.map((x) => [x.productId, dateToDay(x.last)]));
  }

  async run(id: ReportId, r: Range): Promise<ReportResult> {
    const base = { id, from: r.from ?? null, to: r.to ?? null };
    const out = await this.build(id, r);
    return { ...base, ...out };
  }

  private async itemRep(r: Range, mg: boolean): Promise<Omit<ReportResult, 'id' | 'from' | 'to'>> {
    const [S, RT] = await Promise.all([this.invoices('SALE', r), this.returns(r)]);
    const L = linesOf(S);
    const retCount = grp(
      RT.filter((x) => x.kind === 'SALE'),
      (x) => x.product.name,
    );
    const tot = sumBy(L, (l) => l.total);
    const rows = [...grp(L, (l) => l.name)].map(([k, a]) => {
      const q = sumBy(a, (l) => l.qty);
      const t = sumBy(a, (l) => l.total);
      const p = r2(t - sumBy(a, (l) => l.cost));
      return [k, q, a[0]!.unit, t, q ? r2(t / q) : 0, p, pct(p, t), retCount.get(k)?.length ?? 0] as [string, number, string, number, number, number, number, number];
    });
    rows.sort((a, b) => (mg ? a[6] - b[6] : b[3] - a[3]));
    return {
      sum: [
        { l: 'عدد الأصناف', v: rows.length, t: 'n' },
        { l: 'إجمالي المبيعات', v: tot, t: 'm' },
        { l: 'الربح', v: sumBy(rows, (x) => x[5]), t: 'm', c: 'g' },
        { l: 'أصناف بخسارة', v: rows.filter((x) => x[5] < 0).length, t: 'n', c: 'r' },
        { l: 'هامش ضعيف (أقل من ١٠٪)', v: rows.filter((x) => x[6] < 10 && x[5] >= 0).length, t: 'n' },
      ],
      cols: [
        { h: 'الصنف', t: 's' },
        { h: 'الكمية', t: 'n' },
        { h: 'الوحدة', t: 's' },
        { h: 'المبيعات', t: 'm' },
        { h: 'متوسط السعر', t: 'm' },
        { h: 'الربح', t: 'm' },
        { h: 'هامش %', t: 'p' },
        { h: 'مرتجعات', t: 'n' },
      ],
      rows: rows.map((c) => ({ c, warn: c[5] < 0 ? 'r' : c[6] < 10 ? 'y' : '' })),
      ...(mg ? {} : { chart: rows.slice(0, 12).map((x) => [x[0], x[3]] as [string, number]) }),
    };
  }

  private async build(id: ReportId, r: Range): Promise<Omit<ReportResult, 'id' | 'from' | 'to'>> {
    const plain = (rows: ReportCell[][]): ReportRow[] => rows.map((c) => ({ c }));
    switch (id) {
      case 'perf': {
        const p = await this.perf(r);
        const rows: ReportCell[][] = [
          ['المبيعات', p.tot, 100],
          ['(–) المرتجعات', -p.rtT, pct(p.rtT, p.tot)],
          ['صافي المبيعات', p.net, 100],
          ['(–) تكلفة البضاعة', -p.cogs, pct(p.cogs, p.net)],
          ['مجمل الربح', p.gross, pct(p.gross, p.net)],
          ['(+) إيراد النقل', p.shp, pct(p.shp, p.net)],
          ['(–) المصروفات', -p.exp, pct(p.exp, p.net)],
          ['صافي الربح', p.np, pct(p.np, p.net)],
        ];
        return {
          sum: [
            { l: 'صافي المبيعات', v: p.net, t: 'm' },
            { l: 'مجمل الربح', v: p.gross, t: 'm', c: p.gross < 0 ? 'r' : 'g' },
            { l: 'صافي الربح', v: p.np, t: 'm', c: p.np < 0 ? 'r' : 'g' },
            { l: 'عدد الفواتير', v: p.n, t: 'n' },
            { l: 'متوسط الفاتورة', v: p.avg, t: 'm' },
            { l: 'اتحصّل', v: p.coll, t: 'm', c: 'g' },
            { l: 'متبقي على العملاء من الفترة', v: p.rem, t: 'm', c: p.rem > 0 ? 'r' : '' },
            { l: 'مشتريات الفترة', v: p.pur, t: 'm' },
          ],
          cols: [
            { h: 'البند', t: 's' },
            { h: 'القيمة', t: 'm' },
            { h: '% من صافي المبيعات', t: 'p' },
          ],
          rows: plain(rows),
          nosort: true,
        };
      }
      case 'cmp': {
        const to = r.to ?? todayYmd();
        const from = r.from ?? to;
        const len = daysBetween(from, to) + 1;
        const pe = addDays(from, -1);
        const ps = addDays(pe, -(len - 1));
        const [x, y] = await Promise.all([this.perf(r), this.perf({ from: ps, to: pe })]);
        const L: [string, keyof typeof x][] = [
          ['صافي المبيعات', 'net'],
          ['تكلفة البضاعة', 'cogs'],
          ['مجمل الربح', 'gross'],
          ['المصروفات', 'exp'],
          ['صافي الربح', 'np'],
          ['عدد الفواتير', 'n'],
          ['متوسط الفاتورة', 'avg'],
          ['المشتريات', 'pur'],
          ['المحصّل', 'coll'],
        ];
        return {
          sum: [
            { l: 'الفترة الحالية', v: r.from ? `${r.from} – ${to}` : 'كل الفترات', t: 's' },
            { l: 'الفترة السابقة', v: `${ps} – ${pe}`, t: 's' },
          ],
          cols: [
            { h: 'البند', t: 's' },
            { h: 'الحالية', t: 'm' },
            { h: 'السابقة', t: 'm' },
            { h: 'الفرق', t: 'm' },
            { h: 'التغيّر', t: 'p' },
          ],
          rows: plain(L.map(([l, k]) => [l, x[k], y[k], r2(x[k] - y[k]), y[k] ? pct(x[k] - y[k], Math.abs(y[k])) : 0])),
          nosort: true,
        };
      }
      case 'daily': {
        const S = await this.invoices('SALE', r);
        const rows = [...grp(S, (i) => dateToDay(i.date))]
          .map(([k, a]) => {
            const L = linesOf(a);
            return [k, a.length, sumBy(a, invNet), r2(sumBy(L, (l) => l.total) - sumBy(L, (l) => l.cost)), sumBy(a, (i) => num(i.paid))] as [string, number, number, number, number];
          })
          .sort((a, b) => b[0].localeCompare(a[0]));
        const tot = sumBy(rows, (x) => x[2]);
        return {
          sum: [
            { l: 'أيام فيها بيع', v: rows.length, t: 'n' },
            { l: 'إجمالي المبيعات', v: tot, t: 'm' },
            { l: 'إجمالي الربح', v: sumBy(rows, (x) => x[3]), t: 'm', c: 'g' },
            { l: 'متوسط اليوم', v: rows.length ? r2(tot / rows.length) : 0, t: 'm' },
          ],
          cols: [
            { h: 'اليوم', t: 'd' },
            { h: 'فواتير', t: 'n' },
            { h: 'المبيعات', t: 'm' },
            { h: 'الربح', t: 'm' },
            { h: 'المحصّل', t: 'm' },
          ],
          rows: plain(rows),
          chart: rows
            .slice(0, 31)
            .reverse()
            .map((x) => [String(Number(x[0].slice(8))), x[2]]),
          foot: ['الإجمالي', sumBy(rows, (x) => x[1]), tot, sumBy(rows, (x) => x[3]), sumBy(rows, (x) => x[4])],
          dsort: [0, -1],
        };
      }
      case 'byItem':
        return this.itemRep(r, false);
      case 'margin':
        return this.itemRep(r, true);
      case 'byCat': {
        const L = linesOf(await this.invoices('SALE', r));
        const tot = sumBy(L, (l) => l.total);
        const rows = [...grp(L, (l) => l.cat)]
          .map(([k, a]) => {
            const t = sumBy(a, (l) => l.total);
            const p = r2(t - sumBy(a, (l) => l.cost));
            return [k, sumBy(a, (l) => l.qty), t, p, pct(p, t), pct(t, tot)] as [string, number, number, number, number, number];
          })
          .sort((a, b) => b[2] - a[2]);
        return {
          sum: [
            { l: 'عدد التصنيفات', v: rows.length, t: 'n' },
            { l: 'إجمالي المبيعات', v: tot, t: 'm' },
          ],
          cols: [
            { h: 'التصنيف', t: 's' },
            { h: 'الكمية', t: 'n' },
            { h: 'المبيعات', t: 'm' },
            { h: 'الربح', t: 'm' },
            { h: 'هامش %', t: 'p' },
            { h: 'حصته %', t: 'p' },
          ],
          rows: plain(rows),
          chart: rows.slice(0, 12).map((x) => [x[0], x[2]]),
        };
      }
      case 'byCust': {
        const S = await this.invoices('SALE', r);
        const rows = [...grp(S, (i) => i.person.trim() || 'عميل نقدي')]
          .map(([k, a]) => {
            const L = linesOf(a);
            return {
              c: [k, a.length, sumBy(a, (i) => num(i.total)), r2(sumBy(L, (l) => l.total) - sumBy(L, (l) => l.cost)), sumBy(a, (i) => num(i.paid)), sumBy(a, (i) => num(i.remaining))] as [
                string,
                number,
                number,
                number,
                number,
                number,
              ],
              contactId: a.find((i) => i.contactId)?.contactId ?? null,
            };
          })
          .sort((a, b) => b.c[2] - a.c[2]);
        return {
          sum: [
            { l: 'عدد العملاء', v: rows.length, t: 'n' },
            { l: 'إجمالي', v: sumBy(rows, (x) => x.c[2]), t: 'm' },
            { l: 'الربح', v: sumBy(rows, (x) => x.c[3]), t: 'm', c: 'g' },
            { l: 'متبقي', v: sumBy(rows, (x) => x.c[5]), t: 'm', c: 'r' },
          ],
          cols: [
            { h: 'العميل', t: 's' },
            { h: 'فواتير', t: 'n' },
            { h: 'المبيعات', t: 'm' },
            { h: 'الربح', t: 'm' },
            { h: 'المدفوع', t: 'm' },
            { h: 'المتبقي', t: 'm' },
          ],
          rows: rows.map((x) => ({ c: x.c, ...(x.contactId ? { go: { kind: 'contact' as const, id: x.contactId } } : {}) })),
          chart: rows.slice(0, 12).map((x) => [x.c[0], x.c[2]]),
        };
      }
      case 'invSales':
      case 'invPur': {
        const sale = id === 'invSales';
        const I = await this.invoices(sale ? 'SALE' : 'PURCHASE', r);
        const rows: ReportRow[] = I.map((i) => ({
          c: [
            i.no,
            dateToDay(i.date),
            i.person.trim() || (sale ? 'نقدي' : '—'),
            num(i.total),
            num(i.paid),
            num(i.remaining),
            num(i.remaining) > 0.5 ? 'متبقي' : 'مدفوعة',
          ],
          go: { kind: 'invoice', id: i.id },
        }));
        const rem = sumBy(I, (i) => num(i.remaining));
        return {
          sum: [
            { l: 'عدد الفواتير', v: I.length, t: 'n' },
            { l: 'إجمالي', v: sumBy(I, (i) => num(i.total)), t: 'm' },
            { l: 'متبقي', v: rem, t: 'm', c: 'r' },
            ...(sale ? [{ l: 'فواتير فيها متبقي', v: I.filter((i) => num(i.remaining) > 0.5).length, t: 'n' as const }] : []),
          ],
          cols: [
            { h: 'الفاتورة', t: 's' },
            { h: 'التاريخ', t: 'd' },
            { h: sale ? 'العميل' : 'المورد', t: 's' },
            { h: 'الإجمالي', t: 'm' },
            { h: 'المدفوع', t: 'm' },
            { h: 'المتبقي', t: 'm' },
            { h: 'الحالة', t: 's' },
          ],
          rows,
        };
      }
      case 'returns': {
        const L = await this.returns(r);
        return {
          sum: [
            { l: 'عدد المرتجعات', v: L.length, t: 'n' },
            { l: 'مرتجع بيع', v: sumBy(L.filter((x) => x.kind === 'SALE'), (x) => num(x.total)), t: 'm', c: 'r' },
            { l: 'مرتجع شراء', v: sumBy(L.filter((x) => x.kind === 'PURCHASE'), (x) => num(x.total)), t: 'm' },
          ],
          cols: [
            { h: 'التاريخ', t: 'd' },
            { h: 'النوع', t: 's' },
            { h: 'الصنف', t: 's' },
            { h: 'الاسم', t: 's' },
            { h: 'الكمية', t: 'n' },
            { h: 'القيمة', t: 'm' },
            { h: 'ملاحظة', t: 's' },
          ],
          rows: plain(
            L.map((x) => [dateToDay(x.date), x.kind === 'SALE' ? 'مرتجع بيع' : 'مرتجع شراء', x.product.name, x.person || '—', num(x.qty), num(x.total), x.note]),
          ),
        };
      }
      case 'purSup': {
        const P = await this.invoices('PURCHASE', r);
        const rows = [...grp(P, (i) => i.person.trim() || 'بدون مورد')]
          .map(([k, a]) => [k, a.length, sumBy(a, (i) => num(i.total)), sumBy(a, (i) => num(i.paid)), sumBy(a, (i) => num(i.remaining))] as [string, number, number, number, number])
          .sort((a, b) => b[2] - a[2]);
        return {
          sum: [
            { l: 'عدد الموردين', v: rows.length, t: 'n' },
            { l: 'إجمالي المشتريات', v: sumBy(rows, (x) => x[2]), t: 'm' },
            { l: 'متبقي للموردين', v: sumBy(rows, (x) => x[4]), t: 'm', c: 'r' },
          ],
          cols: [
            { h: 'المورد', t: 's' },
            { h: 'فواتير', t: 'n' },
            { h: 'الإجمالي', t: 'm' },
            { h: 'المدفوع', t: 'm' },
            { h: 'المتبقي', t: 'm' },
          ],
          rows: plain(rows),
          chart: rows.slice(0, 12).map((x) => [x[0], x[2]]),
        };
      }
      case 'purItem': {
        const L = linesOf(await this.invoices('PURCHASE', r));
        const rows = [...grp(L, (l) => l.name)]
          .map(([k, a]) => {
            const q = sumBy(a, (l) => l.qty);
            const t = sumBy(a, (l) => l.total);
            const prices = a.map((l) => (l.qty ? l.total / l.qty : 0)).filter((p) => p > 0);
            return [k, q, t, q ? r2(t / q) : 0, prices.length ? r2(Math.min(...prices)) : 0, prices.length ? r2(Math.max(...prices)) : 0] as [string, number, number, number, number, number];
          })
          .sort((a, b) => b[2] - a[2]);
        return {
          sum: [
            { l: 'عدد الأصناف', v: rows.length, t: 'n' },
            { l: 'إجمالي', v: sumBy(rows, (x) => x[2]), t: 'm' },
          ],
          cols: [
            { h: 'الصنف', t: 's' },
            { h: 'الكمية', t: 'n' },
            { h: 'الإجمالي', t: 'm' },
            { h: 'متوسط السعر', t: 'm' },
            { h: 'أقل سعر', t: 'm' },
            { h: 'أعلى سعر', t: 'm' },
          ],
          rows: plain(rows),
        };
      }
      case 'expCat': {
        const E = await this.expenses(r);
        const tot = sumBy(E, (x) => num(x.amount));
        const rows = [...grp(E, (x) => x.category.trim() || 'أخرى')]
          .map(([k, a]) => {
            const t = sumBy(a, (x) => num(x.amount));
            return [k, a.length, t, pct(t, tot)] as [string, number, number, number];
          })
          .sort((a, b) => b[2] - a[2]);
        return {
          sum: [
            { l: 'إجمالي المصروفات', v: tot, t: 'm', c: 'r' },
            { l: 'عدد البنود', v: rows.length, t: 'n' },
            { l: 'عدد العمليات', v: E.length, t: 'n' },
          ],
          cols: [
            { h: 'البند', t: 's' },
            { h: 'عمليات', t: 'n' },
            { h: 'الإجمالي', t: 'm' },
            { h: 'النسبة %', t: 'p' },
          ],
          rows: plain(rows),
          chart: rows.slice(0, 12).map((x) => [x[0], x[2]]),
        };
      }
      case 'expList': {
        const E = await this.expenses(r);
        const tot = sumBy(E, (x) => num(x.amount));
        return {
          sum: [
            { l: 'إجمالي', v: tot, t: 'm', c: 'r' },
            { l: 'عدد', v: E.length, t: 'n' },
          ],
          cols: [
            { h: 'التاريخ', t: 'd' },
            { h: 'البند', t: 's' },
            { h: 'البيان', t: 's' },
            { h: 'المبلغ', t: 'm' },
          ],
          rows: plain(E.map((x) => [dateToDay(x.date), x.category || 'أخرى', x.note, num(x.amount)])),
          foot: ['الإجمالي', '', '', tot],
        };
      }
      case 'stockVal': {
        const L = (await this.products())
          .map((p) => {
            const q = num(p.qty);
            const c = num(p.cost);
            const pr = num(p.price);
            return [p.code, p.name, p.category || 'بدون تصنيف', q, c, r2(q * c), pr, r2(Math.max(0, q) * (pr - c))] as [string, string, string, number, number, number, number, number];
          })
          .sort((a, b) => b[5] - a[5]);
        const v = sumBy(L, (x) => x[5]);
        return {
          sum: [
            { l: 'عدد الأصناف', v: L.length, t: 'n' },
            { l: 'قيمة المخزون (تكلفة)', v, t: 'm' },
            { l: 'قيمته بسعر البيع', v: sumBy(L, (x) => Math.max(0, x[3]) * x[6]), t: 'm' },
            { l: 'ربح متوقع', v: sumBy(L, (x) => x[7]), t: 'm', c: 'g' },
          ],
          cols: [
            { h: 'الكود', t: 's' },
            { h: 'الصنف', t: 's' },
            { h: 'التصنيف', t: 's' },
            { h: 'الكمية', t: 'n' },
            { h: 'التكلفة', t: 'm' },
            { h: 'القيمة', t: 'm' },
            { h: 'سعر البيع', t: 'm' },
            { h: 'ربح متوقع', t: 'm' },
          ],
          rows: plain(L),
          foot: ['', 'الإجمالي', '', '', '', v, '', sumBy(L, (x) => x[7])],
          nofilt: true,
        };
      }
      case 'stockCat': {
        const P = await this.products();
        const val = (p: (typeof P)[number]) => num(p.qty) * num(p.cost);
        const tot = sumBy(P, val);
        const rows = [...grp(P, (p) => p.category || 'بدون تصنيف')]
          .map(([k, a]) => {
            const v = sumBy(a, val);
            return [k, a.length, sumBy(a, (p) => num(p.qty)), v, pct(v, tot)] as [string, number, number, number, number];
          })
          .sort((a, b) => b[3] - a[3]);
        return {
          sum: [{ l: 'إجمالي القيمة', v: tot, t: 'm' }],
          cols: [
            { h: 'التصنيف', t: 's' },
            { h: 'أصناف', t: 'n' },
            { h: 'الكمية', t: 'n' },
            { h: 'القيمة', t: 'm' },
            { h: 'النسبة %', t: 'p' },
          ],
          rows: plain(rows),
          chart: rows.slice(0, 12).map((x) => [x[0], x[3]]),
        };
      }
      case 'stockLow': {
        const [P, last] = await Promise.all([this.products(), this.lastSales()]);
        const L = P.filter((p) => num(p.qty) <= num(p.minQty))
          .map((p) => {
            const q = num(p.qty);
            const m = num(p.minQty);
            return [p.code, p.name, p.category || '—', q, m, Math.max(0, m * 2 - q), last.get(p.id) ?? ''] as [string, string, string, number, number, number, string];
          })
          .sort((a, b) => a[3] - b[3]);
        return {
          sum: [
            { l: 'أصناف ناقصة', v: L.length, t: 'n', c: L.length ? 'r' : 'g' },
            { l: 'خلصت تمامًا', v: L.filter((x) => x[3] <= 0).length, t: 'n', c: 'r' },
          ],
          cols: [
            { h: 'الكود', t: 's' },
            { h: 'الصنف', t: 's' },
            { h: 'التصنيف', t: 's' },
            { h: 'المتاح', t: 'n' },
            { h: 'حد الطلب', t: 'n' },
            { h: 'المقترح شراؤه', t: 'n' },
            { h: 'آخر بيع', t: 'd' },
          ],
          rows: plain(L),
          nofilt: true,
        };
      }
      case 'stockDead': {
        const [P, last] = await Promise.all([this.products(), this.lastSales()]);
        const lim = addDays(todayYmd(), -60);
        const L = P.filter((p) => num(p.qty) > 0)
          .map((p) => [p.code, p.name, p.category || '—', num(p.qty), r2(num(p.qty) * num(p.cost)), last.get(p.id) ?? ''] as [string, string, string, number, number, string])
          .filter((x) => x[5] < lim)
          .sort((a, b) => b[4] - a[4]);
        return {
          sum: [
            { l: 'أصناف راكدة', v: L.length, t: 'n' },
            { l: 'فلوس واقفة', v: sumBy(L, (x) => x[4]), t: 'm', c: 'r' },
            { l: 'ماتباعتش خالص', v: L.filter((x) => !x[5]).length, t: 'n' },
          ],
          cols: [
            { h: 'الكود', t: 's' },
            { h: 'الصنف', t: 's' },
            { h: 'التصنيف', t: 's' },
            { h: 'الكمية', t: 'n' },
            { h: 'قيمتها (تكلفة)', t: 'm' },
            { h: 'آخر بيع', t: 'd' },
          ],
          rows: plain(L),
          nofilt: true,
        };
      }
      case 'stockMove': {
        const [S, P, RT, prods] = await Promise.all([this.invoices('SALE', r), this.invoices('PURCHASE', r), this.returns(r), this.products()]);
        const m = new Map<string, { b: number; s: number; rs: number; rp: number }>();
        const g = (n: string) => {
          let o = m.get(n);
          if (!o) m.set(n, (o = { b: 0, s: 0, rs: 0, rp: 0 }));
          return o;
        };
        for (const l of linesOf(P)) g(l.name).b += l.qty;
        for (const l of linesOf(S)) g(l.name).s += l.qty;
        for (const x of RT) {
          const o = g(x.product.name);
          if (x.kind === 'SALE') o.rs += num(x.qty);
          else o.rp += num(x.qty);
        }
        const qtyByName = new Map(prods.map((p) => [p.name, num(p.qty)]));
        const rows = [...m]
          .map(([k, o]) => [k, r2(o.b), r2(o.s), r2(o.rs), r2(o.rp), qtyByName.get(k) ?? 0] as [string, number, number, number, number, number])
          .sort((a, b) => b[2] - a[2]);
        return {
          sum: [{ l: 'أصناف اتحركت', v: rows.length, t: 'n' }],
          cols: [
            { h: 'الصنف', t: 's' },
            { h: 'اشتريت', t: 'n' },
            { h: 'بعت', t: 'n' },
            { h: 'مرتجع بيع', t: 'n' },
            { h: 'مرتجع شراء', t: 'n' },
            { h: 'الرصيد الحالي', t: 'n' },
          ],
          rows: plain(rows),
        };
      }
      case 'debtC': {
        const [C, lastInv, lastPay] = await Promise.all([
          this.prisma.contact.findMany({ where: { type: 'CUSTOMER', deletedAt: null, balance: { gt: 0.5 } }, orderBy: { balance: 'desc' } }),
          this.prisma.invoice.groupBy({ by: ['contactId'], where: { kind: 'SALE', status: 'ACTIVE', contactId: { not: null } }, _max: { date: true } }),
          this.prisma.payment.groupBy({ by: ['contactId'], where: { direction: 'IN', cancelledAt: null }, _max: { date: true } }),
        ]);
        const li = new Map(lastInv.map((x) => [x.contactId, x._max.date ? dateToDay(x._max.date) : '']));
        const lp = new Map(lastPay.map((x) => [x.contactId, x._max.date ? dateToDay(x._max.date) : '']));
        const today = todayYmd();
        const L = C.map((c) => {
          const ls = li.get(c.id) ?? '';
          return {
            c: [c.name, c.phone || '—', num(c.balance), ls, lp.get(c.id) ?? '', ls ? daysBetween(ls, today) : 999] as [string, string, number, string, string, number],
            go: { kind: 'contact' as const, id: c.id },
          };
        });
        const B = (a: number, b: number) => sumBy(L.filter((x) => x.c[5] >= a && x.c[5] <= b), (x) => x.c[2]);
        return {
          sum: [
            { l: 'إجمالي الديون', v: sumBy(L, (x) => x.c[2]), t: 'm', c: 'r' },
            { l: 'عدد المديونين', v: L.length, t: 'n' },
            { l: '٠–٣٠ يوم', v: B(0, 30), t: 'm' },
            { l: '٣١–٦٠ يوم', v: B(31, 60), t: 'm' },
            { l: '٦١–٩٠ يوم', v: B(61, 90), t: 'm', c: 'r' },
            { l: 'أكتر من ٩٠', v: B(91, 99999), t: 'm', c: 'r' },
          ],
          cols: [
            { h: 'العميل', t: 's' },
            { h: 'التليفون', t: 's' },
            { h: 'عليه', t: 'm' },
            { h: 'آخر فاتورة', t: 'd' },
            { h: 'آخر دفعة', t: 'd' },
            { h: 'عمر الدين (يوم)', t: 'n' },
          ],
          rows: L,
          nofilt: true,
        };
      }
      case 'debtS': {
        const C = await this.prisma.contact.findMany({ where: { type: 'SUPPLIER', deletedAt: null, OR: [{ balance: { gt: 0.5 } }, { balance: { lt: -0.5 } }] }, orderBy: { balance: 'desc' } });
        const txt = (b: number) => (b > 0 ? `ليه ${b.toLocaleString('ar-EG')} ج.م` : `رصيد لينا عنده ${(-b).toLocaleString('ar-EG')} ج.م`);
        return {
          sum: [
            { l: 'عدد الموردين', v: C.length, t: 'n' },
            { l: 'الإجمالي', v: sumBy(C, (c) => num(c.balance)), t: 'm' },
          ],
          cols: [
            { h: 'المورد', t: 's' },
            { h: 'التليفون', t: 's' },
            { h: 'الرصيد', t: 'm' },
            { h: 'الحالة', t: 's' },
          ],
          rows: C.map((c) => ({ c: [c.name, c.phone || '—', num(c.balance), txt(num(c.balance))], go: { kind: 'contact' as const, id: c.id } })),
          nofilt: true,
        };
      }
      case 'cash': {
        const [s, before] = await Promise.all([
          this.cash.summary({ from: r.from ?? '2000-01-01', to: r.to ?? todayYmd() }),
          r.from ? this.cash.summary({ from: '2000-01-01', to: addDays(r.from, -1) }) : null,
        ]);
        const open = before ? before.totals.net : 0;
        const days = new Map<string, { in: number; out: number }>();
        for (const mv of s.moves) {
          const d = days.get(mv.date) ?? { in: 0, out: 0 };
          if (mv.amount >= 0) d.in += mv.amount;
          else d.out -= mv.amount;
          days.set(mv.date, d);
        }
        let run = open;
        const rows = [...days]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, d]) => {
            run = r2(run + d.in - d.out);
            return [k, r2(d.in), r2(d.out), r2(d.in - d.out), run] as [string, number, number, number, number];
          });
        const tin = sumBy(rows, (x) => x[1]);
        const tout = sumBy(rows, (x) => x[2]);
        return {
          sum: [
            { l: 'رصيد أول الفترة', v: open, t: 'm' },
            { l: 'داخل', v: tin, t: 'm', c: 'g' },
            { l: 'خارج', v: tout, t: 'm', c: 'r' },
            { l: 'رصيد آخر الفترة', v: run, t: 'm', c: run < 0 ? 'r' : 'g' },
            { l: 'الرصيد دلوقتي', v: s.balance, t: 'm' },
          ],
          cols: [
            { h: 'اليوم', t: 'd' },
            { h: 'داخل', t: 'm' },
            { h: 'خارج', t: 'm' },
            { h: 'الصافي', t: 'm' },
            { h: 'الرصيد', t: 'm' },
          ],
          rows: plain(rows),
          chart: rows.slice(-31).map((x) => [String(Number(x[0].slice(8))), x[4]]),
          dsort: [0, 1],
          foot: ['الإجمالي', tin, tout, r2(tin - tout), run],
        };
      }
      case 'dailyHour': {
        const N = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const S = await this.invoices('SALE', r);
        const m = new Map<number, { t: number; n: number; days: Set<string> }>();
        for (const i of S) {
          const k = dateToDay(i.date);
          const d = i.date.getUTCDay();
          const o = m.get(d) ?? { t: 0, n: 0, days: new Set<string>() };
          o.t += invNet(i);
          o.n++;
          o.days.add(k);
          m.set(d, o);
        }
        const rows = [...m]
          .map(([d, o]) => [N[d]!, o.days.size, o.n, r2(o.t), o.days.size ? r2(o.t / o.days.size) : 0] as [string, number, number, number, number])
          .sort((a, b) => b[3] - a[3]);
        return {
          sum: [{ l: 'أقوى يوم', v: rows[0]?.[0] ?? '—', t: 's', c: 'g' }],
          cols: [
            { h: 'اليوم', t: 's' },
            { h: 'عدد الأيام', t: 'n' },
            { h: 'فواتير', t: 'n' },
            { h: 'المبيعات', t: 'm' },
            { h: 'متوسط اليوم', t: 'm' },
          ],
          rows: plain(rows),
          chart: rows.map((x) => [x[0], x[3]]),
        };
      }
    }
    throw new Error(`unknown report ${String(id)}`);
  }
}
