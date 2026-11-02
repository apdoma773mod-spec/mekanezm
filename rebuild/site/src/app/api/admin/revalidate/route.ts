// Instant publish after the owner saves from /admin. The browser sends the owner's Supabase token; we check it
// really belongs to the owner (same test as the admin sign-in) before refreshing the cached pages.
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { SB_KEY, SB_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer [\w.-]{20,4000}$/.test(auth)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_state?select=owner&limit=1`, { headers: { apikey: SB_KEY, Authorization: auth }, cache: 'no-store' });
    const rows = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(rows) || !rows.length) return NextResponse.json({ ok: false }, { status: 403 });
  } catch { return NextResponse.json({ ok: false }, { status: 502 }); }
  revalidateTag('site');
  revalidateTag('stock');
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
