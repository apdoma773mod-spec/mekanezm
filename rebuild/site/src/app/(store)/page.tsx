import { Catalog, Categories, Featured, Finder, OpenBtn, ReqHome, Reveal, Reviews, Works } from '@/components/home';
import { ProductCard } from '@/components/product-card';
import { Footer, Header, Socials } from '@/components/site-parts';
import { getSite } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { catalogUrl, deliveryFee, FAQ, MAP_URL, waUrl } from '@/lib/shop';

export const revalidate = 300;

export default async function Home() {
  const site = await getSite();
  const cat = catalogUrl(site);
  const latest = site.products.slice(-8).reverse();
  const D = site.delivery.filter(x => x.area);
  const trust = site.trust?.filter(Boolean).length ? site.trust : [
    ...(site.delivery.length ? ['🚚 توصيل'] : []), ...(site.policy.trim() ? ['🔁 استبدال'] : []),
    ...(site.works.length ? ['🏗️ أعمال حقيقية'] : []),
  ];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'HardwareStore', name: site.name, description: site.tagline, telephone: site.phone,
      image: site.logo || undefined, url: SITE_URL,
      address: site.address ? { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'EG' } : undefined,
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Header site={site} />
      <main id="main">
        {trust.length > 0 && <div className="trust">{trust.map(t => <span key={t}>{t}</span>)}</div>}
        {cat && <a className="catbtn" href={cat} target="_blank" rel="noopener">📒 شوف كتالوجنا على واتساب</a>}
        <OpenBtn modal={{ kind: 'ship' }} className="homebtn">
          <span className="i">🚚</span><span><b>توصيل القاهرة والجيزة • شحن لكل المحافظات</b><small>اختار طريقة الاستلام وانت بتبعت طلبك</small></span><span className="go">التفاصيل ←</span>
        </OpenBtn>
        <OpenBtn modal={{ kind: 'track' }} className="homebtn trk">
          <span className="i">📦</span><span><b>تتبّع طلبك</b><small>اعرف طلبك وصل لفين برقم موبايلك</small></span>
        </OpenBtn>
        <div className="soc-home"><b>تابعنا</b><Socials site={site} /></div>
        <Featured />
        <div className="mkhow">
          <div><b>🛒</b><span>اختار</span><small>ضيف للطلب</small></div>
          <div><b>💬</b><span>أكّد</span><small>على الواتساب</small></div>
          <div><b>🚚</b><span>استلم</span><small>توصيل أو من المحل</small></div>
        </div>
        <a className="cust" href="/custom">
          <i>🛠️</i>
          <div><b>تجهيز المنتجات بمقاسك</b><span>استانلس حماية الباب • درج بامبو • دلف دريسنج روم — اكتب المقاسات واشوف الرسمة واطلب</span></div>
        </a>
        <Finder />
        <Categories />
        <ReqHome />
        {latest.length > 0 && (
          <section className="blk">
            <div className="sh"><h2>أحدث المنتجات</h2></div>
            <div className="grid">{latest.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}</div>
          </section>
        )}
        <Catalog />
        <Works />
        {(D.length > 0 || site.policy.trim() || site.deliveryNote.trim()) && (
          <section className="blk" id="info">
            <div className="sh"><h2>🚚 التوصيل والاستبدال</h2></div>
            <div className="infobox">
              {site.deliveryNote.trim() && <div>{site.deliveryNote}</div>}
              {D.length > 0 && <table><tbody>{D.map((x, i) => <tr key={i}><td><b>{x.area}</b></td><td>{deliveryFee(x.fee)}</td><td className="mut">{x.days}</td></tr>)}</tbody></table>}
              {site.policy.trim() && <div style={{ marginTop: 8 }}><b>🔁 سياسة الاستبدال والاسترجاع</b><div style={{ whiteSpace: 'pre-line', fontSize: 14 }}>{site.policy}</div></div>}
            </div>
          </section>
        )}
        <Reveal className="mkp" id="mkWhy" label="ليه ميكانيزم؟">
          <h2>ليه ميكانيزم؟</h2>
          <p className="s">إكسسوارات مطابخ ودريسنج روم بجودة نثق فيها</p>
          <div className="mkw">
            <div><i>🏅</i><b>أصناف مختارة</b><span>إكسسوارات مطابخ ودريسنج روم بخامات قوية</span></div>
            <div><i>💬</i><b>رد سريع</b><span>بنرد على الواتساب ونحدد السعر والتوفر</span></div>
            <div><i>🚚</i><b>توصيل وشحن</b><span>القاهرة والجيزة وكل المحافظات</span></div>
            <div><i>🧰</i><b>مساعدة في الاختيار</b><span>نساعدك تختار المقاس والنوع المناسب</span></div>
          </div>
        </Reveal>
        <Reveal className="mkp" label="أرقام">
          <div className="mks">
            <div><b data-n={site.products.length}>{site.products.length}</b><span>منتج</span></div>
            <div><b data-n={site.sections.length}>{site.sections.length}</b><span>قسم</span></div>
            <div><b>📲</b><span>اطلب من موبايلك</span></div>
          </div>
        </Reveal>
        <Reviews />
        <Reveal className="mkp mkf" id="mkFaq" label="أسئلة شائعة">
          <h2>أسئلة شائعة</h2>
          <p className="s">إجابات سريعة قبل ما تطلب</p>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </Reveal>
        <Reveal className="mkp" id="mkLoc" label="تعالى زورنا">
          <h2>📍 تعالى زورنا</h2>
          <p className="s">أرض اللواء – الجيزة</p>
          <div className="mkl">
            <a href={MAP_URL} target="_blank" rel="noopener">🗺️ افتح الموقع على الخريطة</a>
            <a className="g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أسأل عن مكان المحل')}>💬 كلّمنا واتساب</a>
          </div>
        </Reveal>
      </main>
      <Footer site={site} />
    </>
  );
}
