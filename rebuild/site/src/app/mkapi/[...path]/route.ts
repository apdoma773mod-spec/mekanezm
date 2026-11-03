// Same-origin proxy to the new backend (it has no CORS). Only the public shop endpoints pass through.
// The ngrok-skip header stops ngrok's free plan from answering with its browser warning page.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED = /^web\/public\/(orders|requests|custom|media|track|track-custom|reviews|notify-me|visit)$/;
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
    return new NextResponse(await r.text(), { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return NextResponse.json({ message: 'backend unreachable' }, { status: 502 });
  }
}
