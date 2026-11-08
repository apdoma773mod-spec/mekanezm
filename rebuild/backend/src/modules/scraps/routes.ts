import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { getFile } from '../../lib/files.js';
import { geminiJson, geminiKey } from '../web/catalog-ai.js';
import { API, activeCount, addWant, expiry, newSecret, publicView } from './service.js';

/**
 * 🪵 «سوق الفضلة» for the public site (replaces the old Supabase functions scrap_list, scrap_add, scrap_contact,
 * scrap_done, scrap_renew, scrap_report, scrap_mine). Open to visitors: names and phones only through /contact.
 * The owner of a listing proves it with the secret he got when he added it (kept on his phone / in the WhatsApp link).
 */
const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });
const cat = z.enum(['sheet', 'solid', 'alu']);
const num = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]);
const numOpt = z.union([num, z.literal(''), z.null()]).optional().transform((v) => (v === '' || v == null ? null : v));
// a full https link, or what /web/public/media returns (/api/v1/work/files/…), kept as a full link so the site can show it
const imgUrl = z
  .string()
  .max(500)
  .regex(/^(https:\/\/|\/api\/v1\/work\/files\/[\w.-]+$)/)
  .transform((u) => (u.startsWith('/') ? API + u : u));
const pair = z.object({ id: z.string().uuid(), secret: z.string().min(8).max(64) });

