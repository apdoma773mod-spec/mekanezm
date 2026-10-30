'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { askPriceText, images, productPath, sectionOf, waUrl } from '@/lib/shop';
import { evProduct } from '@/lib/track';
import { useShop } from './shop-provider';

// Placeholder colors/emoji per section name, for products without a photo.
const PH: [RegExp, string, string, string][] = [
  [/دلف|ألمني|المني|المونيوم/, '🗄️', '#5b7c99', '#2f4b66'], [/مقبض|يد|مقابض/, '🚪', '#c0883b', '#7a4e17'],
  [/مفصل|مفصلات|هنج/, '🔩', '#6b7280', '#374151'], [/مسطر|سلة|سلك|رف|شبك/, '🧺', '#3d8f8f', '#1e5656'],
  [/درج|ادراج|أدراج|بامبو|مجرى|ريل/, '🗃️', '#a0764a', '#5e3f1d'], [/مطبخ|دريسنج|غرف/, '🍽️', '#c26a4a', '#7a3320'],
];
const ph = (name = '') => PH.find(k => k[0].test(name)) ?? [null, '🔧', '#4a7c8c', '#2c4f5e'];

export function Placeholder({ section }: { section?: string }) {
  const k = ph(section);
  return <div className="ph" style={{ ['--g1' as string]: k[2], ['--g2' as string]: k[3] }}>{k[1]}<small>الصورة قريباً</small></div>;
}

export function ProductCard({ p, priority }: { p: Product; priority?: boolean }) {
  const { site, ok: isOk, fav, toggleFav, add, open } = useShop();
  const ok = isOk(p);
  const img = images(p)[0];
  const addIt = () => { add(p.id); evProduct('add_to_cart', 'AddToCart', p); };
  const sec = sectionOf(site, p);
  return (
    <div className="card">
      <div className="imw">
        {img ? <Image src={img} alt={p.name} fill sizes="(max-width:720px) 50vw, 240px" priority={priority} /> : <Placeholder section={sec?.name} />}
        <span className={'avb' + (ok ? '' : ' no')}>{ok ? 'متوفر' : 'بالحجز'}</span>
        <button className={'hrt' + (fav.has(p.id) ? ' on' : '')} onClick={() => toggleFav(p.id)} aria-label="المفضلة" aria-pressed={fav.has(p.id)}>♥</button>
      </div>
      <h3><Link href={productPath(p.id)}>{p.name}</Link></h3>
      {p.desc && <p>{p.desc}</p>}
      <a className="ask" target="_blank" rel="noopener" href={waUrl(site, askPriceText(p))}>💬 اسأل عن السعر</a>
      {ok ? (
        <button className="add" onClick={addIt}>➕ أضف للطلب</button>
      ) : (
        <>
          <button className="add bo" onClick={addIt}>📦 اطلبه بالحجز</button>
          <button className="nm" onClick={() => open({ kind: 'notify', id: p.id })}>🔔 نبّهني لما يتوفر</button>
        </>
      )}
    </div>
  );
}
