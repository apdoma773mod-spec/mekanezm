import { randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient, Scrap } from '@prisma/client';
import { putFile } from '../../lib/files.js';
import { describe, isHit, isNear, isScrapText, missing, parseScrapText, cleanText, type Draft } from './match.js';

/**
 * «سوق الفضلة» in the system: listings, the craftsman's own WhatsApp registration, and «حد دوّر على مقاسك».
 * Mekanizm only connects people: it never sells these pieces.
 */
export const SITE = 'https://mekanezm.vercel.app';
export const API = process.env.PUBLIC_API_URL || 'https://mekanizm-api.vercel.app';
const DAYS = 30;
const MAX_ACTIVE = 40;
const PENDING_KEY = 'scrap_wa_pending';
const PENDING_MIN = 30;
const BY = '🪵 سوق الفضلة';
const PING_EVERY_DAYS = 3;
const PINGS_PER_WANT = 5;

const digits = (s: string) => String(s || '').replace(/\D/g, '');
const tail = (s: string) => digits(s).slice(-10);
export const intl = (p: string) => {
  const d = digits(p);
  if (d.length < 9) return '';
  return d.startsWith('20') ? d : '20' + d.replace(/^0/, '');
};
const local = (p: string) => { const t = tail(p); return t.length === 10 ? '0' + t : digits(p); };
export const newSecret = () => randomBytes(12).toString('hex');
export const expiry = () => new Date(Date.now() + DAYS * 864e5);

/** what visitors may see (never the name or the phone) */
export const publicView = (s: Scrap) => ({
  id: s.id, category: s.category, material: s.material, brand: s.brand, code: s.code, color: s.color,
  thick: s.thick, len: s.len, wid: s.wid, qty: s.qty, cond: s.cond, edge: s.edge, grain: s.grain,
  price_mode: s.priceMode, price: s.price, area: s.area, note: s.note, imgs: s.imgs, created_at: s.createdAt.toISOString(),
});

export async function activeCount(db: PrismaClient, phone: string) {
  return db.scrap.count({ where: { phone: local(phone), status: 'active', expiresAt: { gt: new Date() } } });
}

export const mineLink = (pairs: { id: string; secret: string }[]) => `${SITE}/scraps/mine?k=${pairs.map((p) => `${p.id}.${p.secret}`).join(',')}`;

// ───────────── WhatsApp registration ─────────────

interface Pending { draft: Draft; ask: 'size' | 'thick'; img: string[]; name: string; at: number }
type PendingMap = Record<string, Pending>;

async function getPending(db: PrismaClient): Promise<PendingMap> {
  const all = ((await db.setting.findUnique({ where: { key: PENDING_KEY } }))?.value as unknown as PendingMap) ?? {};
  const now = Date.now();
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v && now - v.at < PENDING_MIN * 60_000));
}
const putPending = (db: PrismaClient, m: PendingMap) =>
  db.setting.upsert({ where: { key: PENDING_KEY }, create: { key: PENDING_KEY, value: m as unknown as Prisma.InputJsonValue }, update: { value: m as unknown as Prisma.InputJsonValue } });

const reply = (db: PrismaClient, phone: string, body: string) => {
  const to = intl(phone);
  return to ? db.outboundMessage.create({ data: { toPhone: to, body, byName: BY } }) : null;
};

const QUESTION: Record<'size' | 'thick', string> = {
  size: 'تمام 👍 ابعت مقاس الحتة بالسنتي زي: 70×30 (ولو أكتر من حتة: 70×30×2)',
  thick: 'تمام 👍 سمك اللوح كام مم؟ (مثلاً 18)',
};

/** save a WhatsApp photo as a file and return its public link */
export async function savePhoto(dataUrl: string): Promise<string> {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) return '';
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  await putFile(name, Buffer.from(m[2], 'base64'), `image/${m[1]}`);
  return `${API}/api/v1/work/files/${name}`;
}

async function register(db: PrismaClient, phone: string, name: string, d: Draft, imgs: string[]) {
  const ph = local(phone);
  const room = MAX_ACTIVE - (await activeCount(db, ph));
  if (room <= 0) {
    await reply(db, phone, `عندك ${MAX_ACTIVE} فضلة متسجلة بالفعل 🙏 شيل اللي اتباع من «فضلتي» الأول.`);
    return [];
  }
  const rows: Scrap[] = [];
  for (const p of d.pieces.slice(0, room)) {
    rows.push(
      await db.scrap.create({
        data: {
          secret: newSecret(), category: d.category, material: d.material, brand: d.brand, code: d.code, color: d.color,
          thick: d.thick, len: p.len, wid: p.wid, qty: p.qty, name: (name || 'صنايعي').slice(0, 80), phone: ph,
          imgs: imgs.slice(0, 4), source: 'whatsapp', expiresAt: expiry(),
        },
      }),
    );
  }
  const lines = d.pieces.slice(0, room).map((p) => describe(d, p));
  await reply(
    db,
    phone,
    ['اتسجلت ✔ في سوق الفضلة:', ...lines, `هتفضل ظاهرة ${DAYS} يوم، وأي حد محتاجها هيكلمك على طول.`, 'لما تتباع أو تحب تشيلها:', mineLink(rows), 'ميكانيزم'].join('\n'),
  );
  return rows;
}

/**
 * Called by the bridge for every WhatsApp text / photo caption before it becomes a normal order or photo.
 * Returns true when the message was about an offcut (registered or a question was asked), so the bridge
 * route must not store it as an order.
 */
