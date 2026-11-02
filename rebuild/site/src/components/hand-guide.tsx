'use client';
// «↔️ يمين ولا شمال؟»: the motion graphic of this product's direction + a one-question picker that tells the customer which
// version to take. The motion template is chosen by the product type (see lib/hand.ts), or the owner's own media replaces it.
import Link from 'next/link';
import { useState } from 'react';
import { HAND_LABEL, opposite, rulesFor, type Hand, type HandInfo, type HandKind } from '@/lib/hand';
import { productPath, waUrl } from '@/lib/shop';
import { HandMotion } from './hand-motion';
import { useShop } from './shop-provider';

/** The looping motion graphic for one type + direction (used by the product page, the guide article and the admin preview). */
export function HandDiagram({ hand, kind }: { hand: Hand; kind: Exclude<HandKind, 'other'> }) {
  return <HandMotion hand={hand} kind={kind} />;
}

/** Owner-supplied media (GIF / image / short video) shown instead of the built-in motion. */
function Media({ src }: { src: string }) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(src)
    ? <video className="hm-media" src={src} autoPlay loop muted playsInline controls={false} />
    : <img className="hm-media" src={src} alt="" loading="lazy" />;
}

export function HandGuide({ info, name }: { info: HandInfo; name: string }) {
  const { site } = useShop();
  const [side, setSide] = useState<Hand | null>(null);
  const kind = info.kind;
  const T = rulesFor(kind);
  const need = side && T ? T.need(side) : null;
  const want = need ? HAND_LABEL[need] : '';
  return (
    <details className="acc hg" id="hand" open>
      <summary>↔️ يمين ولا شمال؟ اختار الاتجاه الصح</summary>
      <div className="acc-b">
        <p className="hg-this">المنتج ده: <b className={'hg-badge ' + info.hand}>{HAND_LABEL[info.hand]}</b></p>
        {info.media ? <Media src={info.media} /> : kind !== 'other' && <HandDiagram hand={info.hand} kind={kind} />}
        {T && <>
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
