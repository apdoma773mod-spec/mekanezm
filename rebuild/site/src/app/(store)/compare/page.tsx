// Side-by-side comparison: /compare?i=ID,ID[,ID] (built from the «قارن» button on product pages).
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { images, money, parseSpecs, priceOf, productPath, sectionOf } from '@/lib/shop';
import { ClearCompare } from './clear';

export const metadata: Metadata = { title: 'قارن بين المنتجات | ميكانيزم', robots: { index: false } };

export default async function Compare({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const ids = ((await searchParams).i ?? '').split(',').filter(Boolean).slice(0, 3);
  const { site, ok } = await getCatalog();
  const L = ids.map(id => site.products.find(p => p.id === id)).filter(p => !!p);
  if (L.length < 2) return (
    <main className="page"><h1>⚖️ قارن بين المنتجات</h1>
      <p className="mut">افتح أي منتج ودوس «⚖️ قارن مع منتج تاني»، وبعدين افتح منتج تاني ودوسها تاني. تقدر تقارن لحد ٣ منتجات.</p>
      <Link className="more" href="/search">تصفح المنتجات</Link></main>
  );
  const specs = L.map(p => new Map(parseSpecs(p.desc).rows.map(([k, v]) => [k, v])));
  const keys = [...new Set(specs.flatMap(m => [...m.keys()]))];
  const rows: [string, (string | null)[]][] = [
    ['القسم', L.map(p => sectionOf(site, p)?.name ?? '')],
    ['الكود', L.map(p => p.code)],
    ['الحالة', L.map(p => (ok(p) ? '✅ متوفر' : '📦 بالحجز'))],
    ['السعر', L.map(p => { const v = priceOf(p); return v ? money(v) : 'اسأل عن السعر'; })],
    ...keys.map(k => [k, specs.map(m => m.get(k) ?? '—')] as [string, string[]]),
  ];
  return (
    <main className="page cmp">
      <h1>⚖️ قارن بين المنتجات</h1>
      <div className="cmpw">
        <table>
          <thead><tr><th />{L.map(p => (
            <th key={p.id}><Link href={productPath(p.id)}>
              <span className="im framed">{images(p)[0] && <Image src={images(p)[0]} alt="" fill sizes="120px" style={{ objectFit: 'contain' }} />}</span>{p.name}
            </Link></th>
          ))}</tr></thead>
          <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td>{v.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {!keys.length && <p className="mut">المواصفات التفصيلية هتظهر هنا لما تتكتب في وصف المنتجات (سطر «المقاس: 45 سم» مثلاً).</p>}
      <ClearCompare />
    </main>
  );
}
