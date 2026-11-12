/**
 * 🗂️ طي الشاشات الطويلة أوتوماتيك (من غير ما نغيّر أي شاشة واحدة واحدة).
 *
 * القاعدة: لو جوه نفس المكان ٣ كروت أو أكتر كل واحد أول حاجة فيه عنوان (h3)، الشاشة طويلة — فكل كارت بيتلم
 * وبيفضل عنوانه (فيه الأيقونة) باين وجنبه سهم. دوسة على العنوان تفتحه، ودوسة تانية تلمّه.
 * - الحقول والأزرار جوه الكارت مابتتشالش ولا بتتغيّر؛ بتتخبّى بس (CSS في globals: [data-af]).
 * - مكان فيه كارت أو اتنين (القايمة الأساسية للصفحة) مابيتلمّش.
 * - كارت فيه حقل واقف عليه المؤشر، أو حقل فيه خطأ، أو عليه data-af-keep، بيفضل مفتوح.
 * - ممنوع الطي جوه: details.mk-fold، أيقونات Tiles، وأي مكان عليه data-nofold، وصفحات الشغل اللي بتتسجل فيها
 *   فواتير (NO_FOLD_PATHS) عشان الكاشير مايدورش على الحقول.
 * - الحالة (مفتوح/مقفول) بتتفتكر لحد ما الصفحة تتقفل، بمفتاح = المسار + عنوان الكارت.
 */
export const NO_FOLD_PATHS = ['/sales', '/login'];
const CARD = '.card,.pc-card,.sec,.sp-card,section.card';
const MIN_SIBLINGS = 3;
const KEY = 'mkAutoFold';

type Store = Record<string, '0' | '1'>;
const read = (): Store => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
};
const write = (s: Store) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين مقفول: الطي شغال، بس مابيفتكرش */
  }
};

const headOf = (el: Element): HTMLElement | null => {
  const h = el.firstElementChild;
  return h && h.tagName === 'H3' ? (h as HTMLElement) : null;
};
const keyOf = (el: Element, h: HTMLElement) => `${location.pathname}|${(h.textContent || '').trim().slice(0, 60)}`;

const blocked = (el: Element) => !!el.closest('details.mk-fold,.mk-tile-b,[data-nofold]');

/** الكارت لازم يفضل مفتوح: فيه مؤشر، أو حقل بخطأ، أو متعلّم يدويًا. */
const mustStayOpen = (el: Element) => {
  if (el.hasAttribute('data-af-keep')) return true;
  const a = document.activeElement;
  if (a && a !== document.body && el.contains(a)) return true;
  return !!el.querySelector('[aria-invalid="true"],.err:not(:empty),.bad');
};

export function applyAutoFold(root: ParentNode = document) {
  if (NO_FOLD_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) return;
  const store = read();
  const parents = new Set<Element>();
  root.querySelectorAll(CARD).forEach((el) => {
    if (el.parentElement && !blocked(el) && headOf(el)) parents.add(el.parentElement);
  });
  parents.forEach((p) => {
    const cards = Array.from(p.children).filter((c) => c.matches(CARD) && headOf(c) && !blocked(c));
    if (cards.length < MIN_SIBLINGS) return;
    for (const c of cards) {
      if (c.hasAttribute('data-af')) continue;
      const h = headOf(c)!;
      const k = keyOf(c, h);
      const open = store[k] === '1' || mustStayOpen(c);
      c.setAttribute('data-af', open ? '1' : '0');
      h.setAttribute('role', 'button');
      h.setAttribute('tabindex', '0');
      h.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  });
}

const toggle = (h: HTMLElement) => {
  const c = h.parentElement;
  if (!c || !c.hasAttribute('data-af')) return;
  const open = c.getAttribute('data-af') !== '1';
  c.setAttribute('data-af', open ? '1' : '0');
  h.setAttribute('aria-expanded', open ? 'true' : 'false');
  const s = read();
  s[keyOf(c, h)] = open ? '1' : '0';
  write(s);
};

/** بيركّب الطي على الصفحة كلها (بما فيها النوافذ)، وبيتابع أي شاشة جديدة بتتفتح. بيرجّع دالة الفك. */
export function installAutoFold(): () => void {
  let raf = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => applyAutoFold(document));
  };
  const onClick = (e: Event) => {
    const t = e.target as Element | null;
    const h = t?.closest('[data-af]>h3:first-child') as HTMLElement | null;
    if (!h) return;
    // دوسة على زرار أو لينك أو حقل جوه العنوان ماتطويش الكارت
    const hit = t!.closest('button,a,input,select,textarea,label');
    if (hit && h.contains(hit) && hit !== h) return;
    toggle(h);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const h = (e.target as Element | null)?.closest?.('[data-af]>h3:first-child') as HTMLElement | null;
    if (h && e.target === h) {
      e.preventDefault();
      toggle(h);
    }
  };
  const mo = new MutationObserver(run);
  mo.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  run();
  return () => {
    mo.disconnect();
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
  };
}
