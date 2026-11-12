import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { currentUser } from '../../plugins/auth.js';
import { readInvoiceImage } from './routes.js';
import { getFile, putFile, removeFile } from '../../lib/files.js';

/**
 * «📥 فواتير للمراجعة» — the old background queue of supplier-invoice photos (mk_scans + scan worker), now on the server:
 * the phone uploads the pages (and overlapping strips of each page), the server reads them in the background,
 * retries by itself when Google is busy, and the purchase screen lists what is waiting for review.
 */

const KEY = 'ai_scans';
const TRANSIENT = /^busy:|^quota:|high demand|overload|unavailable|503|502|500|429|quota|rate.?limit|try again|temporar|timeout|timed out|fetch|network|load failed|internal|deadline|ECONN|abort/i;
const BACK = [1, 2, 4, 8, 15, 30, 30, 60, 60, 120, 180, 240]; // دقايق بين كل محاولة والتانية
const MAX_PAGES = 8;

type Status = 'pending' | 'working' | 'done' | 'failed' | 'used';
interface Item { text?: string; code?: string; qty?: number; unit?: string; price?: number; total?: number }
interface Check { n: number; rows: number; sum: number; grand_total: number; discount: number; total_ok: boolean; rows_ok: boolean; ok: boolean; strips?: number; pages?: number }
interface Read { supplier?: string; invoice_no?: string; date?: string; notes?: string; items: Item[]; _check?: Partial<Check>; pno?: string }
export interface Scan {
  id: string;
  status: Status;
  attempts: number;
  nextAt: string;
  supplier: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pages: number;
  strips: number[];
  deep?: boolean;
  /** Pages still being uploaded one by one (each upload request stays under Vercel's 4.5 MB): the read starts when they're all in. */
  expect?: number;
  result: Read | null;
  error: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const nk = (t: unknown) =>
  String(t ?? '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
const rowKey = (x: Item) => `${nk(x.text)}|${+(x.qty ?? 0) || 0}|${+(x.price ?? 0) || 0}`;
const lineSum = (L: Item[]) => r2(L.reduce((a, x) => a + (+(x.total ?? 0) > 0 ? +x.total! : (+(x.qty ?? 0) || 1) * (+(x.price ?? 0) || 0)), 0));

/** The strips overlap: rows at a border show at the end of one strip and the start of the next — drop those repeats only. */
export function mergeStrips(parts: Read[]): Item[] {
  let out: Item[] = [];
  parts.forEach((P, pi) => {
    let L = (P.items || []).filter((x) => x && String(x.text || '').trim());
    if (pi && out.length) {
      let best = 0;
      for (let k = Math.min(4, L.length, out.length); k > 0; k--) {
        let ok = true;
        for (let j = 0; j < k; j++) {
          const a = out[out.length - k + j]!;
          const b = L[j]!;
          if (rowKey(a) !== rowKey(b) && nk(a.text) !== nk(b.text)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          best = k;
          break;
        }
      }
      L = L.slice(best);
    }
    out = out.concat(L);
  });
  return out;
}

export function chk(items: Item[], c: { grand_total?: number; discount?: number; rows?: number } = {}): Check {
  const it = (items || []).filter((x) => x && String(x.text || '').trim());
  const sum = lineSum(it);
  const gt = +(c.grand_total ?? 0) || 0;
  const disc = +(c.discount ?? 0) || 0;
  const rows = +(c.rows ?? 0) || 0;
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, b * 0.01);
  const totalOk = !(gt > 0) || near(sum, gt) || near(sum - disc, gt) || near(sum + disc, gt);
  const rowsOk = !rows || it.length >= rows;
  return { n: it.length, rows, sum, grand_total: gt, discount: disc, total_ok: totalOk, rows_ok: rowsOk, ok: it.length > 0 && totalOk && rowsOk };
}
const scoreC = (c: Check) => c.n * 10 + (c.total_ok ? 25 : 0) + (c.rows_ok ? 15 : 0);

// صفحات الفاتورة بتتحفظ في مخزن الملفات العادي (على فيركل = جدول StoredFile، لأن الهارد هناك للقراية بس)
const file = (id: string, name: string) => `scan-${id.replace(/[^a-z0-9-]/gi, '')}-${name}`;
const img = async (id: string, name: string) => {
  const b = await getFile(file(id, name));
  if (!b) throw new Error('صفحة الفاتورة مش موجودة على السيرفر — ارفعها تاني');
  return b.toString('base64');
};
async function dropFiles(s: Pick<Scan, 'id' | 'pages' | 'strips'>) {
  for (let i = 1; i <= (s.pages || 0); i++) {
    await removeFile(file(s.id, `p${i}.jpg`)).catch(() => undefined);
    await removeFile(file(s.id, `p${i}.txt`)).catch(() => undefined);
    for (let j = 1; j <= (s.strips?.[i - 1] ?? 0); j++) await removeFile(file(s.id, `p${i}s${j}.jpg`)).catch(() => undefined);
  }
}
async function savePage(id: string, i: number, p: { full?: unknown; strips?: unknown[]; text?: unknown }): Promise<number> {
  await putFile(file(id, `p${i}.jpg`), Buffer.from(b64(p.full), 'base64'), 'image/jpeg');
  const t = typeof p.text === 'string' ? p.text.trim().slice(0, 60000) : '';
  if (t.length >= 20) await putFile(file(id, `p${i}.txt`), Buffer.from(t, 'utf8'), 'text/plain; charset=utf-8');
  const S = (Array.isArray(p.strips) ? p.strips : []).map(b64).filter(Boolean).slice(0, 4);
  for (let j = 0; j < S.length; j++) await putFile(file(id, `p${i}s${j + 1}.jpg`), Buffer.from(S[j]!, 'base64'), 'image/jpeg');
  return S.length;
}
const LATER = '9999-01-01T00:00:00.000Z';
const pageText = async (id: string, page: number) => ((await getFile(file(id, `p${page}.txt`)).catch(() => null))?.toString('utf8') ?? '').trim();

async function callFn(image: string, part?: { i: number; n: number }, text = ''): Promise<Read> {
  const r = await Promise.race([
    readInvoiceImage(image, 'image/jpeg', part, text),
    new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout: الخدمة متأخرة في الرد')), 125000)),
  ]);
  if (r.status >= 400 || typeof r.body.error === 'string') throw new Error(String(r.body.error || `خطأ ${r.status}`));
  return r.body as unknown as Read;
}
// quick retries on the spot when the service is busy (instead of waiting minutes in the queue)
async function callFnQ(image: string, part?: { i: number; n: number }, text = ''): Promise<Read> {
  for (let k = 0; ; k++) {
    try {
      return await callFn(image, part, text);
    } catch (e) {
      if (k >= 2 || !TRANSIENT.test(String((e as Error).message)) || /^(quota|busy):/.test(String((e as Error).message))) throw e;
      await new Promise((r) => setTimeout(r, k ? 8000 : 3000));
    }
  }
}

/** Full read + self check; when it looks incomplete, read the strips (finer detail) and merge them without repeats. */
async function readPage(s: Scan, page: number, force: boolean): Promise<Read> {
  let full: Read | null = null;
  let err: unknown = null;
  // ملف PDF: النص المستخرج من الصفحة بيتبعت مع الصورة، فالقراءة دقيقة من أول مرة ومش محتاجة شرايح
  const text = await pageText(s.id, page);
  if (text) return callFnQ(await img(s.id, `p${page}.jpg`), undefined, text);
  if (!force) {
    try {
      full = await callFnQ(await img(s.id, `p${page}.jpg`));
    } catch (e) {
      err = e;
    }
    if (full && (!full._check || full._check.ok)) return full;
  }
  const n = s.strips[page - 1] ?? 0;
  if (n < 2) {
    if (full) return full;
    if (force) return callFnQ(await img(s.id, `p${page}.jpg`));
    throw err;
  }
  let parts: Read[];
  try {
    parts = await Promise.all([...Array(n)].map(async (_, i) => callFnQ(await img(s.id, `p${page}s${i + 1}.jpg`), { i: i + 1, n })));
  } catch (e) {
    if (full) return full;
    throw err || e;
  }
  const fc = full?._check ?? {};
  const gt = +(fc.grand_total ?? 0) || parts.map((p) => +(p._check?.grand_total ?? 0)).filter((x) => x > 0).pop() || 0;
  const items = mergeStrips(parts);
  const c = chk(items, { grand_total: gt, discount: fc.discount, rows: fc.rows });
  if (full && scoreC(chk(full.items, { grand_total: gt, discount: fc.discount, rows: fc.rows })) >= scoreC(c)) return full;
  const base = full || parts.find((p) => p.supplier || p.invoice_no) || parts[0] || { items: [] };
  return { ...base, items, _check: { ...c, strips: n } };
}

async function readAll(s: Scan, force: boolean): Promise<Read> {
  const RS = await Promise.all([...Array(s.pages)].map((_, i) => readPage(s, i + 1, force)));
  const R: Read = { supplier: '', invoice_no: '', date: '', notes: '', items: [] };
  let gt = 0;
  let rows = 0;
  let disc = 0;
  let strips = 0;
  for (const r of RS) {
    R.supplier = R.supplier || r.supplier || '';
    R.invoice_no = R.invoice_no || r.invoice_no || '';
    R.date = R.date || r.date || '';
    if (r.notes) R.notes = (R.notes ? `${R.notes} • ` : '') + r.notes;
    R.items = R.items.concat(r.items || []);
    const c = r._check ?? {};
    if (+(c.grand_total ?? 0) > 0) gt = +c.grand_total!;
    rows += +(c.rows ?? 0) || 0;
    disc += +(c.discount ?? 0) || 0;
    strips += +(c.strips ?? 0) || 0;
  }
  R._check = { ...chk(R.items, { grand_total: gt, rows, discount: disc }), strips, pages: s.pages };
  return R;
}

/** The list lives in Setting `ai_scans` (newest first, 60 kept); writes go one after the other. */
class Store {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private db: PrismaClient) {}
  async all(): Promise<Scan[]> {
    const row = await this.db.setting.findUnique({ where: { key: KEY } });
    return Array.isArray(row?.value) ? (row!.value as unknown as Scan[]) : [];
  }
  mutate<T>(fn: (L: Scan[]) => T): Promise<T> {
    const run = this.chain.then(async () => {
      const L = await this.all();
      const out = fn(L);
      const keep = L.slice(0, 60);
      for (const gone of L.slice(60)) await dropFiles(gone);
      await this.db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: keep as never }, update: { value: keep as never } });
      return out;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }
  patch(id: string, p: Partial<Scan>) {
    return this.mutate((L) => {
      const s = L.find((x) => x.id === id);
      if (s) Object.assign(s, p, { updatedAt: new Date().toISOString() });
      return s ? { ...s } : null;
    });
  }
}

