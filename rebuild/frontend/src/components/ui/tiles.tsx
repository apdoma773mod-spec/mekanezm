'use client';

import Link from 'next/link';
import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 🧩 شاشة طويلة → أيقونات: كل جزء أيقونة صغيرة؛ دوسة تفتحه بعرض الشاشة، ودوسة تانية (أو ✕) تقفله.
 * - جزء واحد مفتوح في المرة عشان الشاشة تفضل هادية على الموبايل.
 * - محتوى الجزء مابيتحمّلش غير لما يتفتح (أسرع، ومفيش طلبات للسيرفر على الفاضي).
 * - آخر جزء مفتوح بيتفتكر في الصفحة (لو رجعت من شاشة تانية تلاقيه زي ما سيبته).
 * - الكروت اللي جوه الجزء بتفقد إطارها وعنوانها المكرر لوحدها (CSS في globals: .mk-tile-b).
 */
type Ctx = { open: string; toggle: (k: string) => void };
const TilesCtx = createContext<Ctx | null>(null);

export function Tiles({ id, children, cols, defaultOpen = '' }: { id: string; children: ReactNode; cols?: number; defaultOpen?: string }) {
  const key = `mk-tiles:${id}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const v = sessionStorage.getItem(key);
    if (v && !defaultOpen) setOpen(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const toggle = (k: string) =>
    setOpen((o) => {
      const n = o === k ? '' : k;
      if (n) sessionStorage.setItem(key, n);
      else sessionStorage.removeItem(key);
      return n;
    });
  const count = Children.toArray(children).filter(isValidElement).length;
  return (
    <TilesCtx.Provider value={{ open, toggle }}>
      <div className="mk-tiles" style={cols ? { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` } : count <= 4 ? { gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' } : undefined}>
        {children}
      </div>
    </TilesCtx.Provider>
  );
}

export function Tile({ icon, title, sub, badge, k, children }: { icon: string; title: string; sub?: ReactNode; badge?: ReactNode; k?: string; children: ReactNode }) {
  const ctx = useContext(TilesCtx);
  const id = k ?? title;
  const isOpen = ctx?.open === id;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isOpen) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isOpen]);
  if (!isOpen)
    return (
      <button type="button" className="mk-tile" onClick={() => ctx?.toggle(id)}>
        {badge != null && badge !== '' && badge !== 0 && <span className="mk-tile-badge">{badge}</span>}
        <span className="ic">{icon}</span>
        <b>{title}</b>
        {sub != null && sub !== '' && <small>{sub}</small>}
      </button>
    );
  return (
    <section className="mk-tile-open" ref={ref}>
      <button type="button" className="mk-tile-h" onClick={() => ctx?.toggle(id)} aria-label="اقفل">
        <span className="ic">{icon}</span>
        <b>{title}</b>
        <span className="x">✕</span>
      </button>
      <div className="mk-tile-b">{children}</div>
    </section>
  );
}

/** 📜 قائمة طويلة: أول ٤٠ بس، وزرار «اعرض كمان» — الشاشة تفضل خفيفة وقصيرة والبحث شغال على الكل. */
export function useShowMore<T>(list: T[], step = 40, resetKey?: unknown) {
  const [n, setN] = useState(step);
  useEffect(() => setN(step), [resetKey, step]);
  const shown = list.length > n ? list.slice(0, n) : list;
  const more =
    list.length > n ? (
      <button type="button" className="secondary mk-more" onClick={() => setN((x) => x + step * 2)}>
        ⬇️ اعرض {Math.min(step * 2, list.length - n)} كمان ({list.length - n} فاضل)
      </button>
    ) : null;
  return { shown, more, total: list.length };
}

/** أيقونة بتفتح شاشة تانية أو نافذة على طول (من غير ما تتفتح جوه الصفحة) */
export function TileLink({ icon, title, sub, href, onClick, danger, badge }: { icon: string; title: string; sub?: ReactNode; href?: string; onClick?: () => void; danger?: boolean; badge?: ReactNode }) {
  const body = (
    <>
      {badge != null && badge !== '' && badge !== 0 && <span className="mk-tile-badge">{badge}</span>}
      <span className="ic">{icon}</span>
      <b style={danger ? { color: 'var(--danger)' } : undefined}>{title}</b>
      {sub != null && sub !== '' && <small>{sub}</small>}
    </>
  );
  if (href)
    return (
      <Link className="mk-tile" href={href} style={{ textDecoration: 'none' }}>
        {body}
      </Link>
    );
  return (
    <button type="button" className="mk-tile" onClick={onClick}>
      {body}
    </button>
  );
}
