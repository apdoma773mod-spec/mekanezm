// Same-origin proxy to the new backend (it has no CORS). Only the public shop endpoints pass through.
// The ngrok-skip header stops ngrok's free plan from answering with its browser warning page.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Reading a drawing (web/public/takeoff): the backend allows itself up to 95 s.
export const maxDuration = 150;

const ALLOWED = /^(?:web\/public\/(?:takeoff|orders|requests|custom|media|track|track-custom|reviews|notify-me|visit)|web\/scraps|web\/scraps\/(?:mine|want|read-tape)|web\/scraps\/[0-9a-zA-Z_-]+\/(?:contact|done|renew|report))$/;
const ALLOWED_GET = /^web\/public\/(stock|reviews|site|catalog-latest(?:\/print)?)$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const base = process.env.BACKEND_URL?.replace(/\/$/, '');
  const path = (await ctx.params).path.join('/');
  if (!base || !ALLOWED.test(path)) return NextResponse.json({ message: 'not found' }, { status: 404 });
  try {
    const r = await fetch(`${base}/api/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      },
      body: await req.text(),
      cache: 'no-store',
    });
    return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return NextResponse.json({ message: 'backend unreachable' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const base = process.env.BACKEND_URL?.replace(/\/$/, '');
  const path = (await ctx.params).path.join('/');
  if (!base || !ALLOWED_GET.test(path)) return NextResponse.json({ message: 'not found' }, { status: 404 });
  try {
    const r = await fetch(`${base}/api/v1/${path}${req.nextUrl.search}`, {
      headers: { 'ngrok-skip-browser-warning': '1', 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
      cache: 'no-store',
    });
    let body = await r.text();
    // The catalog page points at the system's own /api/v1/work/files/… (relative): here that would be a 404 and white pictures.
    // Send those through the site's resizing image route instead.
    if (path.startsWith('web/public/catalog-latest')) {
      body = body.replace(/(?:https?:\/\/[^"')\s]+)?\/api\/v1\/work\/files\/([0-9a-f]{24}\.(?:jpe?g|png|webp))(?:\?[^"')\s]*)?/gi, '/mkimg/$1?w=1200&v=2');
    }
    return new NextResponse(body, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return NextResponse.json({ message: 'backend unreachable' }, { status: 502 });
  }
}