let busy = false;
/** `only` = read this one job now (Vercel: inside the request, since nothing runs after the reply). */
async function tick(store: Store, log: FastifyInstance['log'], only?: string) {
  if (busy || (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY)) return;
  busy = true;
  try {
    for (let n = 0; n < (only ? 1 : 3); n++) {
      const now = Date.now();
      const job = await store.mutate((L) => {
        // a read that hung (server restarted mid-read) goes back to waiting after 5 minutes
        L.forEach((s) => {
          if (s.status === 'working' && now - Date.parse(s.updatedAt) > 300000) s.status = 'pending';
          // a page-by-page upload that never finished
          if (s.status === 'pending' && s.expect && s.expect > s.pages && now - Date.parse(s.updatedAt) > 1800000)
            Object.assign(s, { status: 'failed', error: `الرفع ماكملش (${s.pages} من ${s.expect} صفحات) — ارفع الملف تاني`, expect: undefined });
        });
        const s = L.filter((x) => x.status === 'pending' && Date.parse(x.nextAt) <= now && (!only || x.id === only)).pop();
        if (s) Object.assign(s, { status: 'working', attempts: s.attempts + 1, updatedAt: new Date().toISOString() });
        return s ? { ...s } : null;
      });
      if (!job) break;
      try {
        const R = await readAll(job, !!job.deep);
        if (!R.items.filter((x) => x && String(x.text || '').trim()).length) {
          await store.patch(job.id, { status: 'failed', error: 'ماقدرتش ألاقي أصناف في الصورة — صوّرها أوضح وقريب', deep: false });
        } else await store.patch(job.id, { status: 'done', result: R, error: '', deep: false });
      } catch (e) {
        const m = String((e as Error)?.message || e) || 'حصل خطأ';
        if (TRANSIENT.test(m) && job.attempts <= BACK.length)
          await store.patch(job.id, { status: 'pending', error: m.replace(/^(quota|busy):\s*/, ''), nextAt: new Date(Date.now() + BACK[Math.max(0, job.attempts - 1)]! * 60000).toISOString() });
        else await store.patch(job.id, { status: 'failed', error: m, deep: false });
      }
    }
  } catch (e) {
    log.warn({ err: e }, 'scan worker');
  } finally {
    busy = false;
  }
}

