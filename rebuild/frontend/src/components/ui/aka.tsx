import type { ProductDto } from '@mk/shared';

/**
 * 🔁 اسم الصنف عند المورد، باهت تحت اسمنا في نتايج البحث (اسمنا هو الأساسي).
 * الأسماء بتتحفظ لوحدها من «راجع بنود الفاتورة» في فاتورة الشراء.
 */
export function Aka({ p }: { p: Pick<ProductDto, 'aka'> }) {
  if (!p.aka?.length) return null;
  return (
    <small className="mk-aka" title="اسم الصنف عند المورد">
      ↔ {p.aka.join(' · ')}
    </small>
  );
}

/** Text to search in: our name, code and the suppliers' names (client-side filters). */
export const akaHay = (p: Pick<ProductDto, 'name' | 'code' | 'aka'>) => `${p.name} ${p.code || ''} ${(p.aka ?? []).join(' ')}`;
