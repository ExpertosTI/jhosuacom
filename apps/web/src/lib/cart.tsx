'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PriceMode, Product } from './api';
import { unitPrice } from './api';

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartState = {
  items: CartLine[];
  priceMode: PriceMode;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setPriceMode: (m: PriceMode) => void;
  count: number;
  subtotal: number;
};

const CartCtx = createContext<CartState | null>(null);
const KEY = 'jh-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [priceMode, setPriceMode] = useState<PriceMode>('detal');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items || []);
        setPriceMode(parsed.priceMode || 'detal');
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify({ items, priceMode }));
  }, [items, priceMode, ready]);

  const add = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((l) => l.product.id === product.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + qty };
        return next;
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, l) => s + l.quantity, 0);
  const subtotal = items.reduce(
    (s, l) => s + unitPrice(l.product, priceMode, l.quantity) * l.quantity,
    0,
  );

  const value = useMemo(
    () => ({
      items,
      priceMode,
      add,
      setQty,
      remove,
      clear,
      setPriceMode,
      count,
      subtotal,
    }),
    [items, priceMode, add, setQty, remove, clear, count, subtotal],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart outside provider');
  return ctx;
}
