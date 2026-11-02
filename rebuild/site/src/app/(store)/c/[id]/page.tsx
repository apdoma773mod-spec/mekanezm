import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Categories, OpenBtn, Recent } from '@/components/home';
import { Listing, type ListParams } from '@/components/listing';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings, listProducts, PAGE } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import type { Sort } from '@/lib/shop';
import { images, productPath, sectionPath, specFilters, topTerms } from '@/lib/shop';

export const revalidate = 60;

export async function generateStaticParams() {
  const s = await getSettings();
  return s.sections.filter(x => s.counts[x.id]).map(x => ({ id: x.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = (await params).id;
  const s = await getSettings();
  const sec = s.sections.find(x => x.id === id);
  if (!sec) return {};
  const d = `${sec.name} من ميكانيزم — ${s.counts[id] ?? 0} منتج. ${s.tagline}. اطلب أونلاين أو على الواتساب، توصيل وشحن لكل المحافظات.`;
  // Share preview: the section's first product photo (falls back to the shop image).
  const { site } = await getCatalog();
  const img = site.products.filter(p => p.sec === id).map(p => images(p).find(u => /^https?:/.test(u))).find(Boolean);
  return { title: `${sec.name} | ميكانيزم`, description: d, alternates: { canonical: sectionPath(id) }, openGraph: { title: `${sec.name} | ميكانيزم`, description: d, images: [img || '/og.jpg'] } };
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ListParams> }) {
  const id = (await params).id;
  const sp = await searchParams;
  const site = await getSettings();
  const sec = site.sections.find(x => x.id === id);
  if (!sec || !site.counts[id]) notFound();
  const q = (sp.q ?? '').slice(0, 40);
  const f = (sp.f ?? '').slice(0, 80);
  const { total, items } = await listProducts({ sec: id, q, f, sort: (sp.sort ?? '') as Sort, av: !!sp.av, page: Number(sp.page) || 1 });
  const { site: full } = await getCatalog();
  const inSec = full.products.filter(p => p.sec === id);
  const terms = topTerms(inSec);
  const specs = specFilters(inSec);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: sec.name, url: SITE_URL + sectionPath(id),
      mainEntity: { '@type': 'ItemList', numberOfItems: total, itemListElement: items.slice(0, PAGE).map(({ p }, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + productPath(p.id), name: p.name })) },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: sec.name, item: SITE_URL + sectionPath(id) },
      ],
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main id="main" className="page">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>{sec.name}</span></nav>
        <h1 className="page-h">{sec.name}</h1>
        <Listing base={sectionPath(id)} params={{ ...sp, q, f }} total={total} items={items} terms={terms} specs={specs}
          empty={<div className="empty"><p>مفيش منتجات متوفرة دلوقتي في القسم ده.</p><Link className="btn-wa" href={sectionPath(id)}>شوف كل منتجات القسم</Link></div>} />
        <div style={{ marginTop: 18 }}>
          <OpenBtn modal={{ kind: 'req' }} className="reqbtn">📷 مش لاقي اللي بتدوّر عليه؟<small>صوّر المنتج وابعتهولنا — هنرد عليك ونقولك نوفّره إمتى</small></OpenBtn>
        </div>
      </main>
      <Categories current={id} />
      <Recent />
      <Footer site={site} />
    </>
  );
}
