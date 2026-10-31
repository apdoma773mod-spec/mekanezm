'use client';
// Product page body: swipeable photos, details, order buttons and the sticky add-to-order bar.
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Item, Product } from '@/lib/schema';
import { images, orderText, parseSpecs, productPath, productUrl, sectionOf, sectionPath, shopPhones, toItem, videoEmbed, waUrl } from '@/lib/shop';
import { evProduct } from '@/lib/track';
import { HAND_LABEL, type HandInfo } from '@/lib/hand';
import { DeliveryEta } from './delivery-eta';
import { HandGuide } from './hand-guide';
import { CompareBtn, ProductReviews } from './extras';
import { lqip, Placeholder } from './product-card';
import { useShop } from './shop-provider';

/** Collapsible section (native <details>, works without JS). */
function Acc({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return <details className="acc" open={open}><summary>{title}</summary><div className="acc-b">{children}</div></details>;
}

export function ProductView({ p, ok, sim, comp = [], prev, next, brand, works = [], install, hand }: {
  hand?: HandInfo | null;
  p: Product; ok: boolean; sim: Item[]; comp?: Item[]; prev?: Item; next?: Item;
  brand?: { slug: string; name: string }; works?: { i: number; title: string; img: string }[]; install?: { href: string; ext: boolean };
}) {
  const { site, cart, add, fav, toggleFav, open, pushRecent, say } = useShop();
  const router = useRouter();
  const item = toItem(p, ok);
  const im = images(p);
  const sec = sectionOf(site, p);
  const specs = parseSpecs(p.desc);
  const vid = videoEmbed(p.video);
  const phone = shopPhones(site)[0] || site.phone;
  const n = cart[p.id]?.q ?? 0;
  const [i, setI] = useState(0);
  const [q, setQ] = useState(1);
  const strip = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pushRecent(item);
    evProduct('view_item', 'ViewContent', p);
    const t = setTimeout(() => say('محتاج مساعدة في الاختيار؟ كلّمنا على الواتساب'), 45000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);
  useEffect(() => { thumbs.current?.children[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [i]);

  const go = (k: number) => {
    const s = strip.current;
    if (!s || !im.length) return;
    const nI = (k + im.length) % im.length;
    // RTL scroll: positions run negative in modern browsers.
    s.scrollTo({ left: -nI * s.clientWidth, behavior: 'smooth' });
    setI(nI);
  };
  const share = async () => {
    const url = productUrl(p.id);
    try { if (navigator.share) { await navigator.share({ title: p.name, text: `${p.name} — ${site.name}`, url }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); say('تم نسخ رابط المنتج'); } catch { window.open(waUrl(site, p.name + '\n' + url), '_blank'); }
  };
  const back = () => { if (history.length > 1 && document.referrer.startsWith(location.origin)) router.back(); else router.push('/'); };

  return (
    <>
      <div className="pvtop">
        <button onClick={back} aria-label="رجوع">→</button>
        <b>{sec?.name || site.name}</b>
        <button onClick={share} aria-label="مشاركة">⤴</button>
        <button className={!!fav[p.id] ? 'on' : ''} onClick={() => toggleFav(item)} aria-label="المفضلة" aria-pressed={!!fav[p.id]}>♥</button>
      </div>
      <div className="pvwrap">
        <div className="pvg">
          <div style={{ position: 'relative' }}>
            <div className="pvs framed" ref={strip} style={{ position: 'relative' }}
              onScroll={e => { const s = e.currentTarget; const k = Math.round(Math.abs(s.scrollLeft) / s.clientWidth); if (k !== i) setI(k); }}>
              {im.length ? im.map((x, k) => (
                <div key={x} className="lq" style={lqip(x)} onClick={() => open({ kind: 'image', srcs: im, i: k })}>
                  <Image src={x} alt={`${p.name} ${k + 1}`} fill sizes="(max-width:900px) 100vw, 550px" priority={k === 0} />
                </div>
              )) : <div><Placeholder section={sec?.name} /></div>}
            </div>
            {im.length > 1 && <>
              <button className="pvar r" onClick={() => go(i - 1)} aria-label="الصورة السابقة">›</button>
              <button className="pvar l" onClick={() => go(i + 1)} aria-label="الصورة التالية">‹</button>
              <span className="pvcnt" dir="ltr">{i + 1} / {im.length}</span>
            </>}
          </div>
          {im.length > 1 && <>
            <div className="pvdots" aria-hidden="true">{im.map((x, k) => <i key={x} className={k === i ? 'on' : ''} />)}</div>
            <div className="pvth" ref={thumbs}>{im.map((x, k) => (
              <button key={x} className={k === i ? 'on' : ''} onClick={() => go(k)} aria-label={`صورة ${k + 1}`}>
                <Image src={x} alt="" fill sizes="64px" style={{ objectFit: 'cover' }} />
              </button>
            ))}</div>
          </>}
        </div>
        <div className="pvi">
          <nav className="bc" aria-label="مكانك في الموقع">
            <Link href="/">الرئيسية</Link><span>›</span>
            {sec && <><Link href={sectionPath(sec.id)}>{sec.name}</Link><span>›</span></>}
            <span>{p.name.slice(0, 40)}</span>
          </nav>
          <h1>{p.name}</h1>
          <div className="pvmeta">
            <span className={'pvav ' + (ok ? 'ok' : 'no')}>{ok ? 'متوفر — جاهز للاستلام' : 'مش متوفر دلوقتي — بالحجز'}</span>
            {p.code && <span className="pvcode">كود <b>{p.code}</b></span>}
            {hand && <a className="pvdir" href="#hand">↔️ {HAND_LABEL[hand.hand]}</a>}
            {brand && <Link className="brandl" href={`/brand/${brand.slug}`}>🏷️ {brand.name}</Link>}
          </div>
          <div className="pvbuy">
            <div className="pvbuy-p"><small>السعر</small><b>بيتحدد حسب الكمية</b></div>
            <button type="button" className="pvpbtn" onClick={() => open({ kind: 'price', lines: [{ item, q }] })}>💬 ابعتلي السعر</button>
            <a className="pvask" target="_blank" rel="noopener" href={waUrl(site, orderText(p))}>📲 اطلب على الواتساب</a>
            {!ok && <button className="nm" onClick={() => open({ kind: 'notify', item })}>🔔 نبّهني لما يتوفر</button>}
          </div>
          <ul className="pvtrust">
            <li><i>💬</i>رد سريع على الواتساب</li>
            <li><i>🚚</i>توصيل القاهرة والجيزة</li>
            <li><i>📍</i>أرض اللواء – الجيزة</li>
          </ul>
          {hand && <HandGuide info={hand} name={p.name} />}
          {p.desc && (
            <Acc title="📋 المواصفات والتفاصيل" open>
              {specs.text && <div className="pvdesc" style={specs.rows.length ? { marginBottom: 8 } : undefined}>{specs.text}</div>}
              {specs.rows.length > 0 && <table className="pvspec"><tbody>{specs.rows.map(([k, v], j) => <tr key={j}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>}
            </Acc>
          )}
          <Acc title="🚚 يوصلك إمتى؟ والشحن">
            <DeliveryEta ok={ok} />
            <button type="button" className="shipbtn" onClick={() => open({ kind: 'ship' })}>اعرف تفاصيل الشحن والتوصيل</button>
          </Acc>
          {vid && (
            <Acc title="🎬 فيديو المنتج">
              {vid.kind === 'youtube' ? <iframe src={`https://www.youtube-nocookie.com/embed/${vid.id}`} loading="lazy" title={p.name} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                : vid.kind === 'file' ? <video src={vid.url} controls preload="metadata" playsInline />
                  : <a className="pvask" target="_blank" rel="noopener" href={vid.url}>▶️ شوف الفيديو</a>}
            </Acc>
          )}
          {install && <a className="instl" href={install.href} {...(install.ext ? { target: '_blank', rel: 'noopener' } : {})}>🔧 إزاي يتركّب؟ {install.ext ? 'دليل التركيب' : 'خطوات التركيب'}</a>}
          <Link className="instl" href="/help">🙋 محتاج حد يركّبها؟ نرشّحلك حد مستقل</Link>
          <Acc title="⭐ آراء اللي اشتروه">
            <ProductReviews id={p.id} name={p.name} />
          </Acc>
          <div className="pvtools" role="group" aria-label="أدوات">
            <button type="button" onClick={share}><i>⤴️</i>مشاركة</button>
            <a target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(`شوف ده من ميكانيزم: ${p.name}\n${productUrl(p.id)}`)}><i>📤</i>للصاحب</a>
            <CompareBtn id={p.id} />
            {phone && <a href={'tel:' + String(phone).replace(/\s/g, '')}><i>📞</i>اتصل</a>}
            <button type="button" onClick={() => print()}><i>🖨️</i>اطبع</button>
          </div>
          {sim.length > 0 && (
            <div className="pvbox">
              <h2>منتجات مشابهة</h2>
              <div className="pvsim">{sim.map(x => (
                <Link key={x.id} href={productPath(x.id)}>
                  <span className="im">{x.img ? <Image src={x.img} alt="" fill sizes="130px" style={{ objectFit: 'contain' }} /> : <Placeholder />}</span>
                  {x.name}
                </Link>
              ))}</div>
            </div>
          )}
          {comp.length > 0 && (
            <div className="pvbox">
              <h2>🧩 تكمّل بيها الشغل</h2>
              <div className="pvsim">{comp.map(x => (
                <Link key={x.id} href={productPath(x.id)}>
                  <span className="im">{x.img ? <Image src={x.img} alt="" fill sizes="130px" style={{ objectFit: 'contain' }} /> : <Placeholder />}</span>
                  {x.name}
                </Link>
              ))}</div>
            </div>
          )}
          {works.length > 0 && (
            <div className="pvbox">
              <h2>🏗️ اتركّب في شغلنا</h2>
              <div className="pvsim">{works.map(w => (
                <Link key={w.i} href="/works">
                  <span className="im">{w.img && <Image src={w.img} alt="" fill sizes="130px" style={{ objectFit: 'cover' }} />}</span>
                  {w.title}
                </Link>
              ))}</div>
            </div>
          )}
          {(prev || next) && (
            <nav className="pnx" aria-label="منتجات القسم">
              {prev ? <Link href={productPath(prev.id)} rel="prev"><small>› اللي قبله</small>{prev.name}</Link> : <span />}
              {next ? <Link href={productPath(next.id)} rel="next"><small>اللي بعده ‹</small>{next.name}</Link> : <span />}
            </nav>
          )}
          <a className="mkstl" href={`/story?p=${encodeURIComponent(p.id)}`}>🎬 المنتج بالتفصيل</a>
        </div>
      </div>
      <div className="pvbar">
        <div className="pvq">
          <button onClick={() => setQ(v => v + 1)} aria-label="زيادة">+</button>
          <b aria-live="polite">{q}</b>
          <button onClick={() => setQ(v => Math.max(1, v - 1))} aria-label="نقص">−</button>
        </div>
        <button className={'pvadd' + (ok ? '' : ' bo')} onClick={() => { add(item, q); setQ(1); evProduct('add_to_cart', 'AddToCart', p); }}>
          {n ? `✔ في طلبك (${n}) — أضف كمان` : ok ? '➕ أضف للطلب' : '📦 اطلبه — هيوصلك لما يتوفر'}
        </button>
        {n > 0 && <button className="pvcart" onClick={() => open({ kind: 'cart' })}>🛒 طلبي</button>}
      </div>
    </>
  );
}
