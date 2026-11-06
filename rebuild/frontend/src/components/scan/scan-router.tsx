'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ProductDto } from '@mk/shared';
import { api } from '@/lib/api';
import { lookupProduct } from '@/lib/trade-queries';
import { useModal } from '../modals/modal-host';
import { Modal } from '../ui/modal';
import { useIsAdmin } from '../use-role';
import { CameraScanner } from './camera-scanner';
import { SCAN_EVENT, scanTargets } from './scan-bus';

/**
 * 📟 منظومة الباركود الذكية (جهاز الباركود بيشتغل من أي شاشة، زي القديم): الجهاز بيكتب بسرعة وبيدوس Enter.
 * لو مفيش خانة بتتكتب فيها: كود فاتورة/عرض سعر يفتحها، وكود صنف يتضاف في فاتورة البيع/الشراء المفتوحة أو في اليومية،
 * وفي أي شاشة تانية يطلع كارت سريع للصنف. الخانات اللي ليها معالج باركود بتاعها بنسيبها.
 */
const GAP = 90;
const MINLEN = 3;
const SURE = 35;
const SYS = /^(MK|SH|SP|QT)-?(\d{1,6})$/;
const PUNCT: Record<string, string> = { Minus: '-', NumpadSubtract: '-', Period: '.', NumpadDecimal: '.', Slash: '/', NumpadDivide: '/' };

/** The key's place on the keyboard, so an Arabic layout still reads «MK-0042». */
function keyChar(e: KeyboardEvent): string | null {
  if (PUNCT[e.code]) return PUNCT[e.code];
  let m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
  if (m) return m[1];
  m = /^Key([A-Z])$/.exec(e.code || '');
  if (m) return m[1];
  return /^[\x21-\x7E]$/.test(e.key || '') ? e.key.toUpperCase() : null;
}

const typing = (el: Element | null) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (el as HTMLElement).isContentEditable);

function beep(ok = true) {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new A();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = ok ? 1200 : 220;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    setTimeout(
      () => {
        o.stop();
        void c.close();
      },
      ok ? 90 : 260,
    );
  } catch {
    /* no sound is fine */
  }
}

type Found = { items: { id: string; no: string }[] };

