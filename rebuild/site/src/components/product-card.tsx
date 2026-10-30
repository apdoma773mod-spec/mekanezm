'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { askPriceText, images, productPath, sectionOf, toItem, waUrl } from '@/lib/shop';
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

export function ProductCard({ p, ok, priority }: { p: Product; ok: boolean; priority?: boolean }) {
  const { site, fav, toggleFav, add, open } = useShop();
  const img = images(p)[0];
  const sec = sectionOf(site, p);
  const item = toItem(p, ok);
  const addIt = () => { add(item); evProduct('add_to_cart', 'AddToCart', p); };
  return (
    <div className="card">
      <div className="imw">
        {img ? <Image src={img} alt={p.name} fill sizes="(max-width:720px) 46vw, 240px" priority={priority} /> : <Placeholder section={sec?.name} />}
        <span className={'avb' + (ok ? '' : ' no')}>{ok ? 'متوفر' : 'بالحجز'}</span>
        <button className={'hrt' + (fav[p.id] ? ' on' : '')} onClick={() => toggleFav(item)} aria-label="المفضلة" aria-pressed={!!fav[p.id]}>♥</button>
      </div>
      <h3><Link href={productPath(p.id)}>{p.name}</Link></h3>
      {p.desc && <p>{p.desc}</p>}
      <a className="ask" target="_blank" rel="noopener" href={waUrl(site, askPriceText(p))}>💬 اسأل عن السعر</a>
      {ok ? (
        <button className="add" onClick={addIt}>➕ أضف للطلب</button>
      ) : (
        <>
          <button className="add bo" onClick={addIt}>📦 اطلبه بالحجز</button>
          <button className="nm" onClick={() => open({ kind: 'notify', item })}>🔔 نبّهني لما يتوفر</button>
        </>
      )}
    </div>
  );
}

/** Small card from a snapshot (favorites, recently viewed). */
export function ItemCard({ it }: { it: { id: string; name: string; img: string } }) {
  return (
    <Link className="mini" href={productPath(it.id)}>
      <span className="im framed">{it.img && <Image src={it.img} alt="" fill sizes="140px" style={{ objectFit: 'contain' }} />}</span>
      <span>{it.name}</span>
    </Link>
  );
}
