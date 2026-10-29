import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { money } from '../../lib/money.js';

/**
 * 📲 فلوس فودافون كاش: الموبايل بيبعت كل رسالة فودافون كاش هنا (نفس شكل الـ Edge Function «sms-in» القديمة).
 * الرسالة بتتسجل «معلّقة»، ومحدش بيتسجل على حساب غير لما تأكد أنت.
 */
export function parseVodafoneSms(from: string, rawText: string): { amount: number; direction: 'in' | 'out'; phone: string | null; note: string } | null {
  const text = rawText.replace(/\\n|\\r|\s+/g, ' ').trim();
  const norm = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const amountM = norm.match(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:ج\.?م|جنيه|EGP|LE)/i);
  const isCash = /vf|فودافون|cash/i.test(`${from} ${text}`);
  if (!isCash || !amountM) return null;
  const amount = Number(amountM[1].replace(/,/g, ''));
  if (!(amount > 0)) return null;

  // تحويل صادر: أنت بعت فلوس لرقم
  const outM = /تم تحويل/.test(norm) ? norm.match(/لرقم\s*(\+?\d[\d\s]{8,14}\d)/) : null;
  // استلام: حد بعت لك فلوس
  const inM = /استلام|استلم/.test(norm) && !/تم تحويل/.test(norm) ? norm.match(/من رقم\s*(\+?\d[\d\s]{8,14}\d)/) : null;
  let direction: 'in' | 'out' | null = null;
  let phoneRaw: string | null = null;
  if (outM) {
    direction = 'out';
    phoneRaw = outM[1];
  } else if (inM) {
    direction = 'in';
    phoneRaw = inM[1];
  } else if (/استلام|استلم/.test(norm) && !/تم تحويل/.test(norm)) {
    direction = 'in';
  }
  if (!direction) return null;
  const phone = phoneRaw ? phoneRaw.replace(/\D/g, '').slice(-11) : null;
  const note = direction === 'out' ? 'فودافون كاش (تحويل صادر)' : 'فودافون كاش (استلام)';
  return { amount, direction, phone, note };
}

const smsBody = z.object({ token: z.unknown().optional(), text: z.unknown().optional(), from: z.unknown().optional() });

export async function smsRoutes(app: FastifyInstance) {
  const db = app.prisma;

  app.post('/in', async (request, reply) => {
    const secret = app.config.SMS_TOKEN;
    if (!secret) return reply.status(503).send({ error: 'not_configured' });
    // The old forwarder sent JSON, sometimes with raw line breaks in the text: read both ways.
    let raw: unknown = request.body;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    const b = smsBody.parse(raw ?? {});
    if (String(b.token ?? '').trim() !== secret) return reply.status(403).send({ error: 'forbidden' });
    const text = String(b.text ?? '');
    const from = String(b.from ?? '').slice(0, 60);
    const parsed = parseVodafoneSms(from, text);
    if (!parsed) return { ok: true, ignored: true };
    const row = await db.smsIn.create({
      data: { sender: from, amount: money(parsed.amount), note: parsed.note, phone: parsed.phone, direction: parsed.direction },
    });
    return { ok: true, id: row.id, amount: parsed.amount, direction: parsed.direction, phone: parsed.phone };
  });

  /** The owner's screen: money that arrived and waits for him to say whose it is. */
  app.get('/pending', { preHandler: app.requireAdmin }, async () => {
    const rows = await db.smsIn.findMany({ where: { status: 'pending' }, orderBy: { receivedAt: 'desc' }, take: 200 });
    return {
      items: rows.map((r) => ({
        id: r.id,
        sender: r.sender,
        amount: Number(r.amount),
        note: r.note,
        phone: r.phone,
        direction: r.direction,
        receivedAt: r.receivedAt.toISOString(),
      })),
    };
  });

  app.post('/:id/status', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { status } = z.object({ status: z.enum(['pending', 'used', 'ignored']) }).parse(request.body);
    await db.smsIn.update({ where: { id }, data: { status } });
    return { ok: true };
  });
}
