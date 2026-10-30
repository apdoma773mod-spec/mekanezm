import { Categories, Finder, OpenBtn, ProductRow, Recent, ReqHome, Reveal, Reviews, Works, type Slide } from '@/components/home';
import { OpenNow } from '@/components/open-now';
import { Footer, Header, Socials } from '@/components/site-parts';
import { getCatalog, getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { catalogUrl, deliveryFee, FAQ, MAP_URL, productPath, sectionPath, slidesList, waUrl } from '@/lib/shop';

export const revalidate = 300;

const ROW = 12;

export default async function Home() {
  const [{ site: full, ok }, site] = await Promise.all([getCatalog(), getSettings()]);
  const P = full.products;
  const cat = catalogUrl(site);
  const D = site.delivery.filter(x => x.area);
  const top = P.filter(p => p.top);
  const latest = P.slice(-ROW).reverse();
  const rows = site.sections.map(s => ({ s, ps: P.filter(p => p.sec === s.id) })).filter(r => r.ps.length);
  const card = (p: (typeof P)[number]) => ({ p, ok: ok(p) });
  const byId = new Map(P.map(p => [p.img, p.id]));
  const slides: Slide[] = slidesList(full).map(s => ({ ...s, href: s.c && byId.get(s.img) ? productPath(byId.get(s.img)!) : '/search' }));
  const trust = site.trust?.filter(Boolean).length ? site.trust : [
    ...(site.delivery.length ? ['🚚 توصيل'] : []), ...(site.policy.trim() ? ['🔁 استبدال'] : []),
    ...(site.works.length ? ['🏗️ أعمال حقيقية'] : []),
  ];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'HardwareStore', name: site.name, description: site.tagline, telephone: site.phone,
      image: site.logo || undefined, logo: SITE_URL + '/icon-512.png', url: SITE_URL + '/', priceRange: '$$',
      openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '10:00', closes: '23:59' },
      address: site.address ? { '@type': 'PostalAddress', streetAddress: site.address, addressLocality: 'الجيزة', addressCountry: 'EG' } : undefined,
      sameAs: Object.values(site.socials).filter(Boolean),
    },
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: SITE_URL + '/', inLanguage: 'ar',
      potentialAction: { '@type': 'SearchAction', target: SITE_URL + '/search?q={search_term_string}', 'query-input': 'required name=search_term_string' },
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Header site={site} slides={slides} />
      <main id="main">
        <Categories />
        {top.length > 0 && <ProductRow id="top-row" title="⭐ الأكثر طلباً" href="/search?top=1" items={top.slice(0, ROW).map(card)} total={top.length} priority />}
        {rows.map(({ s, ps }, i) => (
          <ProductRow key={s.id} id={'r-' + s.id} title={s.name} href={sectionPath(s.id)} items={ps.slice(0, ROW).map(card)} total={ps.length} priority={!top.length && i === 0} />
        ))}
        {P.length > 0 && <ProductRow id="new-row" title="🆕 وصل حديثاً" href="/search?sort=new" items={latest.map(card)} total={P.length} />}
        <Recent />

        {trust.length > 0 && <div className="trust">{trust.map(t => <span key={t}>{t}</span>)}</div>}
        {cat && <a className="catbtn" href={cat} target="_blank" rel="noopener">📒 شوف كتالوجنا على واتساب</a>}
        <OpenBtn modal={{ kind: 'ship' }} className="homebtn">
          <span className="i">🚚</span><span><b>توصيل القاهرة والجيزة • شحن لكل المحافظات</b><small>اختار طريقة الاستلام وانت بتبعت طلبك</small></span><span className="go">التفاصيل ←</span>
        </OpenBtn>
        <OpenBtn modal={{ kind: 'track' }} className="homebtn trk">
          <span className="i">📦</span><span><b>تتبّع طلبك</b><small>اعرف طلبك وصل لفين برقم موبايلك</small></span>
        </OpenBtn>
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
        <ReqHome />
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
          <div className="mks" style={{ marginTop: 12 }}>
            <div><b data-n={P.length}>{P.length}</b><span>منتج</span></div>
            <div><b data-n={rows.length}>{rows.length}</b><span>قسم</span></div>
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
          <p className="s">أرض اللواء – الجيزة • <OpenNow /></p>
          <div className="mkl">
            <a href={MAP_URL} target="_blank" rel="noopener">🗺️ افتح الموقع على الخريطة</a>
            <a className="g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أسأل عن مكان المحل')}>💬 كلّمنا واتساب</a>
          </div>
          <div className="soc-home" style={{ marginTop: 14 }}><b>تابعنا</b><Socials site={site} /></div>
        </Reveal>
      </main>
      <Footer site={site} />
    </>
  );
}
