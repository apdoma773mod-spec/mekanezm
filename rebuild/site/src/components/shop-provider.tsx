'use client';
// Browser-side shop state: cart, favorites, live stock, recently viewed, popups and toasts.
// Cart/favorites persist in localStorage with the same keys the old site used.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchStock } from '@/lib/api';
import type { Product, Site, Stock } from '@/lib/schema';
import { stockOk } from '@/lib/shop';

export type Modal =
  | { kind: 'cart' }
  | { kind: 'ship' }
  | { kind: 'req' }
  | { kind: 'track'; ref?: string; phone?: string }
  | { kind: 'review' }
  | { kind: 'notify'; id: string }
  | { kind: 'work'; i: number }
  | { kind: 'image'; src: string };

type Toast = { msg: string; undo?: () => void; n: number } | null;

type Ctx = {
  site: Site;
  stock: Stock;
  ok: (p: Product) => boolean;
  product: (id: string) => Product | undefined;
  cart: Record<string, number>;
  cartCount: number;
  add: (id: string, q?: number) => void;
  setQty: (id: string, q: number) => void;
  clearCart: () => void;
  fav: Set<string>;
  toggleFav: (id: string) => void;
  favOn: boolean;
  setFavOn: (v: boolean) => void;
  /** Section the home page is filtered to ('' = all). */
  cur: string;
  setCur: (id: string) => void;
  recent: string[];
  pushRecent: (id: string) => void;
  modal: Modal | null;
  open: (m: Modal) => void;
  close: () => void;
  toast: Toast;
  say: (msg: string, undo?: () => void) => void;
  refreshStock: () => void;
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

export function ShopProvider({ site, stock: stock0, children }: { site: Site; stock: Stock; children: ReactNode }) {
  const [stock, setStock] = useState<Stock>(stock0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fav, setFav] = useState<Set<string>>(new Set());
  const [favOn, setFavOn] = useState(false);
  const [cur, setCur] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const loaded = useRef(false);
  const byId = useMemo(() => new Map(site.products.map(p => [p.id, p])), [site.products]);

  // Restore saved state once (only products that still exist).
  useEffect(() => {
    const c = read<Record<string, number>>('mk_cart', {});
    setCart(Object.fromEntries(Object.entries(c).filter(([id, q]) => byId.has(id) && q > 0)));
    setFav(new Set(read<string[]>('mkfav', [])));
    setRecent(read<string[]>('mk_recent', []).filter(id => byId.has(id)));
    loaded.current = true;
  }, [byId]);
  useEffect(() => { if (loaded.current) write('mk_cart', cart); }, [cart]);
  useEffect(() => { if (loaded.current) write('mkfav', [...fav]); }, [fav]);

  const refreshStock = useCallback(() => { fetchStock().then(s => s && setStock(s)); }, []);
  useEffect(refreshStock, [refreshStock]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string, undo?: () => void) => {
    setToast(t => ({ msg, undo, n: (t?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const setQty = useCallback((id: string, q: number) => setCart(c => {
    const n = { ...c };
    if (q > 0) n[id] = q; else delete n[id];
    return n;
  }), []);

  const add = useCallback((id: string, q = 1) => {
    setCart(c => ({ ...c, [id]: (c[id] ?? 0) + q }));
    try { navigator.vibrate?.(18); } catch { /* not supported */ }
    const p = byId.get(id);
    say('✔ اتضاف للطلب: ' + (p ? p.name.slice(0, 32) : ''), () => setCart(c => {
      const n = { ...c };
      n[id] = (n[id] ?? 1) - q;
      if (n[id] <= 0) delete n[id];
      return n;
    }));
  }, [byId, say]);

  const value: Ctx = {
    site,
    stock,
    ok: p => stockOk(p, stock),
    product: id => byId.get(id),
    cart,
    cartCount: Object.values(cart).reduce((a, b) => a + b, 0),
    add,
    setQty,
    clearCart: () => setCart({}),
    fav,
    toggleFav: id => setFav(f => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    favOn,
    setFavOn,
    cur,
    setCur,
    recent,
    pushRecent: id => setRecent(r => { const a = [id, ...r.filter(x => x !== id)].slice(0, 10); write('mk_recent', a); return a; }),
    modal,
    open: setModal,
    close: () => setModal(null),
    toast,
    say,
    refreshStock,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
