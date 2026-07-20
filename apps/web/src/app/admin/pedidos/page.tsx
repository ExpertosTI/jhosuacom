'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type OrderItem = {
  name: string;
  quantity: string;
  unitPrice?: string;
  lineTotal?: string;
  imageUrl?: string | null;
};

type Order = {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  odooSaleOrderName?: string | null;
  createdAt: string;
  items?: OrderItem[];
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
              <div className="min-w-0 flex-1">
                <p className="font-raj text-sm font-bold text-gold-light">{o.number}</p>
                <p className="text-sm">
                  {o.customerName} · {o.customerPhone}
                </p>
                <p className="mt-1 text-xs text-chrome-muted">
                  {money(o.total)}
                  {o.odooSaleOrderName ? ` · Odoo ${o.odooSaleOrderName}` : ''}
                </p>
                {o.items && o.items.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {o.items.map((item, idx) => (
                      <li key={`${o.id}-${idx}`} className="flex items-center gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden border border-gold/20 bg-ink-4">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-display text-lg text-gold/25">
                              {item.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-chrome">{item.name}</p>
                          <p className="font-raj text-[11px] uppercase tracking-wider text-chrome-muted">
                            {item.quantity}×
                            {item.unitPrice ? ` ${money(item.unitPrice)}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
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
