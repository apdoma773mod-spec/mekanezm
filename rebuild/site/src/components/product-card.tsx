'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/schema';
import { images, productPath, sectionOf, toItem } from '@/lib/shop';
import loader from '@/lib/image-loader';
import { evProduct } from '@/lib/track';
import { useShop } from './shop-provider';

// Placeholder colors/emoji per section name, for products without a photo.
const PH: [RegExp, string, string, string][] = [
  [/دلف|ألمني|المني|المونيوم/, '🗄️', '#5b7c99', '#2f4b66'], [/مقبض|يد|مقابض/, '🚪', '#c0883b', '#7a4e17'],
  [/مفصل|مفصلات|هنج/, '🔩', '#6b7280', '#374151'], [/مسطر|سلة|سلك|رف|شبك/, '🧺', '#3d8f8f', '#1e5656'],
  [/درج|ادراج|أدراج|بامبو|مجرى|ريل/, '🗃️', '#a0764a', '#5e3f1d'], [/مطبخ|دريسنج|غرف/, '🍽️', '#c26a4a', '#7a3320'],
];
/** Tiny blurred version shown instantly while the real photo loads (only for CDN photos). */
export const lqip = (src?: string) => (src && /^https?:/.test(src) ? { ['--lq' as string]: `url(${loader({ src, width: 24, quality: 30 })})` } : undefined);

const ph = (name = '') => PH.find(k => k[0].test(name)) ?? [null, '🔧', '#4a7c8c', '#2c4f5e'];

export function Placeholder({ section }: { section?: string }) {
  const k = ph(section);
  return <div className="ph" style={{ ['--g1' as string]: k[2], ['--g2' as string]: k[3] }}>{k[1]}<small>الصورة قريباً</small></div>;
}

export function ProductCard({ p, ok, priority, fresh }: { p: Product; ok: boolean; priority?: boolean; fresh?: boolean }) {
  const { site, fav, toggleFav, add, open, cart, setQty } = useShop();
  const n = cart[p.id]?.q ?? 0;
  const img = images(p)[0];
  const sec = sectionOf(site, p);
  const item = toItem(p, ok);
  const addIt = () => { add(item); evProduct('add_to_cart', 'AddToCart', p); };
  return (
    <div className="card">
      <div className="imw lq" style={lqip(img)}>
        {img ? <Image src={img} alt={p.name} fill sizes="(max-width:760px) 40vw, 200px" priority={priority} /> : <Placeholder section={sec?.name} />}
        <button className={'hrt' + (fav[p.id] ? ' on' : '')} onClick={() => toggleFav(item)} aria-label="المفضلة" aria-pressed={!!fav[p.id]}>♥</button>
      </div>
      <div className="cb">
        <div className="cmeta">
          {p.code && <span className="code">كود {p.code}</span>}
          {sec && <span className="csec">{sec.name}</span>}
          {p.video && <span className="vidc">🎬 فيديو</span>}
          {fresh && <span className="newc">جديد</span>}
        </div>
        <h3><Link href={productPath(p.id)}>{p.name}</Link></h3>
        <div className="cst">
          <span className={'av' + (ok ? '' : ' no')}>{ok ? 'متوفر' : 'بالحجز'}</span>
          {!ok && <button type="button" className="bellt" onClick={() => open({ kind: 'notify', item })}>🔔 نبّهني</button>}
        </div>
        <div className="cf">
          {n > 0 ? (
            <div className="cstep" role="group" aria-label="الكمية في طلبك">
              <button onClick={() => setQty(p.id, n + 1)} aria-label="زيادة">+</button>
              <b>{n} في طلبك</b>
              <button onClick={() => setQty(p.id, n - 1)} aria-label="نقص">−</button>
            </div>
          ) : <>
            <button type="button" className="ask" onClick={() => open({ kind: 'price', lines: [{ item, q: 1 }] })}>اسأل عن السعر</button>
            <button className={'add' + (ok ? '' : ' bo')} onClick={addIt}>{ok ? 'أضف للطلب' : 'اطلبه بالحجز'}</button>
          </>}
        </div>
      </div>
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
