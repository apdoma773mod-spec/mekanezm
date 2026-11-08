import { Categories, Finder, Recent, ReqHome, Reveal, Reviews, Works, type Slide } from '@/components/home';
import { HeroDeck, Services } from '@/components/hero-deck';
import { ProductCard } from '@/components/product-card';
import { OpenNow } from '@/components/open-now';
import { Subscribe } from '@/components/subscribe';
import { Footer, Header, Socials } from '@/components/site-parts';
import Link from 'next/link';
import { getCatalog, getSettings } from '@/lib/catalog';
import { GUIDES } from '@/lib/guides';
import { SITE_URL } from '@/lib/config';
import { catalogUrl, deliveryFee, FAQ, MAP_URL, productPath, slidesList, waUrl } from '@/lib/shop';

export const revalidate = 60;

const ROW = 12;

export default async function Home() {
  const [{ site: full, ok, fresh }, site] = await Promise.all([getCatalog(), getSettings()]);
  const P = full.products;
  const cat = catalogUrl(site);
  const D = site.delivery.filter(x => x.area);
  const top = P.filter(p => p.top);
  const latest = P.slice(-ROW).reverse();
  const rows = site.sections.map(s => ({ s, ps: P.filter(p => p.sec === s.id) })).filter(r => r.ps.length);
  const byId = new Map(P.map(p => [p.img, p.id]));
  const slides: Slide[] = slidesList(full).map(s => ({ ...s, href: s.c && byId.get(s.img) ? productPath(byId.get(s.img)!) : '/search' }));
  const shown = [...top, ...latest.filter(p => !p.top), ...P.filter(p => !p.top && !latest.includes(p))].slice(0, 12);
  const best = [...top, ...latest.filter(p => !p.top)].slice(0, 8).map(p => ({ p, ok: ok(p) }));
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
      <Header site={site}><HeroDeck best={best} photos={slides} /></Header>
      <main id="main">
        <Categories />
        <section className="blk" id="prods">
          <div className="sh"><h2>المنتجات</h2></div>
          <div className="grid">{shown.map((p, k) => <ProductCard key={p.id} p={p} ok={ok(p)} fresh={fresh(p)} priority={k < 2} />)}</div>
          {P.length > shown.length && <Link className="more" href="/search">شوف كل المنتجات ({P.length}) ←</Link>}
        </section>
        <Recent />
        <Services waCatalog={cat || undefined} />
        <Finder />
        <ReqHome />
        <Works />
        <section className="mkp" aria-labelledby="gd-h">
          <h2 id="gd-h">📘 قبل ما تشتري: دليل الاختيار</h2>
          <div className="glist">{GUIDES.map(g => <Link key={g.slug} href={`/guide/${g.slug}`}><span>{g.emoji}</span><b>{g.title}</b></Link>)}</div>
        </section>
        <Subscribe />
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
