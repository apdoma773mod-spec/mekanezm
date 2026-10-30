'use client';
// Browser-side shop state: cart, favorites, recently viewed, popups and toasts.
// The browser never loads the full catalog: cart/favorites keep a small snapshot of each product.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Item, Settings } from '@/lib/schema';

export type Modal =
  | { kind: 'cart' }
  | { kind: 'ship' }
  | { kind: 'req' }
  | { kind: 'track'; ref?: string; phone?: string }
  | { kind: 'review'; product?: { id: string; name: string } }
  | { kind: 'notify'; item: Item }
  | { kind: 'work'; i: number }
  | { kind: 'image'; srcs: string[]; i: number };

type Toast = { msg: string; undo?: () => void; label?: string; n: number } | null;
export type Line = { item: Item; q: number };

type Ctx = {
  site: Settings;
  cart: Record<string, Line>;
  cartCount: number;
  add: (item: Item, q?: number) => void;
  setQty: (id: string, q: number) => void;
  clearCart: () => void;
  fav: Record<string, Item>;
  toggleFav: (item: Item) => void;
  recent: Item[];
  pushRecent: (item: Item) => void;
  modal: Modal | null;
  open: (m: Modal) => void;
  close: () => void;
  toast: Toast;
  say: (msg: string, undo?: () => void, label?: string) => void;
};

const C = createContext<Ctx | null>(null);
export const useShop = () => {
  const c = useContext(C);
  if (!c) throw new Error('useShop outside ShopProvider');
  return c;
};

const read = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const K = { cart: 'mk_cart2', fav: 'mk_fav2', recent: 'mk_recent2' };

export function ShopProvider({ site, children }: { site: Settings; children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [fav, setFav] = useState<Record<string, Item>>({});
  const [recent, setRecent] = useState<Item[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setCart(read(K.cart, {}));
    setFav(read(K.fav, {}));
    setRecent(read(K.recent, []));
    loaded.current = true;
    // Keep tabs in sync (cart changed in another tab).
    const s = (e: StorageEvent) => {
      if (e.key === K.cart) setCart(read(K.cart, {}));
      if (e.key === K.fav) setFav(read(K.fav, {}));
    };
    addEventListener('storage', s);
    return () => removeEventListener('storage', s);
  }, []);
  useEffect(() => { if (loaded.current) write(K.cart, cart); }, [cart]);
  useEffect(() => { if (loaded.current) write(K.fav, fav); }, [fav]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string, undo?: () => void, label?: string) => {
    setToast(t => ({ msg, undo, label, n: (t?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), label ? 7000 : 3500);
  }, []);

  const setQty = useCallback((id: string, q: number) => setCart(c => {
    const n = { ...c };
    if (q > 0 && n[id]) n[id] = { ...n[id], q }; else delete n[id];
    return n;
  }), []);

  const add = useCallback((item: Item, q = 1) => {
    setCart(c => ({ ...c, [item.id]: { item, q: (c[item.id]?.q ?? 0) + q } }));
    try { navigator.vibrate?.(18); } catch { /* not supported */ }
    say('✔ اتضاف للطلب: ' + item.name.slice(0, 32), () => setCart(c => {
      const n = { ...c };
      const left = (n[item.id]?.q ?? q) - q;
      if (left > 0) n[item.id] = { ...n[item.id], q: left }; else delete n[item.id];
      return n;
    }));
  }, [say]);

  const value: Ctx = {
    site,
    cart,
    cartCount: Object.values(cart).reduce((a, b) => a + b.q, 0),
    add,
    setQty,
    clearCart: () => setCart({}),
    fav,
    toggleFav: item => setFav(f => { const n = { ...f }; if (n[item.id]) delete n[item.id]; else n[item.id] = item; return n; }),
    recent,
    pushRecent: item => setRecent(r => { const a = [item, ...r.filter(x => x.id !== item.id)].slice(0, 10); write(K.recent, a); return a; }),
    modal,
    open: setModal,
    close: useCallback(() => setModal(null), []),
    toast,
    say,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** False during hydration: parts rendered inside Suspense must not show saved-cart numbers before they mount
 *  (the server HTML has none), or React reports a mismatch. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Orders sent from this browser («طلباتي»). */
export type SavedOrder = { ref: string; at: string; phone: string; lines: [string, number][]; ship: string; custom?: boolean };
export function saveOrder(o: SavedOrder) {
  try {
    const L = JSON.parse(localStorage.getItem('mk_orders') || '[]') as SavedOrder[];
    localStorage.setItem('mk_orders', JSON.stringify([o, ...L.filter(x => x.ref !== o.ref)].slice(0, 30)));
  } catch { /* storage blocked */ }
}
