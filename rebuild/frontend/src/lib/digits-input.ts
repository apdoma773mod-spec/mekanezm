/**
 * 🔢 قاعدة النظام كله: أي خانة أرقام (سعر، كمية، موبايل، كود…) الرقم فيها بيتكتب إنجليزي
 * حتى لو كيبورد الآيفون أو الكمبيوتر عربي (٠١٢٣ → 0123، الفاصلة العربي «،» والـ«٫» → نقطة عشرية).
 * بيتركّب مرة واحدة على الصفحة كلها، فأي خانة جديدة بتاخد القاعدة لوحدها من غير ما نفتكر نضيفها.
 *
 * - الخانة «رقمية» لو type=number/tel أو inputMode=numeric/decimal/tel أو data-num.
 * - beforeinput: بيمسك الحرف قبل ما يتكتب (الأهم: type=number في سفاري مابتقبلش الأرقام العربي أصلاً).
 * - input: شبكة أمان للّصق والإملاء ولوحات المفاتيح اللي مابتبعتش beforeinput بالبيانات.
 */
const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';
const HAS = /[٠-٩۰-۹٫٬،]/;
const NUMERIC_HINT = /سعر|كمي|عدد|رقم|موبايل|تليفون|هاتف|كود|باركود|مبلغ|فلوس|خصم|نسبة|price|qty|phone|amount/i;

export const toLatinNumber = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٫،]/g, '.')
    .replace(/٬/g, '');

type El = HTMLInputElement | HTMLTextAreaElement;
const isNumeric = (el: EventTarget | null): el is El => {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement && ['number', 'tel'].includes(el.type)) return true;
  const m = (el.getAttribute('inputmode') || '').toLowerCase();
  if (m === 'numeric' || m === 'decimal' || m === 'tel' || el.hasAttribute('data-num')) return true;
  // خانات نصية بس معروف من اسمها إنها أرقام (سعر، كمية، موبايل، كود…)
  return el instanceof HTMLInputElement && el.type === 'text' && NUMERIC_HINT.test(`${el.placeholder} ${el.name} ${el.getAttribute('aria-label') ?? ''}`);
};

const setValue = (el: El, v: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

export function installDigitNormalizer(): () => void {
  let busy = false;
  const before = (e: Event) => {
    const ev = e as InputEvent;
    const el = ev.target;
    if (busy || !isNumeric(el)) return;
    const raw = ev.data ?? ev.dataTransfer?.getData('text') ?? '';
    if (!raw || !HAS.test(raw)) return;
    const fixed = toLatinNumber(raw);
    ev.preventDefault();
    busy = true;
    try {
      // execCommand بيحافظ على مكان المؤشر والتراجع (ctrl+z) وبيطلّع حدث input عادي لـ React
      if (!document.execCommand('insertText', false, fixed)) {
        const s = el.selectionStart ?? el.value.length;
        const t = el.selectionEnd ?? s;
        setValue(el, el.value.slice(0, s) + fixed + el.value.slice(t));
        try {
          el.setSelectionRange(s + fixed.length, s + fixed.length);
        } catch {
          /* type=number مابتدعمش المؤشر */
        }
      }
    } finally {
      busy = false;
    }
  };
  const after = (e: Event) => {
    const el = e.target;
    if (busy || !isNumeric(el) || !HAS.test(el.value)) return;
    const pos = el.selectionStart;
    busy = true;
    try {
      setValue(el, toLatinNumber(el.value));
      if (pos != null) {
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      }
    } finally {
      busy = false;
    }
  };
  document.addEventListener('beforeinput', before, true);
  document.addEventListener('input', after, true);
  return () => {
    document.removeEventListener('beforeinput', before, true);
    document.removeEventListener('input', after, true);
  };
}
