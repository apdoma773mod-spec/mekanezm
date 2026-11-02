import './custom.css';
import type { Metadata } from 'next';
import { isKind, KIND } from '@/lib/custom-draw';
import { CustomApp } from './custom-app';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ k?: string }> }): Promise<Metadata> {
  const k = (await searchParams).k;
  const t = isKind(k) ? KIND[k].replace(/^\S+\s/, '') + ' بمقاسك' : 'تجهيز المنتجات بمقاسك';
  return {
    title: `ميكانيزم — ${t}`,
    description: 'جهّز استانلس حماية الباب ودرج البامبو ودلف الدريسنج روم بمقاسك واطلب أونلاين من ميكانيزم',
    alternates: { canonical: isKind(k) ? `/custom?k=${k}` : '/custom' },
    openGraph: { title: `${t} | ميكانيزم`, images: ['/og.jpg'] },
  };
}

const ld = {
  '@context': 'https://schema.org', '@type': 'Service', name: 'تجهيز المنتجات بمقاسك',
  provider: { '@type': 'HardwareStore', name: 'ميكانيزم', address: { '@type': 'PostalAddress', addressLocality: 'أرض اللواء', addressRegion: 'الجيزة', addressCountry: 'EG' } },
  areaServed: 'EG', description: 'استانلس حماية الباب ودرج بامبو ودلف دريسنج روم بمقاسك',
};

export default async function CustomPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const k = (await searchParams).k;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <CustomApp initial={isKind(k) ? k : null} />
    </>
  );
}
