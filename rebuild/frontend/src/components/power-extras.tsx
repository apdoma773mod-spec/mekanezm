'use client';

import { useEffect, useState } from 'react';
import { useModal } from './modals/modal-host';

/**
 * إضافات القوة (طلب صاحب المحل: ١٠ اقتراحات): شريط النت فاصل، اختصارات الكيبورد على الكمبيوتر،
 * تحذير قبل قفل الصفحة وفيه نافذة مفتوحة، تنبيه بالنسخة الجديدة، وزرار «لفوق» على الموبايل.
 */

/** 🔌 النت فاصل: شريط أحمر ثابت لحد ما النت يرجع، وبعدها «✔ النت رجع» شوية. */
function OfflineBar() {
  const [state, setState] = useState<'on' | 'off' | 'back'>('on');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = () => setState('off');
    const on = () => {
      setState('back');
      clearTimeout(t);
      t = setTimeout(() => setState('on'), 4000);
    };
    if (!navigator.onLine) off();
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      clearTimeout(t);
    };
  }, []);
  if (state === 'on') return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom,0px))',
        left: 12,
        right: 12,
        zIndex: 99995,
        padding: '12px 14px',
        borderRadius: 14,
        fontWeight: 800,
        textAlign: 'center',
        color: '#fff',
        background: state === 'off' ? '#c0392b' : '#159447',
        boxShadow: '0 6px 20px #0004',
      }}
    >
      {state === 'off' ? '⚠️ النت فاصل — استنى لما يرجع قبل ما تسجّل أي حاجة' : '✔ النت رجع'}
    </div>
  );
}

/** ⌨️ اختصارات الكمبيوتر: F2 بيع، F3 شراء، F4 مصروف، F8 أمر صوتي، F9 إضافة سريعة. */
function Shortcuts() {
  const { open } = useModal();
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const map: Record<string, () => void> = {
        F2: () => open({ kind: 'transaction', type: 'SALE' }),
        F3: () => open({ kind: 'transaction', type: 'PURCHASE' }),
        F4: () => open({ kind: 'expense' }),
        F8: () => open({ kind: 'voice' }),
        F9: () => open({ kind: 'quick' }),
      };
      const f = map[e.key];
      if (!f || document.querySelector('.modal')) return; // never replace a window that is being filled
      e.preventDefault();
      f();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  return null;
}

/** 🛡️ لو فيه نافذة مفتوحة (فاتورة بتتكتب مثلاً) والصفحة هتتقفل أو تتعمل لها تحديث: المتصفح يسأل الأول. */
function LeaveGuard() {
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      const m = document.querySelector('.modal');
      if (!m) return;
      const typed = Array.from(m.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')).some((i) => i.value && i.value !== i.defaultValue);
      if (!typed) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, []);
  return null;
}

/** 🔄 لما تتنزل نسخة جديدة من السيستم: شريط صغير «اضغط للتحديث» بدل ما يفضل شغال على القديمة. */
function NewVersion() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const sig = (html: string) => (html.match(/\/_next\/static\/chunks\/main-app-[\w-]+\.js/) || [''])[0];
    const mine = Array.from(document.scripts)
      .map((s) => s.src)
      .find((s) => /main-app-/.test(s));
    if (!mine) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const html = await (await fetch('/login', { cache: 'no-store' })).text();
        const s = sig(html);
        if (s && !mine.includes(s)) setFresh(true);
      } catch {
        /* offline: try later */
      }
    };
    const t = setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (!fresh) return null;
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      style={{ position: 'fixed', top: 'calc(10px + env(safe-area-inset-top,0px))', left: 12, zIndex: 99996, padding: '10px 14px', borderRadius: 999, border: 0, fontWeight: 800, background: '#087f8c', color: '#fff', boxShadow: '0 6px 20px #0004' }}
    >
      🔄 فيه نسخة جديدة — اضغط للتحديث
    </button>
  );
}

/** ⬆️ زرار «لفوق» في الصفحات الطويلة على الموبايل. */
function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(window.scrollY > 1200);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="لفوق"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{ position: 'fixed', bottom: 'calc(160px + env(safe-area-inset-bottom,0px))', right: 14, zIndex: 9000, width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--card,#fff)', fontSize: 20, boxShadow: '0 4px 14px #0003' }}
    >
      ⬆️
    </button>
  );
}

/**
 * Old «أرقام عربي/إنجليزي في كل الخانات الرقمية»: with an Arabic keyboard, ٠١٢٣ typed in any box becomes 0123
 * (number boxes become text boxes with the number keypad, like the old fixNum, because Chrome drops Arabic digits there).
 */
function EnglishDigits() {
  useEffect(() => {
    const fixNum = (el: Element) => {
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.type = 'text';
        el.setAttribute('inputmode', 'decimal');
        el.removeAttribute('min');
        el.removeAttribute('step');
      }
    };
    document.querySelectorAll('input[type=number]').forEach(fixNum);
    const mo = new MutationObserver((ms) =>
      ms.forEach((m) =>
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          fixNum(n as Element);
          (n as Element).querySelectorAll?.('input[type=number]').forEach(fixNum);
        }),
      ),
    );
    mo.observe(document.body, { childList: true, subtree: true });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const onInput = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !/[٠-٩۰-۹]/.test(t.value)) return;
      let v = t.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
      // number boxes: Arabic decimal comma too
      if (t.getAttribute('inputmode') === 'decimal' || t.getAttribute('inputmode') === 'numeric') v = v.replace(/[٫،]/g, '.');
      const pos = t.selectionStart;
      // the native setter (not React's) so React still sees the change in this same event
      setter.call(t, v);
      if (pos != null) {
        try {
          t.setSelectionRange(pos, pos);
        } catch {
          /* some input types have no caret */
        }
      }
    };
    document.addEventListener('input', onInput, true);
    return () => {
      mo.disconnect();
      document.removeEventListener('input', onInput, true);
    };
  }, []);
  return null;
}

export function PowerExtras() {
  return (
    <>
      <EnglishDigits />
      <OfflineBar />
      <Shortcuts />
      <LeaveGuard />
      <NewVersion />
      <ToTop />
    </>
  );
}
