import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actorOf } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { randomBytes } from 'node:crypto';
import { putFile } from '../../lib/files.js';
import { actorName } from '../../lib/names.js';
import { geminiJson, geminiKey } from '../web/catalog-ai.js';

/**
 * 📥 صناديق الوارد للمدير: طلبات الواتساب وصور الواتساب (الفلوس الواصلة في sms.ts).
 * كل شاشة بتعرض تبويبات زي القديم: جديدة / اتعملها / متجاهلة.
 */
const WA_ORDER_TABS: Record<string, string[]> = { new: ['new'], done: ['done', 'promoted'], other: ['ignored'] };
const PHOTO_TABS: Record<string, string[]> = { new: ['new'], done: ['sent', 'paid', 'transfer', 'source'], other: ['missing', 'ignored'] };
const PHOTO_STATUSES = ['new', 'sent', 'missing', 'ignored', 'paid', 'transfer', 'source'];
const last10 = (p: string) => String(p || '').replace(/\D/g, '').slice(-10);

/** 📇 مصادر وأسعار من بره (موردين في جروبات الواتساب، شركات بتبعت صور منتجات وأسعار): مش مخزون، مرجع للبحث والمقارنة */
const SRC_KEY = 'wa_sources';
export interface SrcBook {
  sources: { id: string; name: string; phones: string[]; note: string; supplierId?: string; at: string }[];
  items: { id: string; name: string; brand: string; price: number; unit: string; code: string; sourceId: string; img: string; productId?: string; at: string }[];
}

const tabQuery = z.object({ tab: z.enum(['new', 'done', 'other']).default('new') });
const statusBody = (allowed: string[]) => z.object({ status: z.enum(allowed as [string, ...string[]]) });

