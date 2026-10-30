'use client';
// Interactive parts of the home page. They render on the server too (full HTML for Google),
// then become interactive in the browser.
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { listReviews, type Review } from '@/lib/api';
import { ART_DEFS, sectionArt } from '@/lib/art';
import { images, productPath, productUrl, slidesList, waUrl } from '@/lib/shop';
import { ProductCard } from './product-card';
import { HowToRequest } from './modals';
import { useShop, type Modal } from './shop-provider';

/** A button that opens one of the popups. */
export function OpenBtn({ modal, className, children }: { modal: Modal; className?: string; children: ReactNode }) {
  const { open } = useShop();
  return <button type="button" className={className} onClick={() => open(modal)}>{children}</button>;
}

/* ---------- header slider ---------- */
export function Slider() {
  const { site } = useShop();
  const L = useMemo(() => slidesList(site), [site]);
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const x0 = useRef(0);
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
              <Image className="bg" src={s.img} alt="" fill sizes="(max-width:1100px) 100vw, 1100px" priority={k === 0} />
              <div>
                <p className="h">{s.t}</p>
                <p>{s.s}</p>
                <a className="btn" href="#prods0" tabIndex={k === i ? 0 : -1}>{s.c ? 'اطلب الآن' : 'تصفح المنتجات'} ➜</a>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="dts">{L.map((_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={`صورة ${k + 1}`} />)}</div>
    </div>
  );
}

/* ---------- "الأكثر طلباً" carousel ---------- */
export function Featured() {
  const { site } = useShop();
  const top = site.products.filter(p => p.top);
  const fp = (top.length ? top : site.products).slice(0, 10);
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(0);
  if (!fp.length) return null;
  const onScroll = () => {
    const c = ref.current;
    if (!c) return;
    let b = 0, m = 1e9;
    [...c.children].forEach((e, j) => {
      const el = e as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - c.scrollLeft - c.clientWidth / 2);
      if (d < m) { m = d; b = j; }
    });
    setOn(b);
  };
  return (
    <section className="ftr" aria-labelledby="ftr-h">
      <span className="bdg">اختيارات مميزة</span>
      <h2 id="ftr-h">الأكثر طلباً</h2>
      <p>اكتشف المنتجات الأعلى طلباً، بجودة وأداء يومي.</p>
      <a className="btn-big" href="#prods0">تسوق الآن ➜</a>
      <div className="cr" ref={ref} onScroll={onScroll}>
        {fp.map(p => (
          <Link className="pc" key={p.id} href={productPath(p.id)}>
            <span className="im framed" style={{ display: 'block' }}>{images(p)[0] && <Image src={images(p)[0]} alt={p.name} fill sizes="260px" style={{ objectFit: 'contain' }} />}</span>
            <h3>{p.name}</h3>
          </Link>
        ))}
      </div>
      <div className="cdt">{fp.map((p, k) => <i key={p.id} className={k === on ? 'on' : ''} />)}</div>
    </section>
  );
}

