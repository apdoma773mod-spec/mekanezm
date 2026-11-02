// Printable price-quote request (عرض سعر) from a cart: /quote?i=ID.Q,…&n=NAME → print or save as PDF.
import type { Metadata } from 'next';
import { getCatalog, getSettings } from '@/lib/catalog';
import { shopPhones } from '@/lib/shop';
import { PrintBtn } from './print-btn';

export const metadata: Metadata = { title: 'عرض سعر | ميكانيزم', robots: { index: false } };

export default async function Quote({ searchParams }: { searchParams: Promise<{ i?: string; n?: string }> }) {
  const sp = await searchParams;
  const want = (sp.i ?? '').split(',').slice(0, 100).map(x => { const k = x.lastIndexOf('.'); return k > 0 ? { id: x.slice(0, k), q: Math.max(1, Math.min(9999, Number(x.slice(k + 1)) || 1)) } : { id: x, q: 1 }; });
  const [site, { site: full, ok }] = await Promise.all([getSettings(), getCatalog()]);
  const by = new Map(full.products.map(p => [p.id, p]));
  const rows = want.filter(w => by.has(w.id)).map(w => ({ p: by.get(w.id)!, q: w.q }));
  const date = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' });
  return (
    <div className="quote">
      <header>
        <div><b>{site.name}</b><span>{site.tagline}</span><span>{site.address}</span><span dir="ltr">{[site.phone, ...shopPhones(site)].filter(Boolean).join(' • ')}</span></div>
        <img src="/icon-192.png" alt="" width={72} height={72} />
      </header>
      <h1>طلب عرض سعر</h1>
      <p>التاريخ: {date}{sp.n ? ` — العميل: ${sp.n.slice(0, 60)}` : ''}</p>
      <table>
        <thead><tr><th>#</th><th>الكود</th><th>الصنف</th><th>الكمية</th><th>الحالة</th><th>السعر</th></tr></thead>
        <tbody>{rows.map(({ p, q }, i) => (
          <tr key={p.id}><td>{i + 1}</td><td dir="ltr">{p.code}</td><td>{p.name}</td><td>{q}</td><td>{ok(p) ? 'متوفر' : 'بالحجز'}</td><td /></tr>
        ))}</tbody>
      </table>
      <p className="note">الأسعار بتتأكد من المحل وقت الطلب. ابعت الورقة دي على الواتساب أو كلّمنا على الأرقام اللي فوق.</p>
      <PrintBtn />
    </div>
  );
}
