// معاينة اتجاه الفتح جوه السيستم: كلام بسيط (الموشن المتحرك نفسه بيظهر للزبون على الموقع).
import { HAND_LABEL, KIND_LABEL, type Hand, type HandKind } from './lib/hand';

export function HandDiagram({ hand, kind }: { hand: Hand; kind: Exclude<HandKind, 'other'> }) {
  return (
    <p className="mut" style={{ margin: '6px 0 0' }}>
      الزبون هيشوف رسم متحرك لـ <b>{KIND_LABEL[kind]}</b> اتجاه <b>{HAND_LABEL[hand]}</b> في صفحة المنتج على الموقع.
    </p>
  );
}
