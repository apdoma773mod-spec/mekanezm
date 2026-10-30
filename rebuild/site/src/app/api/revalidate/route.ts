// Instant refresh after the owner edits the shop in the system:
//   POST /api/revalidate?secret=…   (or GET, for a quick test from the browser)
// Set REVALIDATE_SECRET on the server; the system calls this after saving site content or stock.
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

async function handle(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || new URL(req.url).searchParams.get('secret') !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  revalidateTag('site');
  revalidateTag('stock');
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
