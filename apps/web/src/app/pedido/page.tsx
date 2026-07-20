'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, money } from '@/lib/api';

type Order = {
  number: string;
  status: string;
  total: string;
  customerName: string;
  odooSaleOrderName?: string | null;
  items: Array<{ name: string; quantity: string; lineTotal: string }>;
  createdAt: string;
};

function PedidoInner() {
  const params = useSearchParams();
  const initial = params.get('n') || '';
  const [number, setNumber] = useState(initial);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(n: string) {
    if (!n.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api<Order>(`/public/orders/${encodeURIComponent(n.trim())}`);
      setOrder(data);
    } catch {
      setOrder(null);
      setError('Pedido no encontrado');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    load(number);
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display text-5xl tracking-wide text-chrome">
        Seguimiento
      </h1>
      <p className="mt-2 text-sm text-chrome-muted">Consulta el estado de tu pedido JH.</p>

      <form onSubmit={onSubmit} className="mt-8 flex gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Ej. JH26-00001"
          className="flex-1 border border-gold/20 bg-ink-3 px-3 py-3 text-sm outline-none focus:border-gold/50"
        />
        <button
          type="submit"
          className="bg-gold px-5 font-raj text-xs font-bold uppercase tracking-widest text-ink"
        >
          Ver
        </button>
      </form>

      {loading && <p className="mt-8 text-chrome-muted">Buscando...</p>}
      {error && <p className="mt-8 text-red-400">{error}</p>}

      {order && (
        <div className="mt-10 border border-gold/20 bg-ink-3/50 p-6">
          <p className="font-raj text-xs uppercase tracking-widest text-gold-light">
            {order.number}
          </p>
          <p className="mt-2 font-display text-3xl text-gradient-gold capitalize">
            {order.status}
          </p>
          <p className="mt-1 text-sm text-chrome-muted">{order.customerName}</p>
          {order.odooSaleOrderName && (
            <p className="mt-2 text-xs text-chrome-muted">
              Cotización Odoo: {order.odooSaleOrderName}
            </p>
          )}
          <ul className="mt-6 space-y-2 border-t border-gold/15 pt-4 text-sm">
            {order.items?.map((it, i) => (
              <li key={i} className="flex justify-between text-chrome-muted">
                <span>
                  {it.quantity}× {it.name}
                </span>
                <span>{money(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-display text-2xl text-chrome">{money(order.total)}</p>
        </div>
      )}
    </div>
  );
}

export default function PedidoPage() {
  return (
    <Suspense fallback={<p className="p-20 text-center text-chrome-muted">Cargando...</p>}>
      <PedidoInner />
    </Suspense>
  );
}