const b64 = (s: unknown) => (typeof s === 'string' ? s.replace(/^data:[^,]+,/, '') : '');

export async function scanRoutes(app: FastifyInstance) {
  const store = new Store(app.prisma);
  const kick = () => void tick(store, app.log);
  /** On Vercel nothing runs after the reply, so the read happens inside the request (the function allows 300 s); elsewhere the timer does it. */
  const runNow = async (id: string): Promise<Scan | null> => {
    if (process.env.VERCEL) await tick(store, app.log, id);
    else kick();
    return (await store.all()).find((x) => x.id === id) ?? null;
  };
  if (!process.env.VITEST) {
    const t = setInterval(kick, 40000);
    t.unref();
    app.addHook('onClose', async () => clearInterval(t));
    setTimeout(kick, 3000).unref();
  }
  app.addHook('preHandler', app.authenticate);

  app.get('/', async () => ({ items: await store.all(), ai: !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY) }));

  /** {pages: [{full, strips?: [..]}], supplier?} — base64 JPEGs prepared on the phone. */
  app.post('/', { bodyLimit: 60 * 1024 * 1024 }, async (request, reply) => {
    const body = (request.body ?? {}) as { pages?: { full?: unknown; strips?: unknown[]; text?: unknown }[]; supplier?: unknown };
    const pages = (Array.isArray(body.pages) ? body.pages : []).filter((p) => b64(p?.full)).slice(0, MAX_PAGES);
    if (!pages.length) return reply.code(400).send({ error: { code: 'BAD_INPUT', message: 'الملف فاضي' } });
    const expect = Math.min(MAX_PAGES, Math.max(pages.length, Math.round(Number((body as { expect?: unknown }).expect) || 0)));
    const id = randomUUID();
    const strips: number[] = [];
    try {
      for (let i = 0; i < pages.length; i++) strips.push(await savePage(id, i + 1, pages[i]!));
    } catch (e) {
      request.log.error({ err: e }, 'scan upload');
      return reply.code(500).send({ error: { code: 'SCAN_SAVE', message: 'السيرفر ماقدرش يحفظ صفحات الفاتورة — جرّب تاني بعد لحظة' } });
    }
    const now = new Date().toISOString();
    const s: Scan = {
      id,
      status: 'pending',
      attempts: 0,
      nextAt: now,
      supplier: typeof body.supplier === 'string' ? body.supplier.trim().slice(0, 120) : '',
      createdBy: currentUser(request).name ?? '',
      createdAt: now,
      updatedAt: now,
      pages: pages.length,
      strips,
      ...(expect > pages.length ? { expect, nextAt: LATER } : {}),
      result: null,
      error: '',
    };
    await store.mutate((L) => L.unshift(s));
    if (expect > pages.length) return s;
    return runNow(id);
  });

  /** The next page of a page-by-page upload; the read starts with the last one. */
  app.post('/:id/pages', { bodyLimit: 20 * 1024 * 1024 }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = (request.body ?? {}) as { full?: unknown; strips?: unknown[]; text?: unknown };
    if (!b64(p.full)) return reply.code(400).send({ error: { code: 'BAD_INPUT', message: 'الصفحة فاضية' } });
    const cur = (await store.all()).find((x) => x.id === id);
    if (!cur || !cur.expect || cur.pages >= cur.expect) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'الفاتورة دي مش مستنية صفحات — ارفع الملف تاني' } });
    let n: number;
    try {
      n = await savePage(id, cur.pages + 1, p);
    } catch (e) {
      request.log.error({ err: e }, 'scan upload');
      return reply.code(500).send({ error: { code: 'SCAN_SAVE', message: 'السيرفر ماقدرش يحفظ صفحة الفاتورة — جرّب تاني بعد لحظة' } });
    }
    const s = await store.mutate((L) => {
      const x = L.find((y) => y.id === id);
      if (!x) return null;
      x.pages += 1;
      x.strips = [...(x.strips ?? []), n];
      if (x.pages >= (x.expect ?? 0)) Object.assign(x, { expect: undefined, nextAt: new Date().toISOString() });
      x.updatedAt = new Date().toISOString();
      return { ...x };
    });
    if (!s) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'الفاتورة اتمسحت' } });
    return s.expect ? s : runNow(id);
  });

  app.post('/:id/retry', async (request) => {
    const { id } = request.params as { id: string };
    await store.patch(id, { status: 'pending', attempts: 0, error: '', nextAt: new Date().toISOString() });
    return { scan: await runNow(id) };
  });

  /** 🔍 «اقرا تاني بدقة أعلى»: strips right away for every page. */
  app.post('/:id/deep', async (request) => {
    const { id } = request.params as { id: string };
    await store.patch(id, { status: 'pending', attempts: 0, error: '', deep: true, nextAt: new Date().toISOString() });
    return { scan: await runNow(id) };
  });

  /** Turned into a purchase invoice: keep the record (with the invoice number), drop the photos. */
  app.post('/:id/used', async (request) => {
    const { id } = request.params as { id: string };
    const { pno } = (request.body ?? {}) as { pno?: string };
    const s = await store.mutate((L) => {
      const x = L.find((y) => y.id === id);
      if (x) Object.assign(x, { status: 'used', result: { ...(x.result ?? { items: [] }), ...(pno ? { pno } : {}) }, updatedAt: new Date().toISOString() });
      return x ? { ...x } : null;
    });
    if (s) await dropFiles(s);
    return { scan: s };
  });

  app.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const gone = await store.mutate((L) => {
      const i = L.findIndex((x) => x.id === id);
      return i >= 0 ? L.splice(i, 1)[0] : undefined;
    });
    if (gone) await dropFiles(gone);
    return { ok: true };
  });
}

/** ⏰ cron (Vercel): retries the reads that are waiting (Google was busy). */
export const scanTick = (db: PrismaClient, log: FastifyInstance['log']) => tick(new Store(db), log);

export const _test = { readAll, tick: (db: PrismaClient, log: FastifyInstance['log']) => tick(new Store(db), log) };
