'use client';
// Home page: the sliding deck at the top (best sellers + what the site can do + the owner's banners)
// and one tidy grid of service tiles, all the same size.
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Product } from '@/lib/schema';
import { images, productPath, toItem } from '@/lib/shop';
import { evProduct } from '@/lib/track';
import { useCatalog } from './catalog-link';
import { Placeholder } from './product-card';
import { useShop, type Modal } from './shop-provider';
import type { Slide } from './home';

type P = { p: Product; ok: boolean };
type Feat = { ic: string; t: string; s: string; href?: string; modal?: Modal; btn: string; tone: string; needsCatalog?: boolean };

const FEATS: Feat[] = [
  { ic: '♻️', t: 'سوق فضلة النجارين', s: 'دوّر على حتة خشب أو ألمونيوم بمقاسك، أو اعرض فضلتك في دقيقة — صوّر المتر والمقاس يتكتب لوحده.', href: '/scraps', btn: 'افتح فضلة', tone: 'g' },
  { ic: '🛠️', t: 'تجهيز المنتجات بمقاسك', s: 'استانلس حماية الباب، درج بامبو، دلف دريسنج روم — اكتب المقاس وشوف الرسمة واطلب.', href: '/custom', btn: 'جهّز بمقاسك', tone: 'b' },
  { ic: '📖', t: 'كتالوج ميكانيزم', s: 'قلّب كل المنتجات زي الكتاب، وحمّله أو اطبعه.', href: '/catalog', btn: 'افتح الكتالوج', tone: 'o', needsCatalog: true },
  { ic: '🧰', t: 'أطقم جاهزة', s: 'كل اللي يلزم مطبخك أو دولابك في طقم واحد، من غير ما تدوّخ.', href: '/kits', btn: 'شوف الأطقم', tone: 'p' },
  { ic: '🧮', t: 'حاسبات النجار', s: 'احسب الدراع القلاب والمفصلات والمجرى المناسب بالمقاس.', href: '/tools', btn: 'افتح الحاسبات', tone: 'b' },
  { ic: '🛒', t: 'تطلب إزاي؟', s: 'اختار المنتج ← أكّد على الواتساب ← استلم توصيل أو من المحل. وتقدر تتابع طلبك برقم موبايلك.', modal: { kind: 'track' }, btn: '📦 تتبّع طلبك', tone: 'o' },
];

type Card = { kind: 'best'; items: P[] } | { kind: 'feat'; f: Feat } | { kind: 'photo'; s: Slide };

function Mini({ p, ok, load }: P & { load: boolean }) {
  const { add } = useShop();
  const img = images(p)[0];
  return (
    <div className="hd-mini">
      <Link href={productPath(p.id)} className="hd-mi">
        {img ? (load && <Image src={img} alt={p.name} fill sizes="45vw" />) : <Placeholder />}
      </Link>
      <Link href={productPath(p.id)} className="hd-mn">{p.name}</Link>
      <div className="hd-mf">
        <span className={'hd-av' + (ok ? '' : ' no')}>{ok ? 'متوفر' : 'بالحجز'}</span>
        <button type="button" onClick={() => { add(toItem(p, ok)); evProduct('add_to_cart', 'AddToCart', p); }} aria-label={'أضف ' + p.name}>＋ أضف</button>
      </div>
    </div>
  );
}

