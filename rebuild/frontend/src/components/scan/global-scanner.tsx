'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { lookupProduct } from '@/lib/trade-queries';
import { useModal } from '../modals/modal-host';
import { useToast } from '../ui/toast';

/*
 * 📟 جهاز الباركود من أي شاشة (زي القديم):
 * - جهاز البلوتوث بيكتب الكود بسرعة ويبعت Enter → بنقرا الكود.
 * - لو المؤشر في خانة كتابة عادية → بنسيب الخانة تاخد الكود زي ما هو (ماتتلخبطش).
 * - الكود بيتبحث: صنف → كارت الصنف السريع. مش متسجل → رسالة.
 * - الحروف بتتقري من مكان الزرار (e.code) عشان الكيبورد العربي يبقى تمام.
 */
const GAP_MS = 90; // أجهزة البلوتوث الرخيصة أبطأ شوية؛ الكتابة العادية أبطأ بكتير
const MIN_LEN = 3;

const CODE_KEYS: Record<string, string> = {
  Minus: '-', NumpadSubtract: '-', Period: '.', NumpadDecimal: '.', Slash: '/', NumpadDivide: '/',
};

function charOf(e: KeyboardEvent): string | null {
  if (CODE_KEYS[e.code]) return CODE_KEYS[e.code];
  const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
  if (d) return d[1];
  const l = /^Key([A-Z])$/.exec(e.code || '');
  if (l) return l[1];
  return /^[\x21-\x7E]$/.test(e.key || '') ? e.key.toUpperCase() : null;
}

function inTextField(el: Element | null) {
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !(el as HTMLInputElement).readOnly;
}

export function GlobalScanner() {
  const { open } = useModal();
  const toast = useToast();

  useEffect(() => {
    let buf = '';
    let t0 = 0;
    let last = 0;
    let bad = false;
    let focusOnStart: Element | null = null;

    const route = async (code: string) => {
      // كود فاتورة (MK-0001 / SH-0001 …) يفتح الفاتورة
      const m = /^(MK|SH|QT|SP)-?(\d+)$/.exec(code);
      if (m) {
        const no = `${m[1]}-${m[2].padStart(4, '0')}`;
        try {
          const r = await api.get<{ items: { id: string; no: string }[] }>('/invoices', { q: no, pageSize: 5 });
          const hit = r.items.find((i) => i.no === no);
          if (hit) {
            open({ kind: 'invoice', id: hit.id });
            toast(`📟 ${no}`);
            return;
          }
        } catch {
          /* يكمّل يدوّر كصنف */
        }
      }
      try {
        const p = await lookupProduct(code);
        open({ kind: 'productDetails', id: p.id });
        toast(`📟 ${p.name}`);
      } catch {
        toast(`باركود مش متسجل: ${code}`, 'bad');
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = Date.now();
      if (now - last > GAP_MS) {
        buf = '';
        bad = false;
        t0 = now;
        focusOnStart = document.activeElement;
      }
      last = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = buf;
        const dur = now - t0;
        const avg = buf.length > 1 ? dur / (buf.length - 1) : 999;
        buf = '';
        if (bad || avg > GAP_MS || code.length < MIN_LEN) return;
        // في خانة كتابة عادية: سيبها تاخد الكود
        if (inTextField(document.activeElement) || inTextField(focusOnStart)) return;
        if (document.querySelector('#txSearch')) {
          // نافذة بيع/شراء مفتوحة: الكود يتضاف فيها حتى لو المؤشر مش في خانة البحث
          window.dispatchEvent(new CustomEvent('mk:scan', { detail: code }));
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (document.querySelector('.modal')) return; // ما نبدّلش نافذة مفتوحة
        e.preventDefault();
        e.stopPropagation();
        void route(code);
        return;
      }
      if (e.key === 'Shift' || e.key === 'CapsLock') return;
      const c = charOf(e);
      if (c) buf += c;
      else bad = true;
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, toast]);

  return null;
}