/* ---------- choice assistant ---------- */
const SP: [string, RegExp][] = [
  ['🍽️ مطبخ', /مطبخ|مفصل|مجر|بلوم|اوكر|مقبض|جزام/],
  ['👗 دريسنج روم', /دريسنج|جرار|دلف|مجر|مقبض|اوكر/],
  ['🚪 دولاب / غرفة نوم', /دولاب|جرار|مفصل|مقبض|اوكر|جزام/],
];
export function Finder() {
  const { site, setCur } = useShop();
  const [k, setK] = useState(-1);
  const secs = k < 0 ? [] : site.sections.filter(x => SP[k][1].test(x.name) && site.products.some(p => p.sec === x.id));
  return (
    <section className="find" aria-labelledby="find-h">
      <h2 id="find-h">مساعد الاختيار</h2>
      <p>قولنا بتجهّز إيه ونرشّحلك الأقسام المناسبة</p>
      <div className="o">{SP.map((s, i) => <button key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)}>{s[0]}</button>)}</div>
      {k >= 0 && (
        <div className="r">
          {secs.map(x => <button key={x.id} onClick={() => { setCur(x.id); document.getElementById('prods0')?.scrollIntoView({ behavior: 'smooth' }); }}>{x.name}</button>)}
          <a className="w" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، بجهّز ${SP[k][0].replace(/^\S+\s/, '')} ومحتاج مساعدة في اختيار الإكسسوارات`)}>💬 مش متأكد؟ كلّمنا</a>
        </div>
      )}
    </section>
  );
}

/* ---------- categories ---------- */
export function Categories() {
  const { site, cur, setCur } = useShop();
  return (
    <section className="blk" id="cats">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART_DEFS }} />
      <div className="sh"><h2>تسوق حسب التصنيف</h2></div>
      <div className="tiles">
        {site.sections.map(s => {
          const n = site.products.filter(p => p.sec === s.id).length;
          return (
            <button key={s.id} className={'tile' + (cur === s.id ? ' on' : '')} aria-pressed={cur === s.id}
              onClick={() => { setCur(cur === s.id ? '' : s.id); document.getElementById('prods0')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span className="im">
                {s.img ? <Image src={s.img} alt="" fill sizes="132px" /> : <svg viewBox="0 0 200 150" role="img" aria-label={s.name} dangerouslySetInnerHTML={{ __html: sectionArt(s.id, s.name) }} />}
              </span>
              {s.name}{n > 0 && <small>{n} منتج</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- all products: search, chips, sticky sections, grid ---------- */
function hl(t: string, q: string) {
  const i = t.toLowerCase().indexOf(q);
  return i < 0 ? t : <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

export function Catalog() {
  const { site, ok, fav, favOn, cur, setCur, recent, product, open } = useShop();
  const [q, setQ] = useState('');
  const [sugOpen, setSugOpen] = useState(false);
  const [avOnly, setAvOnly] = useState(false);
  const [sort, setSort] = useState('');
  const [active, setActive] = useState('');
  const bar = useRef<HTMLDivElement>(null);
  const ql = q.trim().toLowerCase();

  const sections = useMemo(() => site.sections.filter(s => !cur || s.id === cur).map(s => {
    let ps = site.products.filter(p => p.sec === s.id && (!favOn || fav.has(p.id)) && (!ql || (p.name + ' ' + p.desc).toLowerCase().includes(ql)) && (!avOnly || ok(p)));
    if (sort) ps = [...ps].sort((a, b) => (sort === 'av' && ok(a) !== ok(b) ? (ok(a) ? -1 : 1) : a.name.localeCompare(b.name, 'ar')));
    return { s, ps };
  }).filter(x => x.ps.length), [site, cur, favOn, fav, ql, avOnly, sort, ok]);

  const stickSecs = site.sections.filter(s => site.products.some(p => p.sec === s.id));
  const sug = ql.length >= 2 ? site.products.filter(p => (p.name + ' ' + p.code).toLowerCase().includes(ql)).slice(0, 6) : [];

  // Highlight the section being read in the sticky bar.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id.slice(2)); }), { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('#prods section[id^=s-]').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [sections]);
  useEffect(() => { bar.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [active]);

  const favList = [...fav].map(id => product(id)).filter(p => !!p);
  const recentList = recent.map(id => product(id)).filter(p => !!p).slice(0, 8);

  return (
    <>
      <section className="blk tools" id="prods0">
        <div className="sh"><h2>كل المنتجات</h2></div>
        <div style={{ position: 'relative' }}>
          <label className="vh" htmlFor="q">ابحث عن منتج</label>
          <input id="q" type="search" placeholder="ابحث عن منتج…" value={q} autoComplete="off"
            onChange={e => { setQ(e.target.value); setSugOpen(true); }} onBlur={() => setTimeout(() => setSugOpen(false), 200)} />
          {sugOpen && sug.length > 0 && (
            <div className="sug" role="listbox">
              {sug.map(p => (
                <Link key={p.id} role="option" aria-selected={false} href={productPath(p.id)}>
                  {images(p)[0] && <img src={images(p)[0]} alt="" loading="lazy" />}<b>{hl(p.name, ql)}</b>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      {recentList.length > 0 && (
        <section className="recent" aria-label="شوفته قبل كده">
          <h3>👀 شوفته قبل كده</h3>
          <div className="rw">{recentList.map(p => (
            <Link key={p.id} href={productPath(p.id)}>
              <span className="im">{images(p)[0] && <Image src={images(p)[0]} alt="" fill sizes="92px" style={{ objectFit: 'contain' }} />}</span>
              <span>{p.name.slice(0, 30)}</span>
            </Link>
          ))}</div>
        </section>
      )}
      <div className="chips" role="toolbar" aria-label="فلترة">
        {favList.length > 0 && (
          <button onClick={() => window.open(waUrl(site, 'المنتجات اللي عجبتني من ميكانيزم:\n' + favList.map(p => `• ${p.name} — ${productUrl(p.id)}`).join('\n')), '_blank', 'noopener')}>♥ ابعت مفضلتي</button>
        )}
        <button className={!avOnly ? 'on' : ''} onClick={() => setAvOnly(false)}>كل المنتجات</button>
        <button className={avOnly ? 'on' : ''} onClick={() => setAvOnly(true)}>✔ المتوفر فقط</button>
        <select aria-label="ترتيب" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="">ترتيب: الافتراضي</option><option value="az">الاسم أ ← ي</option><option value="av">المتوفر الأول</option>
        </select>
        {cur && <button className="on" onClick={() => setCur('')}>✕ {site.sections.find(s => s.id === cur)?.name}</button>}
      </div>
      {stickSecs.length >= 2 && (
        <div id="stick" ref={bar}>
          {stickSecs.map(s => (
            <button key={s.id} className={active === s.id ? 'on' : ''} onClick={() => {
              if (cur && cur !== s.id) setCur('');
              setTimeout(() => { const t = document.getElementById('s-' + s.id); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - (bar.current?.offsetHeight ?? 0) - 8, behavior: 'smooth' }); }, 30);
            }}>{s.name}</button>
          ))}
        </div>
      )}
      <div id="prods" className="blk" style={{ maxWidth: 1100, margin: 'auto', padding: '0 16px' }}>
        {sections.length ? sections.map(({ s, ps }) => (
          <section id={'s-' + s.id} key={s.id} aria-labelledby={'h-' + s.id}>
            <h2 className="sec-h" id={'h-' + s.id}>{s.name}</h2>
            <div className="grid">{ps.map(p => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        )) : (
          <div className="empty">
            <p>{favOn ? 'مفيش منتجات في المفضلة لسه' : site.products.length ? 'مفيش منتجات مطابقة' : 'المنتجات بتتضاف قريباً'}</p>
            <a className="btn-wa" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أستفسر عن منتجات ميكانيزم')}>اسأل على الواتساب</a>
            <div style={{ marginTop: 12 }}><button type="button" className="reqbtn" onClick={() => open({ kind: 'req' })}>📷 مش لاقي اللي بتدوّر عليه؟<small>صوّر المنتج وابعتهولنا — هنرد عليك ونقولك نوفّره إمتى</small></button></div>
          </div>
        )}
      </div>
    </>
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
      <div className="sh"><h2>🏗️ من أعمالنا</h2></div>
      <div className="works">{W.map((w, i) => (
        <button key={i} onClick={() => open({ kind: 'work', i })}>
          <span className="im"><Image src={w.imgs[0]} alt={w.title} fill sizes="280px" style={{ objectFit: 'cover' }} /></span>
          <div><b>{w.title}</b>{w.desc && <small>{w.desc}</small>}<span>📷 {w.imgs.length} صور</span></div>
        </button>
      ))}</div>
    </section>
  );
}
