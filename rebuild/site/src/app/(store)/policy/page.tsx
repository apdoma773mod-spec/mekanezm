import type { Metadata } from 'next';
import Link from 'next/link';
import { PayInfo } from '@/components/modals';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { deliveryFee, FAQ, shipBits, waUrl } from '@/lib/shop';

export const metadata: Metadata = {
  title: 'التوصيل والاستبدال وطريقة الطلب | ميكانيزم',
  description: 'إزاي تطلب من ميكانيزم، التوصيل للقاهرة والجيزة والشحن لكل المحافظات، والاستلام من المحل، وسياسة الاستبدال.',
  alternates: { canonical: '/policy' },
};

export default async function Policy() {
  const site = await getSettings();
  const L = site.shipLocal ?? {}, G = site.shipGov ?? {};
  const D = site.delivery.filter(x => x.area);
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>التوصيل والاستبدال</span></nav>
        <h1 className="page-h">🚚 التوصيل والاستبدال</h1>
        <div className="info-cards">
          <div>
            <h2>🛒 إزاي تطلب؟</h2>
            <ol style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>اختار المنتج واضغط «أضف للطلب» (أو «اطلب على الواتساب»).</li>
              <li>افتح السلة، اكتب اسمك ورقمك واختار هتستلم إزاي.</li>
              <li>هنكلمك على الواتساب نأكد السعر والميعاد.</li>
            </ol>
          </div>
          <div><h2>🛵 توصيل داخل القاهرة والجيزة</h2>{L.note || 'مندوب بيوصّلك الطلب لحد باب البيت'}{shipBits(L) && <div>{shipBits(L)}</div>}</div>
          <div><h2>📦 شحن لأي محافظة</h2>{G.note || 'بنشحن لكل محافظات مصر مع شركات الشحن'}{shipBits(G) && <div>{shipBits(G)}</div>}</div>
          <div><h2>💳 طرق الدفع</h2><PayInfo method="pickup" /><PayInfo method="ship" /></div>
          <div><h2>🏪 استلام من المحل</h2>{site.address}{site.hours && <div>🕒 {site.hours}</div>}</div>
          {(site.deliveryNote.trim() || D.length > 0) && (
            <div>
              <h2>⏱️ مواعيد ومصاريف التوصيل</h2>
              {site.deliveryNote.trim() && <p style={{ margin: 0 }}>{site.deliveryNote}</p>}
              {D.length > 0 && <table style={{ width: '100%' }}><tbody>{D.map((x, i) => <tr key={i}><td><b>{x.area}</b></td><td>{deliveryFee(x.fee)}</td><td className="mut">{x.days}</td></tr>)}</tbody></table>}
            </div>
          )}
          <div>
            <h2>🔁 الاستبدال والاسترجاع</h2>
            {site.policy.trim()
              ? <div style={{ whiteSpace: 'pre-line' }}>{site.policy}</div>
              : <p style={{ margin: 0 }}>لو في أي مشكلة في المنتج كلّمنا على الواتساب وهنحلّها معاك.</p>}
            <a target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عندي سؤال عن الاستبدال')}>💬 اسأل على الواتساب</a>
          </div>
          <div className="mkf"><h2>❓ أسئلة شائعة</h2>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
