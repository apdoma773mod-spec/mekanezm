// Live search suggestions for the top bar (the browser never downloads the whole catalog).
import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { images, queryProducts } from '@/lib/shop';

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 60);
  if (q.trim().length < 2) return NextResponse.json([]);
  const { site, ok } = await getCatalog();
  const L = queryProducts(site.products, ok, { q }).slice(0, 6).map(p => ({ id: p.id, name: p.name, img: images(p)[0] ?? '' }));
  return NextResponse.json(L, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}
