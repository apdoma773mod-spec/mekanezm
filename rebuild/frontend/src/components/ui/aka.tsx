import type { ProductDto } from '@mk/shared';

/**
 * 🔁 اسم الصنف عند المورد، باهت تحت اسمنا في نتايج البحث (اسمنا هو الأساسي).
 * الأسماء بتتحفظ لوحدها من «راجع بنود الفاتورة» في فاتورة الشراء.
 */
export function Aka({ p }: { p: Pick<ProductDto, 'aka' | 'kit' | 'kitParts'> }) {
  if (!p.aka?.length && !p.kit && !p.kitParts) return null;
  return (
    <>
      {p.kit && (
        <small className="mk-aka mk-kit" title="القطعة دي من طقم — لو رصيدها خلص السيستم بيفك طقم لوحده وقت البيع">
          🧩 من «{p.kit.name}» — {p.kit.qty > 0 ? `${Math.floor(p.kit.qty)} طقم مقفول (الطقم فيه ${p.kit.n})` : 'مفيش أطقم مقفولة'}
        </small>
      )}
      {p.kitParts ? (
        <small className="mk-aka mk-kit" title="طقم بيتباع بالقطعة">
          🧩 طقم بيتباع بالقطعة
        </small>
      ) : null}
      {p.aka?.length ? (
        <small className="mk-aka" title="اسم الصنف عند المورد">
          ↔ {p.aka.join(' · ')}
        </small>
      ) : null}
    </>
  );
}

/** Text to search in: our name, code and the suppliers' names (client-side filters). */
export const akaHay = (p: Pick<ProductDto, 'name' | 'code' | 'aka'>) => `${p.name} ${p.code || ''} ${(p.aka ?? []).join(' ')}`;
