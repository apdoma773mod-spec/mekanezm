'use client';
// المنتجات بالتفصيل: product grid, then a full-screen scroll story per product
// (title shrinks, photo turns, photos flip with each spec line, then details + order buttons).
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bumpVisit } from '@/lib/api';
import loader from '@/lib/image-loader';
import type { Product, Site } from '@/lib/schema';
import { images, waUrl } from '@/lib/shop';

const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const big = (u: string) => loader({ src: u, width: 828 });

function specs(d: string): [string, string][] {
  return String(d || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.search(/[:：]/);
    return i > 0 && i < 40 ? [x.slice(0, i).trim(), x.slice(i + 1).trim()] : [x, ''];
  });
}

export function StoryApp({ site, initial }: { site: Pick<Site, 'name' | 'phone' | 'sections' | 'products'>; initial: string | null }) {
  const [id, setId] = useState<string | null>(initial && site.products.some(p => p.id === initial) ? initial : null);
  useEffect(() => { bumpVisit('story'); }, []);
  const openP = useCallback((x: string | null) => {
    setId(x);
    history.replaceState(null, '', x ? '?p=' + encodeURIComponent(x) : location.pathname);
  }, []);
  const p = id ? site.products.find(x => x.id === id) : undefined;
  useEffect(() => {
    document.documentElement.style.overflow = p ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [p]);

  return (
    <div className="story">
      <div className="top"><b>ميكانيزم</b><a href="/">← رجوع للمتجر</a></div>
      <div className="list" hidden={!!p}>
        <h1>اتفرج على المنتجات</h1>
        <p>اختار منتج وكمّل تمرير لتشوف تفاصيله</p>
        <div className="g">
          {site.products.map(x => (
            <a key={x.id} href={'?p=' + encodeURIComponent(x.id)} onClick={e => { e.preventDefault(); openP(x.id); }}>
              <span className="im">{images(x)[0] && <Image src={images(x)[0]} alt="" fill sizes="(max-width:600px) 50vw, 200px" style={{ objectFit: 'contain' }} />}</span>
              <span className="t">{x.name}</span>
            </a>
          ))}
        </div>
      </div>
      {p && <Story key={p.id} p={p} site={site} go={openP} />}
    </div>
  );
}

function Story({ p, site, go }: { p: Product; site: Pick<Site, 'name' | 'phone' | 'sections' | 'products'>; go: (id: string | null) => void }) {
  const root = useRef<HTMLDivElement>(null);
  let im = images(p);
  if (im.length > 12) { const k = im.length / 12; im = Array.from({ length: 12 }, (_, i) => im[Math.floor(i * k)]); }
  const sp = specs(p.desc), kv = sp.filter(x => x[1]);
  const steps = (kv.length ? kv : sp).slice(0, Math.max(im.length, 1));
  const sec = site.sections.find(s => s.id === p.sec);
  const L = site.products, idx = L.findIndex(x => x.id === p.id);
  const rel = L.filter(x => x.sec === p.sec && x.id !== p.id).slice(0, 8);
  const step = (d: number) => go(L[(idx + d + L.length) % L.length].id);

  useEffect(() => {
    const r = root.current!;
    const $ = <T extends Element>(s: string) => r.querySelector<T>(s);
    const st = { k: -1, hp: 0, drag: 0, raf: 0, q: 0 };
    const tick = () => {
      const H = r.clientHeight;
      $<HTMLElement>('.bar i')!.style.width = (r.scrollTop / Math.max(1, r.scrollHeight - H)) * 100 + '%';
      const intro = $<HTMLElement>('.intro');
      if (intro) {
        const pr = cl(r.scrollTop / (intro.offsetHeight - H), 0, 1);
        const h = $<HTMLElement>('h1')!, s = $<HTMLElement>('.sub')!, hint = $<HTMLElement>('.hint')!;
        h.style.transform = `translateY(${-pr * 60}px) scale(${1 - pr * 0.15})`;
        h.style.opacity = String(1 - pr * 1.1); s.style.opacity = String(1 - pr * 1.4); hint.style.opacity = String(1 - pr * 3);
        st.hp = pr;
      }
      const seq = $<HTMLElement>('.seq');
      if (seq) {
        const rc = seq.getBoundingClientRect(), prog = cl(-rc.top / (seq.offsetHeight - H), 0, 1), n = im.length, pos = prog * (n - 1);
        r.querySelectorAll<HTMLElement>('.frames img').forEach((e, k) => {
          const o = cl(1 - Math.abs(k - pos) * 1.7, 0, 1);
          e.style.opacity = String(o);
          e.style.transform = `perspective(1000px) rotateY(${(k - pos) * -55}deg) scale(${0.92 + 0.1 * o}) translateX(${(k - pos) * -30}px)`;
        });
        const i = Math.round(pos), s2 = steps[Math.min(i, steps.length - 1)] ?? ['', ''];
        r.querySelectorAll('.dots i').forEach((e, k) => e.classList.toggle('on', k === i));
        if (st.k !== i) {
          st.k = i;
          const t = $<HTMLElement>('.cap .t')!, v = $<HTMLElement>('.cap .v')!, nn = $<HTMLElement>('.cap .n')!;
          t.classList.add('o');
          setTimeout(() => { nn.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'); t.textContent = s2[1] ? s2[0] : ''; v.textContent = s2[1] || s2[0]; t.classList.remove('o'); }, 180);
        }
      }
      r.querySelectorAll('.sp:not(.in)').forEach(e => { if (e.getBoundingClientRect().top < H * 0.92) e.classList.add('in'); });
    };
    const spin = () => {
      const hero = $<HTMLElement>('.hero-i');
      st.drag *= 0.94;
      if (hero) hero.style.transform = `perspective(900px) rotateY(${Math.sin(performance.now() / 1000 * 1.1) * 24 + st.drag}deg) scale(${0.72 + st.hp * 0.5})`;
      st.raf = requestAnimationFrame(spin);
    };
    const onScroll = () => { if (!st.q) { st.q = 1; requestAnimationFrame(() => { st.q = 0; tick(); }); } };
    let dx: number | null = null;
    const down = (e: PointerEvent) => { if ((e.target as Element).closest('.hero-i')) dx = e.clientX; };
    const move = (e: PointerEvent) => { if (dx != null) { st.drag = cl(st.drag + (e.clientX - dx) * 0.9, -80, 80); dx = e.clientX; } };
    const up = () => { dx = null; };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') go(null); if (e.key === 'ArrowLeft') step(1); if (e.key === 'ArrowRight') step(-1); };
    r.scrollTop = 0;
    r.addEventListener('scroll', onScroll, { passive: true });
    r.addEventListener('pointerdown', down); r.addEventListener('pointermove', move); r.addEventListener('pointerup', up);
    addEventListener('keydown', key); addEventListener('resize', tick);
    tick(); spin();
    // Warm up the next product's photos.
    images(L[(idx + 1) % L.length]).slice(0, 3).forEach(u => { const x = new window.Image(); x.src = big(u); });
    return () => {
      cancelAnimationFrame(st.raf);
      r.removeEventListener('scroll', onScroll); r.removeEventListener('pointerdown', down); r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up);
      removeEventListener('keydown', key); removeEventListener('resize', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const share = () => {
    const u = location.href;
    if (navigator.share) navigator.share({ title: p.name, url: u }).catch(() => {});
    else navigator.clipboard?.writeText(u).catch(() => {});
  };

  return (
    <div className="st" ref={root} role="dialog" aria-label={p.name}>
      <div className="nv2">
        <button onClick={() => step(-1)} aria-label="السابق">›</button>
        <button onClick={() => step(1)} aria-label="التالي">‹</button>
        <button onClick={share} aria-label="مشاركة">⤴</button>
        <a href={'/p/' + encodeURIComponent(p.id)} aria-label="صفحة المنتج في المتجر">🛒</a>
      </div>
      <button className="x" onClick={() => go(null)} aria-label="إغلاق">✕</button>
      <div className="bar"><i /></div>
      <section className="intro">
        <div className="pin">
          <div className="eb">{sec?.name || site.name}</div>
          <h1>{p.name}</h1>
          <p className="sub">{p.code ? 'كود ' + p.code : 'من ميكانيزم'}</p>
          {im[0] && <img className="hero-i" src={big(im[0])} alt="" draggable={false} />}
          <div className="hint">⌄ كمّل لتحت</div>
        </div>
      </section>
      {im.length > 1 && (
        <section className="seq" style={{ height: `${im.length * 85 + 100}vh` }}>
          <div className="stage">
            <div className="frames">{im.map((x, k) => <img key={x} src={big(x)} alt="" loading={k < 2 ? 'eager' : 'lazy'} />)}</div>
            <div className="dots">{im.map(x => <i key={x} />)}</div>
            <div className="cap"><div className="n" /><div className="t" /><div className="v" /></div>
          </div>
        </section>
      )}
      <section className="specs">
        <h2>التفاصيل</h2>
        {sp.length ? sp.map((x, k) => <div className="sp" key={k}><b>{x[0]}</b><span>{x[1]}</span></div>) : <p style={{ textAlign: 'center', color: '#667' }}>اسأل عن تفاصيل المنتج على الواتساب</p>}
      </section>
      <div className="cta">
        <a href={waUrl(site, `السلام عليكم، عايز أطلب: ${p.name}${p.code ? ` (كود ${p.code})` : ''}`)} target="_blank" rel="noopener">📲 اطلب على الواتساب</a>
        <a className="g" href={waUrl(site, 'السلام عليكم، ده بكام؟\n' + p.name)} target="_blank" rel="noopener">💬 اسأل عن السعر</a>
        <a className="shp" href={'/p/' + encodeURIComponent(p.id)}>🛒 صفحة المنتج في المتجر</a>
      </div>
      {rel.length > 0 && (
        <section className="rel">
          <h2>منتجات مشابهة</h2>
          <div className="rw">{rel.map(x => (
            <button key={x.id} onClick={() => go(x.id)}>{images(x)[0] && <img loading="lazy" src={loader({ src: images(x)[0], width: 256 })} alt="" />}{x.name.slice(0, 40)}</button>
          ))}</div>
        </section>
      )}
    </div>
  );
}
