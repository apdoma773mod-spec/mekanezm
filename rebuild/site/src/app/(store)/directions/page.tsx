import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { routesOf } from '@/lib/directions';
import { MAP_URL, waUrl } from '@/lib/shop';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'تجيلنا إزاي | ميكانيزم أرض اللواء',
  description: 'الطريق لمحل ميكانيزم في أرض اللواء – الجيزة خطوة بخطوة: من جامعة الدول ومن الدائري.',
  alternates: { canonical: '/directions' },
};

export default async function Directions() {
  const site = await getSettings();
  const routes = routesOf(site.routes);
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>تجيلنا إزاي</span></nav>
        <h1 className="page-h">🗺️ خريطة: تجيلنا إزاي</h1>
        {site.address && <p style={{ margin: '0 0 4px' }}>📍 {site.address}</p>}
        <div className="dir-acts">
          <a className="btn-g" href={site.mapUrl || MAP_URL} target="_blank" rel="noopener">🧭 افتح الطريق على خرائط جوجل</a>
          <a className="sec" href={waUrl(site, 'السلام عليكم، ممكن اللوكيشن بتاع المحل؟')} target="_blank" rel="noopener">💬 ابعتولي اللوكيشن واتساب</a>
        </div>
        <p className="mut" style={{ margin: '14px 0 8px' }}>جاي منين؟ دوس على طريقك:</p>
        <div className="routes">
          {routes.map((r, i) => (
            <details className="route" key={i} open={routes.length === 1}>
              <summary><h2>🚗 {r.from}</h2></summary>
              <ol>{r.text.split('\n').map(x => x.trim()).filter(Boolean).map((x, k) => <li key={k}>{x}</li>)}</ol>
              {r.note.trim() && <p className="rnote">⚠️ {r.note}</p>}
            </details>
          ))}
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