export default async function scrapRoutes(app: FastifyInstance) {
  const db = app.prisma;
  const live = () => ({ status: 'active', expiresAt: { gt: new Date() } });
  const own = async (id: string, secret: string) => {
    const s = await db.scrap.findUnique({ where: { id } });
    if (!s || s.secret !== secret) throw notFound('مش لاقي الفضلة دي');
    return s;
  };

  app.get('/', limit(60), async (_request, reply) => {
    const rows = await db.scrap.findMany({ where: live(), orderBy: { createdAt: 'desc' }, take: 1500 });
    reply.header('cache-control', 'public, max-age=30');
    return rows.map(publicView);
  });

  // 📏 «صوّر المتر»: بيقرا طول/عرض القطعة من صورة شريط القياس. قراءتين مستقلتين من Gemini — لو اتفقوا والثقة عالية يرجّع الرقم،
  // لو اختلفوا (٤٣ ولا ٣٤؟) أو الثقة واطية يرجّع ambiguous=true مع المرشحين والموقع يسأل الصنايعي.
  app.post('/read-tape', { ...limit(8), bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const { image } = parse(z.object({ image: z.string().min(10).max(12_000_000) }), request.body);
    let buf: Buffer | null = null;
    const m = image.match(/^(?:https:\/\/[^/]+)?\/api\/v1\/work\/files\/([\w.-]+)$/);
    if (m) buf = await getFile(m[1]!);
    else if (!/^https?:/.test(image)) buf = Buffer.from(image.includes(',') ? image.slice(image.indexOf(',') + 1) : image, 'base64');
    if (!buf?.length || buf.length > 9 * 1024 * 1024) throw badRequest('الصورة مش واضحة أو كبيرة');
    const key = await geminiKey(db);
    if (!key) throw badRequest('قراءة المتر مش شغالة دلوقتي');
    const photo = { data: buf.toString('base64'), mime: buf.subarray(0, 4).toString('hex') === '89504e47' ? 'image/png' : 'image/jpeg' };
    const prompt = `الصورة فيها قطعة (خشب/ألواح/ألمنيوم) وجنبها أو عليها متر شريط قياس. اقرا مقاس القطعة نفسها.
قواعد الدقة (مهمة جدًا):
- اقرا الرقم المطبوع على المتر عند حافة القطعة بالظبط (آخر نقطة بتلمس فيها القطعة)، مش أقرب رقم باين.
- الأرقام على المتر بتتقري بالترتيب (...41 42 43 44...): تأكد إن الرقم منطقي بين اللي قبله واللي بعده، ماتقلبش 43 بـ 34 ولا تزوّد رقم.
- فرّق السم من المم: الرقم الكبير = سم، والعلامات الصغيرة بين الأرقام = مم. رجّع كل حاجة بالسنتيمتر (ممكن كسر عشري زي 43.5).
- len_cm = الضلع الأطول، wid_cm = الضلع الأقصر. لو مش باين الضلع التاني حطه null.
- لو مش متأكد من رقم، حط الاحتمالين في len_alt أو wid_alt بدل ما تخمّن.
- confidence من 0 لـ 1 (أد إيه أنت متأكد إن الأرقام صح).
رجّع JSON بس: {"len_cm":number|null,"wid_cm":number|null,"len_alt":[number],"wid_alt":[number],"confidence":number,"note":"string"}`;
    type R = { len_cm?: number | null; wid_cm?: number | null; len_alt?: number[]; wid_alt?: number[]; confidence?: number };
    const one = () => geminiJson<R>(key, prompt, photo).catch(() => null);
    const reads = (await Promise.all([one(), one()])).filter((r): r is R => !!r);
    if (!reads.length) throw badRequest('معرفتش أقرا المتر، صوّر تاني أقرب وأوضح');
    const ok = (n: unknown): n is number => typeof n === 'number' && isFinite(n) && n > 0 && n < 1000;
    const rnd = (n: number) => Math.round(n * 10) / 10;
    const pick = (f: 'len' | 'wid') => {
      const main = reads.map((r) => r[`${f}_cm`]).filter(ok).map(rnd);
      const alts = reads.flatMap((r) => r[`${f}_alt`] ?? []).filter(ok).map(rnd);
      const all = [...new Set([...main, ...alts])];
      return { val: main[0] ?? null, all, agree: main.length === reads.length && all.length === 1 };
    };
    const L = pick('len'), W = pick('wid');
    const conf = Math.min(...reads.map((r) => (typeof r.confidence === 'number' ? r.confidence : 0.5)));
    const ambiguous = L.val == null || conf < 0.7 || !L.agree || (W.val != null && !W.agree) || reads.length < 2;
    const ls: (number | null)[] = L.all.length ? L.all.slice(0, 3) : [null];
    const ws: (number | null)[] = W.all.length ? W.all.slice(0, 3) : [null];
    const candidates = ls.flatMap((len) => ws.map((wid) => ({ len, wid }))).slice(0, 6);
    return { len: L.val, wid: W.val, confidence: Math.round(conf * 100) / 100, ambiguous, candidates };
  });

  app.post('/', limit(10), async (request) => {
    const p = parse(
      z.object({
        category: cat,
        material: z.string().max(60).default(''), brand: z.string().max(60).default(''), code: z.string().max(40).default(''), color: z.string().max(60).default(''),
        thick: numOpt, len: num.refine((n) => n > 0 && n < 10000), wid: numOpt, qty: num.default(1),
        cond: z.enum(['new', 'used', 'scratched']).default('new'), edge: z.boolean().default(false), grain: z.boolean().default(false),
        price_mode: z.enum(['free', 'swap', 'ask', 'price']).default('ask'), price: numOpt,
        area: z.string().max(80).default(''), name: z.string().trim().min(2).max(80), phone: z.string().max(30),
        note: z.string().max(400).default(''), imgs: z.array(imgUrl).max(4).default([]),
      }),
      request.body,
    );
    const ph = p.phone.replace(/\D/g, '');
    if (ph.length < 10) throw badRequest('رقم الموبايل ناقص');
    const phone = '0' + ph.slice(-10);
    if ((await activeCount(db, phone)) >= 40) throw badRequest('عندك ٤٠ فضلة متسجلة — شيل اللي اتباع الأول');
    const s = await db.scrap.create({
      data: {
        secret: newSecret(), category: p.category, material: p.material, brand: p.brand, code: p.code, color: p.color,
        thick: p.thick, len: p.len, wid: p.wid, qty: Math.max(1, Math.min(999, Math.round(p.qty))), cond: p.cond, edge: p.edge, grain: p.grain,
        priceMode: p.price_mode, price: p.price, area: p.area, name: p.name, phone, note: p.note, imgs: p.imgs, expiresAt: expiry(),
      },
    });
    return { id: s.id, secret: s.secret };
  });

  /** «اطلبها»: the owner's name, phone and area (every reveal is counted) */
  app.post('/:id/contact', limit(20), async (request) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const s = await db.scrap.findFirst({ where: { id, ...live() } });
    if (!s) throw notFound('الفضلة دي مبقتش متاحة');
    await db.scrap.update({ where: { id }, data: { reveals: { increment: 1 } } });
    return { name: s.name, phone: s.phone, area: s.area };
  });

  /** the owner's listings: pairs (id, secret) kept on his phone or from the WhatsApp link */
  app.post('/mine', limit(30), async (request) => {
    const { pairs } = parse(z.object({ pairs: z.array(pair).max(100) }), request.body);
    if (!pairs.length) return [];
    const rows = await db.scrap.findMany({ where: { id: { in: pairs.map((p) => p.id) } } });
    const ok = new Map(pairs.map((p) => [p.id, p.secret]));
    return rows
      .filter((s) => ok.get(s.id) === s.secret)
      .map((s) => ({ ...publicView(s), status: s.status, expires_at: s.expiresAt.toISOString() }));
  });

  app.post('/:id/done', limit(30), async (request) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const b = parse(z.object({ secret: z.string().max(64), status: z.enum(['sold', 'removed', 'active']) }), request.body);
    await own(id, b.secret);
    await db.scrap.update({ where: { id }, data: { status: b.status } });
    return { ok: true };
  });

  app.post('/:id/renew', limit(30), async (request) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const b = parse(z.object({ secret: z.string().max(64) }), request.body);
    await own(id, b.secret);
    await db.scrap.update({ where: { id }, data: { status: 'active', expiresAt: expiry() } });
    return { ok: true };
  });

  /** three reports hide a listing until the owner looks at it */
  app.post('/:id/report', limit(5), async (request) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    const s = await db.scrap.findUnique({ where: { id } });
    if (!s) return { ok: true };
    await db.scrap.update({ where: { id }, data: { reports: { increment: 1 }, ...(s.reports + 1 >= 3 ? { status: 'hidden' } : {}) } });
    return { ok: true };
  });

  /** a search that found nothing: owners of near pieces get «حد دوّر على مقاسك» (without the searcher's number) */
  app.post('/want', limit(20), async (request) => {
    const q = parse(
      z.object({ category: cat, material: z.string().max(60).default(''), code: z.string().max(40).default(''), thick: numOpt, len: num.refine((n) => n > 0 && n < 10000), wid: numOpt }),
      request.body,
    );
    return addWant(db, q);
  });
}
