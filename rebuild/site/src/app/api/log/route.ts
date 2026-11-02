// Errors that happen in customers' browsers land here → server log (and LOG_WEBHOOK if set, e.g. a chat
// webhook that accepts {text}). Small, rate-limited, never stores anything.
import { NextResponse } from 'next/server';
import { z } from 'zod';

const body = z.object({ msg: z.string().max(300), url: z.string().max(300), stack: z.string().max(1200).optional(), ua: z.string().max(200).optional() });
let windowStart = 0, count = 0;

export async function POST(req: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; count = 0; }
  if (++count > 60) return new NextResponse(null, { status: 429 });
  let e: z.infer<typeof body>;
  try { e = body.parse(JSON.parse(await req.text())); } catch { return new NextResponse(null, { status: 400 }); }
  console.error('[client-error]', JSON.stringify(e));
  const hook = process.env.LOG_WEBHOOK;
  if (hook) fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `⚠️ خطأ في الموقع\n${e.msg}\n${e.url}` }) }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
