'use client';
// «↔️ يمين ولا شمال؟»: a drawing of this product's direction + a one-question picker that tells the customer which version to take.
import Link from 'next/link';
import { useState } from 'react';
import { CORNER, DOOR, HAND_LABEL, opposite, type Hand, type HandInfo } from '@/lib/hand';
import { productPath, waUrl } from '@/lib/shop';
import { useShop } from './shop-provider';

/** Front view of the cabinet. «corner»: fixed part on one side, the trays come out toward the other. «door»: hinges on one side. */
export function HandDiagram({ hand, kind }: { hand: Hand; kind: 'corner' | 'door' }) {
  const mir = hand === 'L' ? 'translate(320,0) scale(-1,1)' : undefined;
  const fixedX = hand === 'R' ? 52 : 268, outX = hand === 'R' ? 255 : 65;
  const id = `hd-${kind}-${hand}`;
  return (
    <figure className="hd">
      <svg viewBox="0 0 320 196" role="img" aria-label={`${kind === 'corner' ? 'ماجيك كورنر' : 'ضلفة'} ${HAND_LABEL[hand]}`}>
        <defs>
          <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#8a97a3" strokeWidth="2.2" /></pattern>
          <marker id={id + 'a'} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e11d48" /></marker>
        </defs>
        <rect x="14" y="30" width="292" height="10" rx="3" fill="#c9a36a" />
        <rect x="14" y="40" width="292" height="132" fill="#f7f8fa" stroke="#3b4652" strokeWidth="2.5" />
        <line x1="6" y1="172" x2="314" y2="172" stroke="#3b4652" strokeWidth="3" />
        <g transform={mir}>
          {kind === 'corner' ? <>
            <rect x="14" y="40" width="76" height="132" fill={`url(#${id})`} stroke="#3b4652" strokeWidth="2" />
            <ellipse cx="205" cy="92" rx="76" ry="16" fill="#dfe6ee" stroke="#3b4652" strokeWidth="2.2" />
            <ellipse cx="205" cy="128" rx="76" ry="16" fill="#cfd8e2" stroke="#3b4652" strokeWidth="2.2" />
            <line x1="110" y1="64" x2="292" y2="64" stroke="#e11d48" strokeWidth="3.5" markerEnd={`url(#${id}a)`} />
          </> : <>
            <rect x="228" y="40" width="78" height="132" fill="#e8eef4" stroke="#3b4652" strokeWidth="2.2" />
            <circle cx="300" cy="62" r="5" fill="#3b4652" /><circle cx="300" cy="150" r="5" fill="#3b4652" />
            <rect x="236" y="96" width="5" height="28" rx="2" fill="#3b4652" />
            <line x1="216" y1="106" x2="64" y2="106" stroke="#e11d48" strokeWidth="3.5" markerEnd={`url(#${id}a)`} />
          </>}
        </g>
        {kind === 'corner' ? <>
          <text x={fixedX} y="24" textAnchor="middle" className="hd-t">الجزء الثابت</text>
          <text x={outX} y="190" textAnchor="middle" className="hd-t r">الصواني بتطلع ↓</text>
        </> : <>
          <text x={hand === 'R' ? 267 : 53} y="24" textAnchor="middle" className="hd-t">المفصلات</text>
          <text x={hand === 'R' ? 115 : 205} y="190" textAnchor="middle" className="hd-t r">الضلفة بتفتح</text>
        </>}
      </svg>
      <figcaption><b>{HAND_LABEL[hand]}</b></figcaption>
    </figure>
  );
}

export function HandGuide({ info, name }: { info: HandInfo; name: string }) {
  const { site } = useShop();
  const [side, setSide] = useState<Hand | null>(null);
  const kind = info.kind === 'door' ? 'door' : info.kind === 'corner' ? 'corner' : null;
  const T = kind === 'door' ? DOOR : CORNER;
  const need = side && kind ? T.need(side) : null;
  const want = need ? HAND_LABEL[need] : '';
  return (
    <details className="acc hg" id="hand" open>
      <summary>↔️ يمين ولا شمال؟ اختار الاتجاه الصح</summary>
      <div className="acc-b">
        <p className="hg-this">المنتج ده: <b className={'hg-badge ' + info.hand}>{HAND_LABEL[info.hand]}</b></p>
        {kind && <>
          <HandDiagram hand={info.hand} kind={kind} />
          <p className="hg-rule">{T.rule(info.hand)}.</p>
          <div className="hg-q">
            <b>{T.ask}</b>
            <div>
              <button type="button" className={side === 'L' ? 'on' : ''} onClick={() => setSide('L')}>⬅️ على الشمال</button>
              <button type="button" className={side === 'R' ? 'on' : ''} onClick={() => setSide('R')}>على اليمين ➡️</button>
            </div>
          </div>
          {need && (need === info.hand
            ? <p className="hg-ok">✔ المنتج ده هو الصح ليك ({HAND_LABEL[info.hand]}).</p>
            : <div className="hg-no">
              <p>⚠️ انت محتاج النسخة <b>{want}</b>، والمنتج ده <b>{HAND_LABEL[info.hand]}</b>.</p>
              {info.pair ? <Link className="pri" href={productPath(info.pair.id)}>افتح النسخة {want} ←</Link>
                : <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، محتاج ${name.replace(/(شمال|يسار|يمين)/g, '').trim()} اتجاه ${want}`)}>💬 اطلب النسخة {want} على الواتساب</a>}
            </div>)}
        </>}
        {info.note && <p className="hg-note">{info.note}</p>}
        {!need && info.pair && <p className="hg-pair">فيه كمان نسخة <Link href={productPath(info.pair.id)}>{HAND_LABEL[opposite(info.hand)]}</Link>.</p>}
        <p className="hg-more"><Link href="/guide/left-or-right">📘 اقرا الشرح كامل بالرسم</Link> · <a target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، مش متأكد من اتجاه ${name}`)}>💬 مش متأكد؟ كلّمنا</a></p>
      </div>
    </details>
  );
}
