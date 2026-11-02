// A prepared order sent as a link: /cart?i=ID.QTY,ID.QTY (from «ابعت السلة كلينك»).
import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { SharedCart } from '@/components/tools';
import { getCatalog, getSettings } from '@/lib/catalog';
import { toItem } from '@/lib/shop';

export const metadata: Metadata = { title: 'طلب جاهز | ميكانيزم', robots: { index: false } };

export default async function CartLink({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const raw = (await searchParams).i ?? '';
  const want = raw.split(',').slice(0, 100).map(x => { const k = x.lastIndexOf('.'); return k > 0 ? { id: x.slice(0, k), q: Math.max(1, Math.min(9999, Number(x.slice(k + 1)) || 1)) } : { id: x, q: 1 }; });
  const [site, { site: full, ok }] = await Promise.all([getSettings(), getCatalog()]);
  const by = new Map(full.products.map(p => [p.id, p]));
  const lines = want.filter(w => by.has(w.id)).map(w => ({ item: toItem(by.get(w.id)!, ok(by.get(w.id)!)), q: w.q }));
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>طلب جاهز</span></nav>
        <h1 className="page-h">🛒 طلب جاهز ليك</h1>
        <p className="mut">الطلب ده اتجهّز ليك — راجعه وضيفه لطلبك، وبعدين ابعته.</p>
        <SharedCart lines={lines} />
      </main>
      <Footer site={site} />
    </>
  );
}
