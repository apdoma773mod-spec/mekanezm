'use client';
// Interactive parts of the store pages. They render on the server too (full HTML for Google),
// then become interactive in the browser.
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { listReviews, type Review } from '@/lib/api';
import { ART_DEFS, sectionArt } from '@/lib/art';
import type { Product } from '@/lib/schema';
import { productPath, ROOMS, sectionPath, visibleSections, waUrl } from '@/lib/shop';
import { ItemCard, ProductCard } from './product-card';
import { HowToRequest } from './modals';
import { useShop, type Modal } from './shop-provider';

/** A button that opens one of the popups. */
export function OpenBtn({ modal, className, children }: { modal: Modal; className?: string; children: ReactNode }) {
  const { open } = useShop();
  return <button type="button" className={className} onClick={() => open(modal)}>{children}</button>;
}

/* ---------- header slider ---------- */
export type Slide = { img: string; t: string; s: string; c: boolean; href: string };
export function Slider({ slides: L }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const x0 = useRef(0);
  // Only the first photo loads with the page; the next one after the page has loaded, the rest as they come up.
  const [far, setFar] = useState(0);
  useEffect(() => {
    const f = () => setFar(v => Math.max(v, 1));
    if (document.readyState === 'complete') f(); else addEventListener('load', f, { once: true });
    return () => removeEventListener('load', f);
  }, []);
  useEffect(() => { setFar(v => Math.max(v, i + 1)); }, [i]);
  useEffect(() => {
    if (L.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % L.length), 4500);
    return () => clearInterval(t);
  }, [L.length, tick]);
  if (!L.length) return null;
  const go = (n: number) => { setI((n + L.length) % L.length); setTick(t => t + 1); };
  return (
    <div className="slider">
      <div className="vw" onTouchStart={e => (x0.current = e.touches[0].clientX)}
        onTouchEnd={e => { const d = e.changedTouches[0].clientX - x0.current; if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1)); }}>
        <div className="trk" style={{ transform: `translateX(${-i * 100}%)` }}>
          {L.map((s, k) => (
            <div className="slide" key={k} aria-hidden={k !== i}>
              {k <= far && <Image className="bg" src={s.img} alt="" fill sizes="(max-width:1100px) 100vw, 1100px" priority={k === 0} />}
              <div>
                <p className="h">{s.t}</p>
                <p>{s.s}</p>
                <Link className="btn" href={s.href} tabIndex={k === i ? 0 : -1}>{s.c ? 'اطلب الآن' : 'تصفح المنتجات'} ➜</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="dts">{L.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={`صورة ${k + 1}`} />)}</div>
    </div>
  );
}

/* ---------- a swipeable row of product cards (يمين وشمال) ---------- */
export function ProductRow({ title, href, items, total, id, priority }: { title: string; href: string; items: { p: Product; ok: boolean; fresh?: boolean }[]; total: number; id?: string; priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: items.length < 3 });
  const check = () => {
    const c = ref.current;
    if (!c) return;
    const x = Math.abs(c.scrollLeft); // RTL: scrollLeft runs negative
    setEdge({ start: x < 8, end: x + c.clientWidth >= c.scrollWidth - 8 });
  };
  const move = (dir: 1 | -1) => { const c = ref.current; if (c) c.scrollBy({ left: -dir * c.clientWidth * 0.85, behavior: 'smooth' }); };
  return (
    <section className="prow" id={id} aria-labelledby={id ? id + '-h' : undefined}>
      <div className="prow-h">
        <h2 id={id ? id + '-h' : undefined}><Link href={href}>{title}</Link></h2>
        <Link className="all" href={href}>عرض الكل{total > items.length ? ` (${total})` : ''} ←</Link>
      </div>
      <div className="prow-w">
        <div className="prow-s" ref={ref} onScroll={check}>
          {items.map(({ p, ok, fresh }, k) => <ProductCard key={p.id} p={p} ok={ok} fresh={fresh} priority={priority && k < 2} />)}
          {total > items.length && <Link className="more-card" href={href}><b>+{total - items.length}</b>شوف باقي القسم ←</Link>}
        </div>
        {!edge.start && <button className="rarr r" onClick={() => move(-1)} aria-label="السابق">›</button>}
        {!edge.end && <button className="rarr l" onClick={() => move(1)} aria-label="التالي">‹</button>}
      </div>
    </section>
  );
}

