'use client';
import Image from 'next/image';
import { useState } from 'react';
import { scrapContact, scrapReport } from '@/lib/api';
import { COND, ago, priceText, sizeText, titleOf, type Hit, type Scrap } from '@/lib/scraps';
import { proWa } from '@/lib/pros';
import { ev } from '@/lib/track';

/** One offcut. «اطلبها» reveals the owner's name / phone only when tapped (so numbers are not scraped from the page). */
export function ScrapCard({ s, hit, want }: { s: Scrap; hit?: Hit; want?: string }) {
  const [c, setC] = useState<{ name: string; phone: string; area: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [rep, setRep] = useState(false);
  async function reveal() {
    setMsg('⏳…');
    const r = await scrapContact(s.id);
    if (!r.ok || !r.data) return setMsg('الفضلة دي اتباعت أو اتشالت');
    setC(r.data); setMsg('');
    ev('contact', 'Contact', { method: 'scrap_reveal', item: s.id });
  }
  async function report() {
    if (!window.confirm('تبلّغ عن الإعلان ده؟')) return;
    await scrapReport(s.id, 'user'); setRep(true);
  }
  const text = `أهلاً ${c?.name ?? ''}، شفت فضلة (${titleOf(s)} — ${sizeText(s)}) على موقع ميكانيزم وعايزها${want ? '. محتاج ' + want : ''}. لسه موجودة؟`;
  return (
    <article className={'scrap' + (hit ? ' l' + hit.level : '')}>
      {hit && <span className={'sc-tag t' + hit.level}>{hit.level === 1 ? '✔ ' : hit.level === 2 ? '≈ ' : '◐ '}{hit.why}</span>}
      <div className="sc-body">
        <span className="sc-im">{s.imgs[0] ? <Image src={s.imgs[0]} alt={titleOf(s)} fill sizes="96px" style={{ objectFit: 'cover' }} /> : <i>{s.category === 'alu' ? '🪟' : s.category === 'solid' ? '🌳' : '🪵'}</i>}</span>
        <div className="sc-t">
          <b>{titleOf(s)}</b>
          <span className="sc-size">{sizeText(s)}{s.qty > 1 ? ` · ${s.qty} حتة` : ''}</span>
          <small>{COND[s.cond]}{s.edge ? ' · متقفّلة حرف' : ''}{s.grain ? ' · ليها اتجاه عرق' : ''} · {priceText(s)}</small>
          <small>📍 {s.area || 'مش محدد'} · {ago(s.created_at)}</small>
        </div>
      </div>
      {s.note && <p className="sc-note">{s.note}</p>}
      {c ? (
        <div className="sc-contact">
          <b>{c.name}</b>{c.area && <span> · {c.area}</span>}
          <div className="pro-act">
            <a className="pri" href={proWa(c.phone, text)} target="_blank" rel="noopener" onClick={() => ev('contact', 'Contact', { method: 'scrap_wa' })}>💬 واتساب</a>
            <a className="sec" href={'tel:' + c.phone} onClick={() => ev('contact', 'Contact', { method: 'scrap_tel' })}>📞 {c.phone}</a>
          </div>
          <small className="mut">اتفقوا بينكم على السعر والاستلام أو الشحن. ميكانيزم مش طرف في البيع.</small>
        </div>
      ) : (
        <div className="sc-act">
          <button type="button" className="pri" onClick={reveal}>📞 اطلبها</button>
          <button type="button" className="lnk" onClick={report} disabled={rep}>{rep ? 'تم البلاغ' : '⚑ بلّغ'}</button>
        </div>
      )}
      {msg && <p className="err" aria-live="polite">{msg}</p>}
    </article>
  );
}