export async function handleScrapMessage(db: PrismaClient, msg: { phone: string; name: string; text: string; img?: string }): Promise<boolean> {
  const key = tail(msg.phone);
  if (key.length < 10) return false;
  const text = cleanText(msg.text);
  const pending = await getPending(db);
  const open = pending[key];

  if (open && /^(الغ[يى]|لا|كنسل|خلاص)$/.test(text)) {
    delete pending[key];
    await putPending(db, pending);
    await reply(db, msg.phone, 'تمام، اتلغت 👍');
    return true;
  }

  if (!isScrapText(text)) {
    if (!open) return false;
    // an answer to the one question we asked (or the photo of the piece)
    const d = open.draft;
    const got = parseScrapText(text);
    if (open.ask === 'thick') {
      const n = got.thick ?? Number((/\d+(?:\.\d+)?/.exec(text) ?? [''])[0]);
      if (n > 0 && n < 100) d.thick = n;
      if (got.pieces.length && !d.pieces.length) d.pieces = got.pieces;
    } else if (got.pieces.length) {
      d.pieces = got.pieces;
      if (d.thick == null && got.thick != null) d.thick = got.thick;
    }
    if (msg.img) open.img.push(await savePhoto(msg.img));
    const ask = missing(d);
    if (!ask) {
      delete pending[key];
      await putPending(db, pending);
      await register(db, msg.phone, open.name || msg.name, d, open.img.filter(Boolean));
      return true;
    }
    if (!text && msg.img) { await putPending(db, pending); return true; } // just the photo: keep waiting for the answer
    if (ask === open.ask && !(got.pieces.length || got.thick != null)) {
      // not understood twice: give up on the conversation, it will go to the normal orders
      if (Date.now() - open.at > 2 * 60_000) { delete pending[key]; await putPending(db, pending); return false; }
    }
    open.ask = ask;
    pending[key] = open;
    await putPending(db, pending);
    await reply(db, msg.phone, QUESTION[ask]);
    return true;
  }

  // a new offcut message
  const d = parseScrapText(text);
  const imgs: string[] = [];
  if (msg.img) imgs.push(await savePhoto(msg.img));
  else {
    // the photo usually arrives a moment before the text: take the last captionless photo from the same number
    const since = new Date(Date.now() - 10 * 60_000);
    const ph = await db.waPhoto.findFirst({ where: { createdAt: { gte: since }, caption: '', status: 'new', phone: { endsWith: key } }, orderBy: { createdAt: 'desc' } });
    if (ph) {
      imgs.push(await savePhoto(ph.img));
      await db.waPhoto.update({ where: { id: ph.id }, data: { status: 'ignored', handledBy: BY, handledAt: new Date() } });
    }
  }
  const ask = missing(d);
  if (ask) {
    pending[key] = { draft: d, ask, img: imgs.filter(Boolean), name: msg.name, at: Date.now() };
    await putPending(db, pending);
    await reply(db, msg.phone, QUESTION[ask]);
    return true;
  }
  if (open) { delete pending[key]; await putPending(db, pending); }
  await register(db, msg.phone, msg.name, d, imgs.filter(Boolean));
  return true;
}

// ───────────── «حد دوّر على مقاسك» ─────────────

/** a site search that found nothing: remember it; the next cron tick tells owners of near pieces */
export async function addWant(db: PrismaClient, q: { category: string; material: string; code: string; thick: number | null; len: number; wid: number | null }) {
  const active = await db.scrap.findMany({ where: { status: 'active', expiresAt: { gt: new Date() }, category: q.category } });
  const hit = active.some((s) => isHit(s, q));
  if (hit) return { queued: false };
  // the same search twice in a day counts once
  const dup = await db.scrapWant.findFirst({
    where: { category: q.category, material: q.material, thick: q.thick, len: q.len, wid: q.wid, createdAt: { gte: new Date(Date.now() - 864e5) } },
  });
  if (dup) return { queued: false };
  await db.scrapWant.create({ data: q });
  return { queued: true };
}

/** cron: one WhatsApp per near piece (not more than once every few days per piece), never showing who asked */
export async function pingWants(db: PrismaClient): Promise<number> {
  const wants = await db.scrapWant.findMany({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, take: 20 });
  if (!wants.length) return 0;
  const quiet = new Date(Date.now() - PING_EVERY_DAYS * 864e5);
  const pieces = await db.scrap.findMany({
    where: { status: 'active', expiresAt: { gt: new Date() }, OR: [{ pingedAt: null }, { pingedAt: { lt: quiet } }] },
  });
  let sent = 0;
  const used = new Set<string>();
  for (const w of wants) {
    const near = pieces.filter((s) => !used.has(s.id) && isNear(s, w)).slice(0, PINGS_PER_WANT);
    for (const s of near) {
      const size = w.wid ? `${w.len}×${w.wid}` : `${w.len}`;
      const body = [
        `أهلاً${s.name && s.name !== 'صنايعي' ? ' ' + s.name : ''} 👋`,
        `في حد دوّر في سوق الفضلة على ${size} سم${w.thick ? ` سمك ${w.thick}مم` : ''} — قريب من فضلتك:`,
        describe({ category: s.category as Draft['category'], material: s.material, color: s.color, code: s.code, thick: s.thick }, { len: s.len, wid: s.wid, qty: s.qty }),
        'لسه موجودة؟ لو اتباعت شيلها من هنا عشان محدش يتعب:',
        mineLink([s]),
        'ميكانيزم',
      ].join('\n');
      if (await reply(db, s.phone, body)) {
        await db.scrap.update({ where: { id: s.id }, data: { pingedAt: new Date() } });
        used.add(s.id);
        sent++;
      }
    }
    await db.scrapWant.update({ where: { id: w.id }, data: { status: 'done', pinged: near.length } });
  }
  await db.scrapWant.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 60 * 864e5) } } });
  return sent;
}