export function HeroDeck({ best, photos }: { best: P[]; photos: Slide[] }) {
  const { open } = useShop();
  const hasCat = useCatalog();
  const pairs: P[][] = [];
  for (let k = 0; k < Math.min(best.length, 6); k += 2) pairs.push(best.slice(k, k + 2));
  const feats = FEATS.filter(f => !f.needsCatalog || hasCat);
  const ph = photos.slice(0, 3);
  // Round robin: best sellers, a feature, a banner, …
  const L: Card[] = [];
  for (let k = 0; k < Math.max(pairs.length, feats.length, ph.length); k++) {
    if (pairs[k]) L.push({ kind: 'best', items: pairs[k] });
    if (feats[k]) L.push({ kind: 'feat', f: feats[k] });
    if (ph[k]) L.push({ kind: 'photo', s: ph[k] });
  }
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const [seen, setSeen] = useState(1);
  const x0 = useRef(0);
  useEffect(() => { setSeen(v => Math.max(v, i + 2)); }, [i]);
  useEffect(() => {
    if (L.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % L.length), 5500);
    return () => clearInterval(t);
  }, [L.length, tick]);
  if (!L.length) return null;
  const go = (n: number) => { setI((n + L.length) % L.length); setTick(t => t + 1); };
  const cur = Math.min(i, L.length - 1);
  return (
    <section className="hd" aria-roledescription="carousel" aria-label="أهم حاجات ميكانيزم">
      <div className="hd-vw" onTouchStart={e => { x0.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const d = e.changedTouches[0].clientX - x0.current; if (Math.abs(d) > 40) go(cur + (d < 0 ? 1 : -1)); }}>
        <div className="hd-trk" style={{ transform: `translateX(${-cur * 100}%)` }}>
          {L.map((c, k) => {
            const on = k === cur, load = k < seen;
            const tab = on ? 0 : -1;
            let body: ReactNode;
            if (c.kind === 'best') body = (
              <div className="hd-card t-best">
                <span className="hd-tag">⭐ اختيارات مميزة</span>
                <p className="hd-h">تسوق الأكثر مبيعًا</p>
                <p className="hd-s">أكتر حاجات النجارين بيطلبوها مننا.</p>
                <Link className="hd-btn" href="/search?top=1" tabIndex={tab}>تسوق الآن ←</Link>
                <div className="hd-pair">{c.items.map(x => <Mini key={x.p.id} {...x} load={load} />)}</div>
              </div>
            );
            else if (c.kind === 'feat') body = (
              <div className={'hd-card t-' + c.f.tone}>
                <span className="hd-tag">✨ من خدمات ميكانيزم</span>
                <span className="hd-ic" aria-hidden="true">{c.f.ic}</span>
                <p className="hd-h">{c.f.t}</p>
                <p className="hd-s">{c.f.s}</p>
                {c.f.href
                  ? <Link className="hd-btn" href={c.f.href} tabIndex={tab}>{c.f.btn} ←</Link>
                  : <button type="button" className="hd-btn" tabIndex={tab} onClick={() => c.f.modal && open(c.f.modal)}>{c.f.btn}</button>}
              </div>
            );
            else body = (
              <div className="hd-card t-photo">
                {load && <Image className="bg" src={c.s.img} alt="" fill sizes="(max-width:1100px) 100vw, 1100px" priority={k === 0} />}
                <div className="hd-ph">
                  <p className="hd-h">{c.s.t}</p>
                  {c.s.s && <p className="hd-s">{c.s.s}</p>}
                  <Link className="hd-btn" href={c.s.href} tabIndex={tab}>{c.s.c ? 'اطلب الآن' : 'تصفح المنتجات'} ←</Link>
                </div>
              </div>
            );
            return <div className="hd-sl" key={k} aria-hidden={!on} role="group" aria-label={`${k + 1} من ${L.length}`}>{body}</div>;
          })}
        </div>
      </div>
      {L.length > 1 && (L.length > 14
        ? <div className="hd-dots"><span>{cur + 1} من {L.length}</span></div>
        : <div className="hd-dots">{L.map((_, k) => <button key={k} className={k === cur ? 'on' : ''} onClick={() => go(k)} aria-label={`شريحة ${k + 1}`} />)}</div>)}
    </section>
  );
}

type Tile = { ic: string; t: string; s: string; href?: string; ext?: boolean; modal?: Modal; main?: boolean; needsCatalog?: boolean };

/** All the site's services as one grid of same-size tiles. */
export function Services({ waCatalog }: { waCatalog?: string }) {
  const { open } = useShop();
  const hasCat = useCatalog();
  const T = ([
    { ic: '♻️', t: 'فضلة', s: 'سوق فضلة النجارين', href: '/scraps', main: true },
    { ic: '🛠️', t: 'تجهيز بمقاسك', s: 'استانلس وبامبو', href: '/custom', main: true },
    { ic: '📖', t: 'الكتالوج', s: 'قلّب واطبع', href: '/catalog', main: true, needsCatalog: true },
    { ic: '🧰', t: 'أطقم جاهزة', s: 'مطبخ أو دولاب', href: '/kits', main: true },
    { ic: '🧮', t: 'حاسبات النجار', s: 'دراعات ومفصلات', href: '/tools', main: true },
    { ic: '⚡', t: 'اطلب بالكود', s: 'لو عارف الكود', href: '/quick', main: true },
    { ic: '🚚', t: 'التوصيل', s: 'كل المحافظات', modal: { kind: 'ship' } },
    { ic: '📦', t: 'تتبّع طلبك', s: 'برقم موبايلك', modal: { kind: 'track' } },
    { ic: '🙋', t: 'محتاج فني؟', s: 'نرشّحلك نجار', href: '/help' },
    { ic: '🧑‍🔧', t: 'نجار أو تاجر؟', s: 'أسعار جملة', href: '/trade' },
    { ic: '🏗️', t: 'من شغلنا', s: 'صور حقيقية', href: '/works' },
    { ic: '🏷️', t: 'البراندات', s: 'بلوم وجراس', href: '/brands' },
    { ic: '🗺️', t: 'تجيلنا إزاي', s: 'الطريق للمحل', href: '/directions' },
    ...(waCatalog ? [{ ic: '📒', t: 'كتالوج واتساب', s: 'كل الأصناف', href: waCatalog, ext: true }] : []),
  ] as Tile[]).filter(x => !x.needsCatalog || hasCat);
  return (
    <section className="blk svc" aria-labelledby="svc-h">
      <div className="sh"><h2 id="svc-h">خدمات ميكانيزم</h2></div>
      <div className="svc-g">
        {T.map(x => {
          const inner = <><span className="ic" aria-hidden="true">{x.ic}</span><b>{x.t}</b><small>{x.s}</small></>;
          const cls = 'svc-t' + (x.main ? ' main' : '');
          if (x.modal) return <button key={x.t} type="button" className={cls} onClick={() => open(x.modal!)}>{inner}</button>;
          if (x.ext) return <a key={x.t} className={cls} href={x.href} target="_blank" rel="noopener">{inner}</a>;
          return <Link key={x.t} className={cls} href={x.href!}>{inner}</Link>;
        })}
      </div>
    </section>
  );
}