/* ---------- choice assistant ---------- */
const SP = ROOMS;
export function Finder() {
  const { site } = useShop();
  const [k, setK] = useState(-1);
  const secs = k < 0 ? [] : visibleSections(site).filter(x => SP[k][1].test(x.name));
  return (
    <section className="find" aria-labelledby="find-h">
      <h2 id="find-h">مساعد الاختيار</h2>
      <p>قولنا بتجهّز إيه ونرشّحلك الأقسام المناسبة</p>
      <div className="o">{SP.map((s, i) => <button key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)}>{s[0]}</button>)}</div>
      {k >= 0 && (
        <div className="r">
          {secs.map(x => <Link key={x.id} href={sectionPath(x.id)}>{x.name}</Link>)}
          <a className="w" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، بجهّز ${SP[k][0].replace(/^\S+\s/, '')} ومحتاج مساعدة في اختيار الإكسسوارات`)}>💬 مش متأكد؟ كلّمنا</a>
        </div>
      )}
    </section>
  );
}

/* ---------- category tiles (only sections that have products) ---------- */
export function Categories({ current }: { current?: string }) {
  const { site } = useShop();
  return (
    <section className="blk" id="cats">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART_DEFS }} />
      <div className="sh"><h2>تسوق حسب التصنيف</h2></div>
      <div className="tiles">
        {visibleSections(site).map(s => (
          <Link key={s.id} href={sectionPath(s.id)} className={'tile' + (current === s.id ? ' on' : '')} aria-current={current === s.id ? 'page' : undefined}>
            <span className="im">
              {s.img ? <Image src={s.img} alt="" fill sizes="132px" /> : <svg viewBox="0 0 200 150" role="img" aria-label={s.name} dangerouslySetInnerHTML={{ __html: sectionArt(s.id, s.name) }} />}
            </span>
            {s.name}<small>{site.counts[s.id]} منتج</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- recently viewed (from this browser) ---------- */
export function Recent({ exclude }: { exclude?: string }) {
  const { recent } = useShop();
  const L = recent.filter(x => x.id !== exclude).slice(0, 10);
  if (!L.length) return null;
  return (
    <section className="recent" aria-label="شوفته قبل كده">
      <h3>👀 شوفته قبل كده</h3>
      <div className="rw">{L.map(it => <ItemCard key={it.id} it={it} />)}</div>
    </section>
  );
}

/* ---------- reviews ---------- */
export function Reviews() {
  const { open } = useShop();
  const [L, setL] = useState<Review[] | null>(null);
  useEffect(() => { listReviews().then(setL); }, []);
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
  return (
    <section className="mkp" id="mkRev" aria-labelledby="rev-h">
      <h2 id="rev-h">⭐ آراء عملائنا</h2>
      {L && (L.length
        ? <div className="mkrv">{L.map((x, i) => <div key={i}><div className="s" aria-label={`${x.rating} من 5`}>{stars(x.rating)}</div>{x.body && <p>{x.body}</p>}<small>— {x.name}</small></div>)}</div>
        : <p className="mut" style={{ margin: '0 0 6px' }}>لسه مفيش آراء — كن أول من يقيّم تجربته معانا.</p>)}
      <button className="mkrbtn" onClick={() => open({ kind: 'review' })}>✍️ اكتب رأيك</button>
    </section>
  );
}

/* ---------- fade-in on scroll + counting numbers ---------- */
export function Reveal({ children, className, id, label }: { children: ReactNode; className: string; id?: string; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      el.classList.add('in');
      io.disconnect();
      el.querySelectorAll<HTMLElement>('[data-n]').forEach(c => {
        const t = +c.dataset.n!, s = performance.now();
        const f = (n: number) => { const k = Math.min(1, (n - s) / 900); c.textContent = String(Math.round(t * k)); if (k < 1) requestAnimationFrame(f); };
        requestAnimationFrame(f);
      });
    }), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} className={className + ' rv'} id={id} aria-label={label}>{children}</section>;
}

export function ReqHome() {
  return (
    <section className="blk" id="reqHome" style={{ marginTop: 22 }}>
      <HowToRequest />
      <OpenBtn modal={{ kind: 'req' }} className="reqbtn">📷 مش لاقي اللي بتدوّر عليه؟<small>صوّر المنتج وابعتهولنا — هنرد عليك ونقولك نوفّره إمتى</small></OpenBtn>
    </section>
  );
}

export function Works() {
  const { site, open } = useShop();
  const W = site.works.filter(w => w.imgs.length);
  if (!W.length) return null;
  return (
    <section className="blk" id="works">
      <div className="sh"><h2>🏗️ من أعمالنا</h2><Link href="/works" className="all">شوف كل شغلنا ←</Link></div>
      <div className="works">{W.map((w, i) => (
        <button key={i} onClick={() => open({ kind: 'work', i })}>
          <span className="im"><Image src={w.imgs[0]} alt={w.title} fill sizes="280px" style={{ objectFit: 'cover' }} /></span>
          <div><b>{w.title}</b>{w.desc && <small>{w.desc}</small>}<span>📷 {w.imgs.length} صور</span></div>
        </button>
      ))}</div>
    </section>
  );
}

/* ---------- favorites page body ---------- */
export function FavList() {
  const { fav, site } = useShop();
  const L = Object.values(fav);
  if (!L.length) return <div className="empty"><p>مفيش منتجات في المفضلة لسه — دوس ♥ على أي منتج وهيتحفظ هنا.</p><Link className="btn-wa" href="/">تصفح المنتجات</Link></div>;
  return (
    <>
      <div className="mini-grid">{L.map(it => <ItemCard key={it.id} it={it} />)}</div>
      <a className="btn-g" style={{ marginTop: 14 }} target="_blank" rel="noopener"
        href={waUrl(site, 'المنتجات اللي عجبتني من ميكانيزم:\n' + L.map(p => `• ${p.name} — ${location.origin}${productPath(p.id)}`).join('\n'))}>♥ ابعت مفضلتي واتساب</a>
    </>
  );
}