export async function inboxAdminRoutes(app: FastifyInstance) {
  const db = app.prisma;
  app.addHook('preHandler', app.requireAdmin);

  /** 🔑 كلمات الواتساب المفتاحية: القواعد اللي الجسر بيفلتر بيها الرسايل (نفس شكل mk_settings.wa_rules القديم). */
  app.get("/wa-rules", async () => {
    const s = await db.setting.findUnique({ where: { key: "wa_rules" } });
    const stat = await db.setting.findUnique({ where: { key: "wa_rules_stat" } });
    return { rules: s?.value ?? null, stat: stat?.value ?? null };
  });

  app.put("/wa-rules", async (request) => {
    const body = z.object({ rules: z.record(z.unknown()) }).parse(request.body);
    if (!Array.isArray(body.rules.rules) || body.rules.rules.length === 0) throw badRequest("لازم قاعدة واحدة على الأقل");
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "wa_rules" },
        create: { key: "wa_rules", value: body.rules as object, updatedById: actor.id },
        update: { value: body.rules as object, updatedById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: "SETTING_UPDATE", entity: "Setting", entityId: "wa_rules", ip: actor.ip });
    });
    return { ok: true };
  });

  /** Badge numbers for the sidebar and the dashboard tiles. */
  app.get('/counts', async () => {
    const [sms, waOrders, waPhotos] = await Promise.all([
      db.smsIn.count({ where: { status: 'pending' } }),
      db.waOrder.count({ where: { status: 'new' } }),
      db.waPhoto.count({ where: { status: 'new' } }),
    ]);
    return { sms, waOrders, waPhotos };
  });

  app.get('/wa-orders', async (request) => {
    const { tab } = tabQuery.parse(request.query);
    const rows = await db.waOrder.findMany({
      where: { status: { in: WA_ORDER_TABS[tab] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        customerName: r.customerName,
        body: r.body,
        status: r.status,
        invoiceNo: r.invoiceNo,
        createdAt: r.createdAt.toISOString(),
        handledAt: r.handledAt?.toISOString() ?? null,
      })),
    };
  });

  app.post('/wa-orders/:id/status', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = statusBody(['new', 'done', 'ignored', 'promoted']).parse(request.body);
    const row = await db.waOrder.findUnique({ where: { id } });
    if (!row) throw notFound('الطلب ده مش موجود');
    await db.waOrder.update({ where: { id }, data: { status, handledAt: new Date() } });
    return { ok: true };
  });

  app.get('/wa-photos', async (request) => {
    const { tab } = tabQuery.parse(request.query);
    const rows = await db.waPhoto.findMany({
      where: { status: { in: PHOTO_TABS[tab] } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      // الصورة نفسها مش بتتبعت هنا (كانت ١٠٠ صورة كاملة في رد واحد = تقيل جدًا): بتتحمّل لوحدها من /img بحجم صغير
      select: { id: true, phone: true, name: true, caption: true, status: true, handledBy: true, createdAt: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: r.name,
        caption: r.caption,
        img: `/api/v1/inbox/wa-photos/${r.id}/img`,
        thumb: `/api/v1/inbox/wa-photos/${r.id}/img?w=480`,
        status: r.status,
        handledBy: r.handledBy,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  const photoBuf = async (id: string) => {
    const row = await db.waPhoto.findUnique({ where: { id }, select: { img: true, phone: true, name: true, caption: true } });
    if (!row) throw notFound('الصورة دي مش موجودة');
    const m = /^data:(image\/[a-z]+);base64,/.exec(row.img);
    return { row, mime: m?.[1] ?? 'image/jpeg', buf: Buffer.from(row.img.slice(row.img.indexOf(',') + 1), 'base64') };
  };

  /** الصورة لوحدها (مصغّرة لو ?w=) — بتتخزن في الجهاز يوم كامل */
  app.get('/wa-photos/:id/img', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);
    const { w } = z.object({ w: z.coerce.number().int().min(0).max(2000).default(0) }).parse(request.query);
    const { mime, buf } = await photoBuf(id);
    let out = buf;
    let type = mime;
    if (w) {
      const sharp = (await import('sharp')).default;
      out = await sharp(buf).rotate().resize(w, w, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      type = 'image/webp';
    }
    return reply.header('content-type', type).header('cache-control', 'private, max-age=86400, immutable').send(out);
  });

  /** 🚫 الرقم ده مايجيليش منه صور ولا رسايل تاني: بيتضاف لـ «أرقام بتتجاهل دايمًا» في كلمات الواتساب، وكل اللي جه منه وجديد بيتجاهل */
  app.post('/wa-photos/:id/block', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const row = await db.waPhoto.findUnique({ where: { id }, select: { phone: true, name: true } });
    if (!row) throw notFound('الصورة دي مش موجودة');
    const ph = row.phone.replace(/\D/g, '');
    if (ph.length < 10) throw badRequest('الصورة دي مالهاش رقم واضح نمنعه');
    const actor = actorOf(request);
    const who = await actorName(db, actor);
    const r = await db.$transaction(async (tx) => {
      const cur = ((await tx.setting.findUnique({ where: { key: 'wa_rules' } }))?.value ?? {}) as Record<string, unknown>;
      const block = Array.isArray(cur.blockPhones) ? (cur.blockPhones as string[]) : [];
      const notes = (cur.phoneNotes && typeof cur.phoneNotes === 'object' ? cur.phoneNotes : {}) as Record<string, string>;
      if (!block.some((x) => last10(x) === last10(ph))) block.push(ph);
      if (row.name && !notes[ph]) notes[ph] = row.name;
      const next = { ...cur, blockPhones: block, phoneNotes: notes };
      await tx.setting.upsert({ where: { key: 'wa_rules' }, create: { key: 'wa_rules', value: next as object, updatedById: actor.id }, update: { value: next as object, updatedById: actor.id } });
      const photos = await tx.waPhoto.updateMany({ where: { status: 'new', phone: { endsWith: last10(ph) } }, data: { status: 'ignored', handledBy: who, handledAt: new Date() } });
      const orders = await tx.waOrder.updateMany({ where: { status: 'new', phone: { endsWith: last10(ph) } }, data: { status: 'ignored', handledAt: new Date() } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: 'wa_rules', after: { blocked: ph }, ip: actor.ip });
      return { photos: photos.count, orders: orders.count };
    });
    return { ok: true, phone: ph, ignored: r.photos + r.orders };
  });

  /** 📇 اقرا الصورة: الشركة/المورد وأرقامه والمنتجات والأسعار اللي فيها */
  app.post('/wa-photos/:id/read-source', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const key = await geminiKey(db);
    if (!key) throw badRequest('محتاج مفتاح Gemini (من صفحة الكتالوج ← 🤖)');
    const { row, buf } = await photoBuf(id);
    const sharp = (await import('sharp')).default;
    const small = await sharp(buf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const prompt = `دي صورة جاتلي على واتساب محل إكسسوارات مطابخ وموبيليا في مصر، من ${row.name || 'رقم'} (${row.phone}).${row.caption ? ` الكلام اللي معاها: «${row.caption.slice(0, 600)}».` : ''}
غالبًا صورة منتج أو قايمة أسعار من مورد أو شركة. طلّع منها:
- company: اسم الشركة أو المورد أو الماركة المكتوب على الصورة (لو مش واضح سيبه فاضي)
- phones: كل أرقام التليفون المكتوبة على الصورة أو في الكلام (أرقام بس)
- products: كل منتج ظاهر: name (اسم واضح بالعربي زي ما بيتقال في السوق)، brand، code (لو مكتوب)، price (رقم بس، بالجنيه، 0 لو مفيش سعر)، unit (قطعة/طقم/متر/دستة… لو مكتوب)
- note: سطر واحد يوصف الصورة
رجّع JSON بس: {"company":"","phones":[],"products":[{"name":"","brand":"","code":"","price":0,"unit":""}],"note":""}`;
    const d = await geminiJson<{ company?: string; phones?: string[]; products?: { name?: string; brand?: string; code?: string; price?: number; unit?: string }[]; note?: string }>(key, prompt, { data: small.toString('base64'), mime: 'image/jpeg' });
    const phones = [...new Set([...(d.phones ?? []).map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length >= 8), row.phone.replace(/\D/g, '')].filter(Boolean))].slice(0, 5);
    const book = ((await db.setting.findUnique({ where: { key: SRC_KEY } }))?.value ?? { sources: [], items: [] }) as unknown as SrcBook;
    const known = book.sources.find((s) => s.phones.some((x) => phones.some((y) => last10(x) === last10(y))));
    return {
      company: String(d.company ?? '').slice(0, 120) || known?.name || row.name || '',
      phones,
      note: String(d.note ?? '').slice(0, 200),
      knownSourceId: known?.id ?? null,
      products: (d.products ?? []).filter((x) => x?.name).slice(0, 40).map((x) => ({ name: String(x.name).slice(0, 160), brand: String(x.brand ?? '').slice(0, 60), code: String(x.code ?? '').slice(0, 40), price: Math.max(0, Number(x.price) || 0), unit: String(x.unit ?? '').slice(0, 20) })),
    };
  });

  /** 📇 احفظ: المصدر (أو مورد متسجّل) + المنتجات بأسعارها وصورتها؛ والمنتج المربوط بصنف عندي بيدخل في «أسعار السوق» للمقارنة */
  app.post('/wa-photos/:id/save-source', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const b = z
      .object({
        name: z.string().trim().min(1).max(120),
        phones: z.array(z.string().max(20)).max(6).default([]),
        note: z.string().max(300).default(''),
        asSupplier: z.boolean().default(false),
        products: z.array(z.object({ name: z.string().trim().min(1).max(160), brand: z.string().max(60).default(''), code: z.string().max(40).default(''), price: z.number().min(0).max(1e9).default(0), unit: z.string().max(20).default(''), productId: z.string().max(64).optional() })).max(40).default([]),
      })
      .parse(request.body);
    const { buf, mime } = await photoBuf(id);
    const actor = actorOf(request);
    const who = await actorName(db, actor);
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const file = `${randomBytes(12).toString('hex')}.${ext}`;
    await putFile(file, buf, mime);
    const img = `/api/v1/work/files/${file}`;
    const phones = [...new Set(b.phones.map((x) => x.replace(/\D/g, '')).filter((x) => x.length >= 8))];
    const at = new Date().toISOString();
    const res = await db.$transaction(async (tx) => {
      const book = ((await tx.setting.findUnique({ where: { key: SRC_KEY } }))?.value ?? { sources: [], items: [] }) as unknown as SrcBook;
      let src = book.sources.find((x) => x.phones.some((ph) => phones.some((y) => last10(ph) === last10(y)))) ?? book.sources.find((x) => x.name.trim() === b.name);
      if (!src) {
        src = { id: randomBytes(6).toString('hex'), name: b.name, phones, note: b.note, at };
        book.sources.push(src);
      } else {
        src.name = b.name;
        src.phones = [...new Set([...src.phones, ...phones])].slice(0, 6);
        if (b.note) src.note = b.note;
      }
      let supplierCreated = false;
      if (b.asSupplier && !src.supplierId) {
        const ex = phones.length ? await tx.contact.findFirst({ where: { type: 'SUPPLIER', deletedAt: null, OR: phones.map((x) => ({ phone: { endsWith: last10(x) } })) }, select: { id: true } }) : null;
        const c = ex ?? (await tx.contact.create({ data: { type: 'SUPPLIER', name: b.name, phone: phones[0] ?? '', note: 'من صور الواتساب' }, select: { id: true } }));
        src.supplierId = c.id;
        supplierCreated = !ex;
      }
      for (const it of b.products) book.items.push({ id: randomBytes(6).toString('hex'), name: it.name, brand: it.brand, price: it.price, unit: it.unit, code: it.code, sourceId: src.id, img, productId: it.productId, at });
      if (book.items.length > 8000) book.items = book.items.slice(-8000);
      await tx.setting.upsert({ where: { key: SRC_KEY }, create: { key: SRC_KEY, value: book as unknown as object, updatedById: actor.id }, update: { value: book as unknown as object, updatedById: actor.id } });
      const linked = b.products.filter((it) => it.productId && it.price > 0);
      if (linked.length) {
        const mp = ((await tx.setting.findUnique({ where: { key: 'market_prices' } }))?.value ?? {}) as Record<string, { s: string; p: number; at: string }[]>;
        for (const it of linked) mp[it.productId!] = [...(mp[it.productId!] ?? []).filter((o) => o.s !== b.name), { s: b.name, p: it.price, at: at.slice(0, 10) }].slice(-50);
        await tx.setting.upsert({ where: { key: 'market_prices' }, create: { key: 'market_prices', value: mp, updatedById: actor.id }, update: { value: mp, updatedById: actor.id } });
      }
      await tx.waPhoto.update({ where: { id }, data: { status: 'source', handledBy: who, handledAt: new Date() } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: SRC_KEY, after: { source: src.name, items: b.products.length, supplierCreated }, ip: actor.ip });
      return { sourceId: src.id, supplierCreated, items: b.products.length, linked: linked.length };
    });
    return { ok: true, ...res };
  });

  /** 📇 دفتر المصادر والمنتجات اللي من بره */
  app.get('/sources', async () => {
    const book = ((await db.setting.findUnique({ where: { key: SRC_KEY } }))?.value ?? { sources: [], items: [] }) as unknown as SrcBook;
    return book;
  });
  app.delete('/sources/items/:itemId', async (request) => {
    const { itemId } = z.object({ itemId: z.string().min(1).max(20) }).parse(request.params);
    const actor = actorOf(request);
    await db.$transaction(async (tx) => {
      const book = ((await tx.setting.findUnique({ where: { key: SRC_KEY } }))?.value ?? { sources: [], items: [] }) as unknown as SrcBook;
      book.items = book.items.filter((x) => x.id !== itemId);
      await tx.setting.upsert({ where: { key: SRC_KEY }, create: { key: SRC_KEY, value: book as unknown as object, updatedById: actor.id }, update: { value: book as unknown as object, updatedById: actor.id } });
    });
    return { ok: true };
  });

  app.post('/wa-photos/:id/status', async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = statusBody(PHOTO_STATUSES).parse(request.body);
    const row = await db.waPhoto.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw notFound('الصورة دي مش موجودة');
    await db.waPhoto.update({
      where: { id },
      data: { status, handledBy: await actorName(db, actorOf(request)), handledAt: new Date() },
    });
    return { ok: true };
  });
}
