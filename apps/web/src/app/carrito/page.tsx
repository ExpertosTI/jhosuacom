'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { money, unitPrice } from '@/lib/api';
import { Minus, Plus, Trash2 } from 'lucide-react';

export default function CarritoPage() {
  const { items, priceMode, setQty, remove, subtotal, count } = useCart();

  if (count === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-5xl text-chrome">Carrito vacío</h1>
        <p className="mt-3 text-chrome-muted">Agrega productos desde la tienda.</p>
        <Link
          href="/tienda"
          className="mt-8 inline-block bg-gold px-6 py-3 font-raj text-sm font-bold uppercase tracking-widest text-ink"
        >
          Ir a tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-5xl tracking-wide text-chrome">
        Tu <span className="text-gradient-gold">pedido</span>
      </h1>
      <p className="mt-2 font-raj text-xs uppercase tracking-widest text-chrome-muted">
        Modo {priceMode === 'mayor' ? 'mayorista' : 'detalle'}
      </p>

      <ul className="mt-8 space-y-4">
        {items.map((line) => {
          const unit = unitPrice(line.product, priceMode, line.quantity);
          return (
            <li
              key={line.product.id}
              className="flex flex-col gap-4 border border-gold/15 bg-ink-3/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-raj text-lg font-semibold text-chrome">{line.product.name}</p>
                <p className="text-sm text-chrome-muted">
                  {money(unit)} × {line.quantity} = {money(unit * line.quantity)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty(line.product.id, line.quantity - 1)}
                  className="border border-gold/25 p-2 text-gold-light"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center font-raj font-bold">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQty(line.product.id, line.quantity + 1)}
                  className="border border-gold/25 p-2 text-gold-light"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(line.product.id)}
                  className="ml-2 p-2 text-chrome-muted hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex items-center justify-between border-t border-gold/20 pt-6">
        <div>
          <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Subtotal</p>
          <p className="font-display text-4xl text-gradient-gold">{money(subtotal)}</p>
        </div>
        <Link
          href="/checkout"
          className="bg-gold px-8 py-3.5 font-raj text-sm font-bold uppercase tracking-[0.2em] text-ink hover:bg-gold-light"
        >
          Continuar
        </Link>
      </div>
    </div>
  );
}
