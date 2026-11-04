// Resizes photos uploaded in the system (full-size originals on the shop PC) and lets the CDN keep the result,
// so product pages open fast and the pictures survive the PC being off.
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

const FILE = /^[0-9a-f]{24}\.(?:jpe?g|png|webp)$/i;
// Straight from the backend when this site runs next to it; otherwise through the system panel's public address.
const BACKEND = process.env.BACKEND_URL?.replace(/\/$/, '');
const SOURCE = BACKEND ? `${BACKEND}/api/v1/work/files/` : 'https://mekanezm-admin.vercel.app/api/v1/work/files/';
const WIDTHS = [256, 640, 1200, 1920];

// The shop PC sits behind a tunnel that chokes on many parallel downloads: fetch each original once, three at a time.
const originals = new Map<string, Promise<Buffer>>();
let running = 0;
const waiting: (() => void)[] = [];

async function original(file: string): Promise<Buffer> {
  const hit = originals.get(file);
  if (hit) return hit;
  const job = (async () => {
    while (running >= 3) await new Promise<void>(r => waiting.push(r));
    running++;
    try {
      for (let i = 0; ; i++) {
        if (i) await new Promise(r => setTimeout(r, 1500 * i));
        try {
          const r = await fetch(SOURCE + file, { headers: { 'ngrok-skip-browser-warning': '1' }, signal: AbortSignal.timeout(30000) });
          if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`source ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        } catch (e) { if (i >= 2) throw e; }
      }
    } finally { running--; waiting.shift()?.(); }
  })();
  originals.set(file, job);
  job.catch(() => originals.delete(file));
  if (originals.size > 24) originals.delete(originals.keys().next().value as string);
  return job;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const file = (await ctx.params).file;
  if (!FILE.test(file)) return NextResponse.json({ message: 'not found' }, { status: 404 });
  const want = Number(req.nextUrl.searchParams.get('w')) || 640;
  const w = WIDTHS.find(x => x >= want) ?? WIDTHS[WIDTHS.length - 1];
  try {
    const out = await sharp(await original(file)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    return new NextResponse(new Uint8Array(out), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable' },
    });
  } catch {
    return new NextResponse('image unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
