import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductView } from '@/components/product-view';
import { Recent } from '@/components/home';
import { getProduct, getSite } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { brandOf } from '@/lib/brands';
import { worksUsing } from '@/lib/works';
import { complements, parseSpecs, images, productPath, sectionOf, sectionPath, toItem } from '@/lib/shop';

export const revalidate = 60;

export async function generateStaticParams() {
  const site = await getSite();
  return site.products.map(p => ({ id: p.id }));
}

const abs = (u: string) => (/^https?:/.test(u) ? u : SITE_URL + u);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = await getProduct((await params).id);
  if (!r) return {};
  const { site, product: p } = r;
  const sec = sectionOf(site, p);
  const d = p.desc.replace(/\s+/g, ' ').slice(0, 155) || `${sec?.name ? sec.name + ' — ' : ''}${site.name}`;
  const im = images(p)[0];
  return {
    title: `${p.name} | ميكانيزم`,
    description: d,
    alternates: { canonical: productPath(p.id) },
    openGraph: { title: p.name, description: d, type: 'website', url: productPath(p.id), images: im ? [{ url: abs(im) }] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const r = await getProduct((await params).id);
  if (!r) notFound();
  const { site, product: p, ok } = r;
  const sim = site.products.filter(x => x.sec === p.sec && x.id !== p.id).slice(0, 12).map(x => toItem(x, ok(x)));
  const sec = sectionOf(site, p);
  const comp = complements(site.products, site.sections, p, ok).map(x => toItem(x, ok(x)));
  const same = site.products.filter(x => x.sec === p.sec), k = same.findIndex(x => x.id === p.id);
  const prev = k > 0 ? toItem(same[k - 1], ok(same[k - 1])) : undefined;
  const next = k >= 0 && k < same.length - 1 ? toItem(same[k + 1], ok(same[k + 1])) : undefined;
  const brand = brandOf(p);
  const works = worksUsing(site, p).map(w => ({ i: w.i, title: w.title, img: w.imgs[0] }));
  const instRow = parseSpecs(p.desc).rows.find(([k, v]) => /تركيب/.test(k) && /^https?:\/\//.test(v));
  const install = instRow ? { href: instRow[1], ext: true } : /مفصل/.test(p.name) ? { href: '/guide/install-hinge', ext: false } : /مجر|مجرى|مجري/.test(p.name) ? { href: '/guide/install-slides', ext: false } : undefined;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: (p.desc || p.name).slice(0, 300), sku: p.code || p.id,
      image: images(p).slice(0, 4).map(abs), category: sec?.name, brand: { '@type': 'Brand', name: brand?.name ?? 'ميكانيزم' },
      offers: {
        '@type': 'Offer', url: SITE_URL + productPath(p.id), priceCurrency: 'EGP',
        availability: ok(p) ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
        seller: { '@type': 'Organization', name: 'ميكانيزم' },
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: sec?.name || 'المنتجات', item: sec ? SITE_URL + sectionPath(sec.id) : SITE_URL + '/search' },
        { '@type': 'ListItem', position: 3, name: p.name, item: SITE_URL + productPath(p.id) },
      ],
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <ProductView p={p} ok={ok(p)} sim={sim} comp={comp} prev={prev} next={next} brand={brand ? { slug: brand.slug, name: brand.name } : undefined} works={works} install={install} />
      <Recent exclude={p.id} />
    </>
  );
}
