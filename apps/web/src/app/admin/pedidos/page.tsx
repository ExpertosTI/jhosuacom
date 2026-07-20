'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Order = {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  odooSaleOrderName?: string | null;
  createdAt: string;
  items?: Array<{ name: string; quantity: string }>;
};

const STATUSES = ['received', 'quoted', 'confirmed', 'invoiced', 'cancelled'];

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    const data = await api<Order[]>('/orders', { token: token() });
    setOrders(data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function setStatus(id: string, status: string) {
    await api(`/orders/${id}/status`, {
      method: 'PATCH',
      token: token(),
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Pedidos</h1>
      <div className="mt-8 space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="border border-gold/15 bg-ink-3/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-raj text-sm font-bold text-gold-light">{o.number}</p>
                <p className="text-sm">
                  {o.customerName} · {o.customerPhone}
                </p>
                <p className="mt-1 text-xs text-chrome-muted">
                  {money(o.total)}
                  {o.odooSaleOrderName ? ` · Odoo ${o.odooSaleOrderName}` : ''}
                </p>
                {o.items && (
                  <p className="mt-2 text-xs text-chrome-muted">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}
                  </p>
                )}
              </div>
              <select
                value={o.status}
                onChange={(e) => setStatus(o.id, e.target.value)}
                className="border border-gold/25 bg-ink-2 px-3 py-2 font-raj text-xs uppercase tracking-wider outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="text-chrome-muted">No hay pedidos todavía.</p>
        )}
      </div>
    </div>
  );
}