export function ScanRouter() {
  const { open, close } = useModal();
  const path = usePathname();
  const admin = useIsAdmin();
  const [flash, setFlash] = useState<{ t: string; ok: boolean } | null>(null);
  const [card, setCard] = useState<ProductDto | { id: ''; code: string } | null>(null);
  const [cam, setCam] = useState(false);
  const ft = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef({ path, open, close, admin });
  live.current = { path, open, close, admin };

  const say = (t: string, ok = true) => {
    setFlash({ t, ok });
    clearTimeout(ft.current);
    ft.current = setTimeout(() => setFlash(null), 1800);
  };

  const route = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const { open, close, path, admin } = live.current;
    const sys = SYS.exec(code.toUpperCase());
    let p: ProductDto | null = null;
    try {
      p = await lookupProduct(code);
    } catch {
      p = null;
    }
    if (!p && sys) {
      const no = `${sys[1]}-${sys[2].padStart(4, '0')}`;
      try {
        if (sys[1] === 'QT') {
          const q = (await api.get<Found>('/quotes', { q: no, pageSize: 5 })).items.find((x) => x.no.toUpperCase() === no);
          if (q) {
            beep();
            say(`عرض سعر ${no}`);
            return open({ kind: 'quoteView', id: q.id });
          }
        } else if (sys[1] === 'SP') {
          const s = (await api.get<Found>('/shipments', { tab: 'all', q: no })).items.find((x) => x.no.toUpperCase() === no);
          if (s) {
            beep();
            say(`الشحنة ${no}`);
            return open({ kind: 'shipEdit', id: s.id });
          }
        } else {
          const inv = (await api.get<Found>('/invoices', { q: no, pageSize: 5 })).items.find((x) => x.no.toUpperCase() === no);
          if (inv) {
            beep();
            say(`فاتورة ${no}`);
            return open({ kind: 'invoice', id: inv.id });
          }
        }
      } catch {
        /* falls to the message below */
      }
      beep(false);
      return say(`الكود ${no} مش لاقيه — اتأكد إن النت شغال وجرب تاني`, false);
    }
    if (!p) {
      beep(false);
      say(`باركود مش متسجل: ${code}`, false);
      if (admin && !document.querySelector('.modal')) setCard({ id: '', code });
      return;
    }
    // a sale / purchase / quote window or the daybook is open: the item goes in there
    const modalOpen = !!document.querySelector('.modal');
    if (modalOpen && !scanTargets.tx) return; // some other window: not our place to add anything
    if (modalOpen || path.startsWith('/daybook')) {
      window.dispatchEvent(new CustomEvent(SCAN_EVENT, { detail: { code } }));
      beep();
      say(`اتضاف: ${p.name}`);
      return;
    }
    beep();
    close();
    setCard(p);
  };
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    let buf = '';
    let t0 = 0;
    let last = 0;
    let bad = false;
    let el0: Element | null = null;
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const t = Date.now();
      if (t - last > GAP) {
        buf = '';
        bad = false;
        t0 = t;
        el0 = document.activeElement;
      }
      last = t;
      if (e.key === 'Enter' || e.key === 'Tab') {
        const avg = buf.length > 1 ? (t - t0) / (buf.length - 1) : 999;
        const fast = buf.length >= MINLEN && avg <= GAP;
        const code = buf;
        buf = '';
        if (!fast || bad) return;
        if (typing(el0) || typing(document.activeElement)) return; // the field has its own handler
        if (avg > SURE && !SYS.test(code)) return; // slow typing is a person, not the device
        e.preventDefault();
        e.stopPropagation();
        void routeRef.current(code);
        return;
      }
      if (e.key === 'Shift' || e.key === 'CapsLock') return;
      const c = keyChar(e);
      if (c) buf += c;
      else bad = true;
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, []);

  const known = card && card.id ? (card as ProductDto) : null;
  const go = (fn: () => void) => () => {
    setCard(null);
    setTimeout(fn, 60);
  };
  const sale = (type: 'SALE' | 'PURCHASE') => () => {
    if (!known) return;
    live.current.open({ kind: 'transaction', type, preset: { lines: [{ productId: known.id, name: known.name, qty: 1, price: (type === 'SALE' ? known.price : known.cost) || 0 }] } });
  };

  return (
    <>
      {flash && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100000,
            padding: '10px 18px',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 15,
            boxShadow: '0 8px 30px #0004',
            pointerEvents: 'none',
            maxWidth: '92vw',
            textAlign: 'center',
            color: '#fff',
            background: flash.ok ? '#0f5132' : '#b3261e',
          }}
        >
          {flash.ok ? '📟 ' : '⚠️ '}
          {flash.t}
        </div>
      )}
      <button
        type="button"
        id="mkScanFab"
        title="امسح باركود"
        onClick={() => setCam(true)}
        style={{
          position: 'fixed',
          left: 16,
          bottom: 'calc(158px + env(safe-area-inset-bottom,0px))',
          zIndex: 9990,
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: 0,
          background: 'linear-gradient(145deg,#1d2b35,#0b141a)',
          color: '#e9c46a',
          fontSize: 26,
          cursor: 'pointer',
          boxShadow: '0 10px 28px #0005, inset 0 0 0 2px #e9c46a8c',
        }}
      >
        📷
      </button>
      <style>{`#mkScanFab{display:none}@media (max-width:900px),(pointer:coarse){#mkScanFab{display:flex;align-items:center;justify-content:center}}`}</style>
      {cam && (
        <CameraScanner
          title="📟 امسح أي كود (صنف / فاتورة / عرض سعر)"
          onClose={() => setCam(false)}
          onCode={(c) => {
            setCam(false);
            void routeRef.current(c);
            return true;
          }}
        />
      )}
      {card && (
        <Modal title={known ? `📟 ${known.name}` : '📟 كود مش متسجّل'} onClose={() => setCard(null)}>
          {known ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 15 }}>
              <span className="muted">الكود</span>
              <b dir="ltr" style={{ textAlign: 'right' }}>
                {known.code}
              </b>
              <span className="muted">السعر</span>
              <b>{known.price}</b>
              <span className="muted">الرصيد</span>
              <b style={{ color: known.qty <= known.minQty ? '#b3261e' : '#1e7a3c' }}>
                {known.qty} {known.unit}
                {known.qty <= known.minQty ? ' ⚠️ قليل' : ''}
              </b>
            </div>
          ) : (
            <p style={{ fontSize: 15 }}>
              الكود <b dir="ltr">{card.code}</b> مش على أي صنف.
            </p>
          )}
          <div className="quick" style={{ marginTop: 12 }}>
            {known ? (
              <>
                <button type="button" onClick={go(sale('SALE'))}>
                  <b>🧾 فاتورة بيع</b>
                </button>
                {admin && (
                  <button type="button" onClick={go(sale('PURCHASE'))}>
                    <b>📦 فاتورة شراء</b>
                  </button>
                )}
                <button type="button" onClick={go(() => live.current.open({ kind: 'product', id: known.id }))}>
                  <b>🔎 تفاصيل الصنف</b>
                </button>
              </>
            ) : (
              admin && (
                <button type="button" onClick={go(() => live.current.open({ kind: 'product', preset: { code: (card as { code: string }).code } }))}>
                  <b>➕ سجّل صنف جديد بالكود ده</b>
                </button>
              )
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
