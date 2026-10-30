import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDays, dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { num } from '../../lib/money.js';
import { parse } from '../../lib/validate.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;
const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(730).default(60) });

/** 📈 تحليلات ذكية للمدير (biz القديمة): الراكد، ABC، العملاء الغايبين، مقارنة الموردين، هيخلص قريب، المتابعة بعد البيع، السجل. */
export default async function analyticsRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  const saleLines = (from?: string) =>
    db.invoiceItem.findMany({
      where: { invoice: { kind: 'SALE', status: 'ACTIVE', ...(from ? { date: { gte: dayToDate(from) } } : {}) } },
      select: { productId: true, name: true, qty: true, total: true, invoice: { select: { person: true, date: true } } },
    });

  app.get('/dead', async (request) => {
    const { days } = parse(daysQuery, request.query);
    const since = addDays(todayYmd(), -days);
    const lines = await saleLines();
    const last = new Map<string, string>();
    const sold = new Set<string>();
    for (const l of lines) {
      if (!l.productId) continue;
      const d = dateToDay(l.invoice.date);
      if (!last.has(l.productId) || d > last.get(l.productId)!) last.set(l.productId, d);
      if (d >= since) sold.add(l.productId);
    }
    const prods = await db.product.findMany({ where: { deletedAt: null, qty: { gt: 0 } } });
    const rows = prods
      .filter((p) => !sold.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit, qty: num(p.qty), last: last.get(p.id) ?? '', val: r2((num(p.cost) || num(p.price) * 0.75) * num(p.qty)) }))
      .sort((a, b) => b.val - a.val);
    return { rows };
  });

  app.get('/abc', async () => {
    const since = addDays(todayYmd(), -90);
    const lines = await saleLines(since);
    const v = new Map<string, { val: number; qty: number }>();
    for (const l of lines) {
      if (!l.productId) continue;
      const o = v.get(l.productId) ?? { val: 0, qty: 0 };
      o.val += num(l.total);
      o.qty += num(l.qty);
      v.set(l.productId, o);
    }
    const tot = [...v.values()].reduce((a, x) => a + x.val, 0);
    const prods = new Map((await db.product.findMany({ where: { id: { in: [...v.keys()] } } })).map((p) => [p.id, p]));
    let acc = 0;
    const rows = [...v.entries()]
      .sort((a, b) => b[1].val - a[1].val)
      .map(([id, o]) => {
        const prev = tot ? acc / tot : 0;
        acc += o.val;
        const p = prods.get(id);
        return { id, name: p?.name ?? '(صنف اتمسح)', qtyNow: p ? num(p.qty) : 0, min: p ? num(p.minQty) : 0, sold: r2(o.qty), val: r2(o.val), share: tot ? o.val / tot : 0, cls: prev < 0.8 ? 'A' : prev < 0.95 ? 'B' : 'C' };
      });
    return { rows };
  });

  app.get('/lapsed', async (request) => {
    const { days } = parse(daysQuery, request.query);
    const lim = addDays(todayYmd(), -days);
    const lines = await db.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', person: { notIn: ['', 'يومية', 'نقدي'] } }, select: { person: true, date: true, total: true } });
    const by = new Map<string, { n: string; last: string; tot: number; days: Set<string> }>();
    for (const i of lines) {
      const d = dateToDay(i.date);
      const o = by.get(i.person) ?? { n: i.person, last: '', tot: 0, days: new Set<string>() };
      if (d > o.last) o.last = d;
      o.tot += num(i.total);
      o.days.add(d);
      by.set(i.person, o);
    }
    const contacts = new Map((await db.contact.findMany({ where: { deletedAt: null, type: 'CUSTOMER' }, select: { name: true, phone: true } })).map((c) => [c.name, c.phone]));
    const rows = [...by.values()]
      .filter((o) => o.last && o.last < lim && o.days.size >= 2)
      .map((o) => ({ name: o.n, last: o.last, total: r2(o.tot), visits: o.days.size, phone: contacts.get(o.n) ?? '', days: Math.round((Date.now() - dayToDate(o.last).getTime()) / DAY) }))
      .sort((a, b) => b.total - a.total);
    return { rows };
  });

  /** Products bought from more than one supplier: the last price from each, cheapest first. */
  app.get('/suppliers', async () => {
    const items = await db.invoiceItem.findMany({
      where: { productId: { not: null }, price: { gt: 0 }, invoice: { kind: 'PURCHASE', status: 'ACTIVE', person: { not: '' } } },
      select: { productId: true, price: true, invoice: { select: { person: true, date: true } } },
    });
    const by = new Map<string, Map<string, { price: number; iso: string }>>();
    for (const it of items) {
      const m = by.get(it.productId!) ?? new Map();
      const d = dateToDay(it.invoice.date);
      const cur = m.get(it.invoice.person);
      if (!cur || d > cur.iso) m.set(it.invoice.person, { price: num(it.price), iso: d });
      by.set(it.productId!, m);
    }
    const multi = [...by.entries()].filter(([, m]) => m.size > 1);
    const prods = new Map((await db.product.findMany({ where: { id: { in: multi.map(([id]) => id) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    const rows = multi
      .map(([id, m]) => {
        const L = [...m.entries()].map(([s, v]) => ({ s, ...v })).sort((a, b) => a.price - b.price);
        return { name: prods.get(id) ?? '?', list: L, save: r2(L[L.length - 1]!.price - L[0]!.price) };
      })
      .sort((a, b) => b.save - a.save);
    return { rows };
  });

  /** ⏳ هيخلص قريب: 30-day average sales vs stock, grouped by the last supplier. */
  app.get('/forecast', async () => {
    const since = addDays(todayYmd(), -30);
    const lines = await saleLines(since);
    const sold = new Map<string, number>();
    for (const l of lines) if (l.productId) sold.set(l.productId, (sold.get(l.productId) ?? 0) + num(l.qty));
    const prods = await db.product.findMany({ where: { deletedAt: null, id: { in: [...sold.keys()] } } });
    const buys = await db.invoiceItem.findMany({ where: { productId: { in: prods.map((p) => p.id) }, invoice: { kind: 'PURCHASE', status: 'ACTIVE', person: { not: '' } } }, orderBy: [{ invoice: { date: 'asc' } }], select: { productId: true, invoice: { select: { person: true } } } });
    const sup = new Map<string, string>();
    for (const b of buys) sup.set(b.productId!, b.invoice.person);
    const rows = prods
      .map((p) => {
        const d = sold.get(p.id)! / 30;
        const cover = num(p.qty) / d;
        return { id: p.id, name: p.name, unit: p.unit, qty: num(p.qty), perDay: r2(d), cover, order: Math.max(0, Math.ceil(d * 30 - num(p.qty))), supplier: sup.get(p.id) ?? '—' };
      })
      .filter((x) => x.cover <= 14)
      .sort((a, b) => a.cover - b.cover);
    const phones = new Map((await db.contact.findMany({ where: { deletedAt: null, type: 'SUPPLIER', name: { in: [...new Set(rows.map((r) => r.supplier))] } }, select: { name: true, phone: true } })).map((c) => [c.name, c.phone]));
    return { rows, phones: Object.fromEntries(phones) };
  });

  /** ⭐ المتابعة بعد البيع: customers who bought 5–9 days ago. */
  app.get('/follow', async () => {
    const a = dayToDate(addDays(todayYmd(), -9));
    const b = dayToDate(addDays(todayYmd(), -5));
    const invs = await db.invoice.findMany({ where: { kind: 'SALE', status: 'ACTIVE', person: { not: '' }, date: { gte: a, lte: b } }, select: { person: true, date: true, items: { select: { name: true } } } });
    const by = new Map<string, { name: string; date: string; items: Set<string> }>();
    for (const i of invs) {
      const o = by.get(i.person) ?? { name: i.person, date: dateToDay(i.date), items: new Set<string>() };
      i.items.forEach((x) => o.items.add(x.name));
      by.set(i.person, o);
    }
    const contacts = new Map((await db.contact.findMany({ where: { deletedAt: null, type: 'CUSTOMER' }, select: { name: true, phone: true } })).map((c) => [c.name, c.phone]));
    return { rows: [...by.values()].map((o) => ({ name: o.name, date: o.date, items: [...o.items], phone: contacts.get(o.name) ?? '' })).filter((o) => o.phone) };
  });

  /** What each craftsman in the points program bought (all time). */
  app.post('/spent', async (request) => {
    const { names } = parse(z.object({ names: z.array(z.string().max(120)).max(200) }), request.body);
    const rows = await db.invoice.groupBy({ by: ['person'], where: { kind: 'SALE', status: 'ACTIVE', person: { in: names } }, _sum: { total: true } });
    return { spent: Object.fromEntries(rows.map((r) => [r.person, num(r._sum.total)])) };
  });

  /** 🕵️ مين عمل إيه وإمتى: the audit log and manual stock changes, newest first. */
  app.get('/log', async () => {
    const [audit, moves] = await Promise.all([
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 150, include: { user: { select: { name: true } } } }),
      db.stockMove.findMany({ where: { reason: { in: ['ADJUST', 'GIFT', 'COUNT'] } }, orderBy: { createdAt: 'desc' }, take: 150, include: { user: { select: { name: true } }, product: { select: { name: true } } } }),
    ]);
    const rows = [
      ...audit.map((a) => ({ at: a.createdAt.toISOString(), who: a.user?.name ?? '', what: `${a.action}${a.entity ? ` — ${a.entity}` : ''}` })),
      ...moves.map((m) => ({ at: m.createdAt.toISOString(), who: m.user?.name ?? '', what: `📦 ${m.product.name}: ${num(m.qtyAfter) - num(m.qtyChange)} ← ${num(m.qtyAfter)} (${num(m.qtyChange) > 0 ? '+' : ''}${num(m.qtyChange)})${m.note ? ` · ${m.note}` : ''}` })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 200);
    return { rows };
  });
}
