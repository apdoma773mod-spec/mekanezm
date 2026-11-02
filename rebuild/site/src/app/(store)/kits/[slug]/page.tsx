import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/site-parts';
import { getCatalog, getSettings } from '@/lib/catalog';
import { KITS, kitBySlug, matchSlots } from '@/lib/kits';
import { toItem } from '@/lib/shop';
import { KitBuilder } from './kit-builder';

export const revalidate = 60;
export const dynamicParams = false;
export const generateStaticParams = () => KITS.map(k => ({ slug: k.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const k = kitBySlug((await params).slug);
  return k ? { title: `${k.title} — طقم إكسسوارات كامل | ميكانيزم`, description: k.desc, alternates: { canonical: `/kits/${k.slug}` } } : {};
}

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const k = kitBySlug((await params).slug);
  if (!k) notFound();
  const [site, { site: full, ok }] = await Promise.all([getSettings(), getCatalog()]);
  const m = matchSlots(k, full.products, ok);
  const picks = Object.fromEntries(Object.entries(m).map(([s, p]) => [s, p ? toItem(p, ok(p)) : null]));
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/kits">الأطقم</Link><span>›</span><span>{k.title}</span></nav>
        <h1 className="page-h">{k.emoji} {k.title}</h1>
        <p className="mut">{k.desc}</p>
        <KitBuilder slug={k.slug} picks={picks} />
        <p className="mut" style={{ marginTop: 16 }}>محتاج تحسب مقاس؟ <Link href="/tools">الحاسبات</Link> · <Link href="/guide">دليل الاختيار</Link></p>
      </main>
      <Footer site={site} />
    </>
  );
}
