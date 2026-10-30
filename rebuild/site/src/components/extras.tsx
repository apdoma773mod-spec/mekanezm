'use client';
// Product-page extras: reviews of this product and the «قارن» list.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listReviews, type Review } from '@/lib/api';
import { useShop } from './shop-provider';

const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

export function ProductReviews({ id, name }: { id: string; name: string }) {
  const { open } = useShop();
  const [L, setL] = useState<Review[] | null>(null);
  useEffect(() => { listReviews(id).then(setL); }, [id]);
  const avg = L?.length ? L.reduce((s, x) => s + x.rating, 0) / L.length : 0;
  return (
    <div className="pvbox">
      <h2>⭐ آراء اللي اشتروه{L?.length ? <small> — {avg.toFixed(1)} من 5 ({L.length})</small> : null}</h2>
      {L && (L.length
        ? <div className="mkrv">{L.slice(0, 6).map((x, i) => <div key={i}><div className="s" aria-label={`${x.rating} من 5`}>{stars(x.rating)}</div>{x.body && <p>{x.body}</p>}<small>— {x.name}</small></div>)}</div>
        : <p className="mut" style={{ margin: '0 0 6px' }}>لسه محدش قيّم المنتج ده — جرّبته؟ قولنا رأيك.</p>)}
      <button className="mkrbtn" onClick={() => open({ kind: 'review', product: { id, name } })}>✍️ قيّم المنتج</button>
    </div>
  );
}

const CK = 'mk_cmp';
export const readCompare = (): string[] => { try { const a = JSON.parse(localStorage.getItem(CK) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 3) : []; } catch { return []; } };
export const writeCompare = (a: string[]) => { try { localStorage.setItem(CK, JSON.stringify(a.slice(0, 3))); } catch { /* */ } };

/** Adds the product to a compare list (max 3) and offers to open the comparison. */
export function CompareBtn({ id }: { id: string }) {
  const { say } = useShop();
  const router = useRouter();
  const [inList, setIn] = useState(false);
  useEffect(() => { setIn(readCompare().includes(id)); }, [id]);
  const go = () => {
    let a = readCompare();
    a = inList ? a.filter(x => x !== id) : [...a.filter(x => x !== id), id].slice(-3);
    writeCompare(a);
    setIn(!inList);
    if (inList) return say('اتشال من المقارنة');
    if (a.length < 2) return say('✔ اتضاف للمقارنة — افتح منتج تاني ودوس «قارن»');
    say(`✔ في المقارنة ${a.length === 2 ? 'منتجين' : '٣ منتجات'}`, () => router.push('/compare?i=' + a.map(encodeURIComponent).join(',')), 'قارن دلوقتي');
  };
  return <button type="button" className={'cmpb' + (inList ? ' on' : '')} onClick={go} aria-pressed={inList}>⚖️ {inList ? 'في المقارنة' : 'قارن مع منتج تاني'}</button>;
}
