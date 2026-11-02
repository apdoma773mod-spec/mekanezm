// For uptime monitoring on the real server: 200 when the site can read its data, 503 otherwise.
import { NextResponse } from 'next/server';
import { getSite } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  const site = await getSite();
  const ok = site.products.length > 0 || site.sections.length > 0;
  return NextResponse.json(
    { ok, products: site.products.length, sections: site.sections.length, ms: Date.now() - t0, at: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
