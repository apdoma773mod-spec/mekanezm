import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/config';
import { KINDS, SKILL_NAME, proPath } from '@/lib/pros';
import { WorkGallery } from '../../works/work-gallery';
import { ProNote } from '../pro-card';
import { ProContact } from '../pro-contact';

export const revalidate = 60;
type Ctx = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { id } = await params;
  const p = (await getSettings()).pros.find(x => x.id === decodeURIComponent(id));
  if (!p) return {};
  const title = `${p.name} — ${KINDS[p.kind] ?? 'فني'} مرشّح من ميكانيزم`;
  return { title, description: `${p.name}: ${p.skills.map(s => SKILL_NAME[s]).filter(Boolean).join('، ')}. ${p.bio}`.slice(0, 200), alternates: { canonical: proPath(p.id) }, openGraph: { title, images: (p.photo || p.imgs[0]) ? [p.photo || p.imgs[0]] : undefined } };
}

export default async function ProPage({ params }: Ctx) {
  const { id } = await params;
  const site = await getSettings();
  const p = site.pros.find(x => x.id === decodeURIComponent(id));
  if (!p) notFound();
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: KINDS[p.kind] ?? 'فني',
    description: p.bio || undefined, image: p.photo || p.imgs[0] || undefined, url: SITE_URL + proPath(p.id),
    areaServed: p.areas, knowsAbout: p.skills.map(s => SKILL_NAME[s]).filter(Boolean),
  };
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><Link href="/pros">فنيين نرشّحهم</Link><span>›</span><span>{p.name}</span></nav>
        <header className="pro-top">
          <span className="pro-ph big">{(p.photo || p.imgs[0]) ? <Image src={p.photo || p.imgs[0]} alt={p.name} fill sizes="96px" style={{ objectFit: 'cover' }} priority /> : '🧰'}</span>
          <div>
            <h1 className="page-h" style={{ margin: 0 }}>{p.name}</h1>
            <p className="mut" style={{ margin: '2px 0 0' }}>{KINDS[p.kind] ?? 'فني'}{p.years ? ` · خبرة ${p.years} سنة` : ''}</p>
            {p.checked && <span className="pro-ok">✔ راجعنا شغله · {p.checked}</span>}
          </div>
        </header>
        <ProContact id={p.id} name={p.name} phone={p.phone} />
        <div className="info-cards" style={{ marginTop: 12 }}>
          {p.bio && <div><h2>نبذة</h2><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.bio}</p></div>}
          <div>
            <h2>بيعمل إيه؟</h2>
            <div className="pro-sk">{p.skills.map(s => <span key={s}>{SKILL_NAME[s] ?? s}</span>)}</div>
            {p.areas.length > 0 && <p style={{ margin: '8px 0 0' }}>📍 المناطق: {p.areas.join('، ')}</p>}
            {p.link && /^https?:\/\//.test(p.link) && <p style={{ margin: '4px 0 0' }}><a href={p.link} target="_blank" rel="noopener nofollow">🔗 صفحته وأعماله أونلاين</a></p>}
          </div>
          {p.imgs.length > 0 && <div><h2>🏗️ من شغله</h2><WorkGallery imgs={p.imgs} title={p.name} /></div>}
        </div>
        <ProNote />
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Footer site={site} />
    </>
  );
}
