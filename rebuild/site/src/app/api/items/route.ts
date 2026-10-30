// Product snapshots by id or by code: /api/items?ids=a,b  or  /api/items?codes=1248,P0339
// Used by "اطلب بالكود" and shared-cart links.
import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { norm, toItem } from '@/lib/shop';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const list = (k: string) => (sp.get(k) ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 100);
  const { site, ok } = await getCatalog();
  const ids = new Set(list('ids'));
  const codes = new Set(list('codes').map(c => norm(c)));
  const L = site.products.filter(p => ids.has(p.id) || (p.code && codes.has(norm(p.code)))).map(p => toItem(p, ok(p)));
  return NextResponse.json(L, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
