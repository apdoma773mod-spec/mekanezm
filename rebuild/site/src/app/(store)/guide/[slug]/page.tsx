import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HandDiagram } from '@/components/hand-guide';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { GUIDES, guideBySlug } from '@/lib/guides';
import { waUrl } from '@/lib/shop';

export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map(g => ({ slug: g.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return { title: `${g.title} | ميكانيزم`, description: g.desc, alternates: { canonical: `/guide/${g.slug}` }, openGraph: { title: g.title, description: g.desc, type: 'article' } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const site = await getSettings();
  const others = GUIDES.filter(x => x.slug !== g.slug);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, inLanguage: 'ar',
    mainEntityOfPage: `${SITE_URL}/guide/${g.slug}`, author: { '@type': 'Organization', name: 'ميكانيزم' }, publisher: { '@type': 'Organization', name: 'ميكانيزم', logo: { '@type': 'ImageObject', url: SITE_URL + '/icon-512.png' } },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main id="main" className="page narrow guide">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/guide">دليل الاختيار</Link><span>›</span><span>{g.emoji}</span></nav>
        <h1 className="page-h">{g.emoji} {g.title}</h1>
        <p className="lead">{g.desc}</p>
        {g.slug === 'left-or-right' && <div className="hd-both"><HandDiagram hand="R" kind="bean" /><HandDiagram hand="L" kind="bean" /></div>}
        {g.blocks.map(b => (
          <section key={b.h}>
            <h2>{b.h}</h2>
            {b.p?.map((x, i) => <p key={i}>{x}</p>)}
            {b.li && <ul>{b.li.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {g.slug === 'left-or-right' && b.h === 'ماجيك كورنر (الكلاسيك)' && <div className="hd-both"><HandDiagram hand="R" kind="magic" /><HandDiagram hand="L" kind="magic" /></div>}
            {g.slug === 'left-or-right' && b.h === 'الضلفة والمفصلات' && <div className="hd-both"><HandDiagram hand="R" kind="door" /><HandDiagram hand="L" kind="door" /></div>}
          </section>
        ))}
        <div className="row">
          <Link className="pri" href={`/search?q=${encodeURIComponent(g.q)}`}>🛒 شوف {g.q} عندنا</Link>
          <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، قريت «${g.title}» ومحتاج مساعدة أختار`)}>💬 اسألنا</a>
        </div>
        <h2>اقرأ كمان</h2>
        <div className="glist">{others.map(x => <Link key={x.slug} href={`/guide/${x.slug}`}><span>{x.emoji}</span><b>{x.title}</b></Link>)}</div>
      </main>
      <Footer site={site} />
    </>
  );
}
