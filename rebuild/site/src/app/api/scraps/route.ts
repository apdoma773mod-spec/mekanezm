import { NextResponse } from 'next/server';
import { getScraps } from '@/lib/scraps-server';
import { matchScraps, type Cat, type Query } from '@/lib/scraps';

export const dynamic = 'force-dynamic';

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 100000 ? n : undefined; };
const txt = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : undefined);

/** GET /api/scraps?category=sheet&thick=18&len=70&wid=25&code=…&rotate=0 → matches (no contact details). */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const category = u.get('category') as Cat;
  const len = num(u.get('len'));
  if (!['sheet', 'solid', 'alu'].includes(category) || !len) return NextResponse.json({ error: 'bad query' }, { status: 400 });
  const q: Query = { category, len, wid: num(u.get('wid')), thick: num(u.get('thick')), material: txt(u.get('material')), brand: txt(u.get('brand')), code: txt(u.get('code')), rotate: u.get('rotate') !== '0' };
  const all = await getScraps();
  const hits = matchScraps(all, q).slice(0, 40);
  return NextResponse.json({ total: all.length, hits });
}
