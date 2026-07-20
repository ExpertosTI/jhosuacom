'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
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
  notes?: string | null;
  odooSaleOrderName?: string | null;
  createdAt: string;
  items?: OrderItem[];
};

const STATUSES = ['all', 'received', 'quoted', 'confirmed', 'invoiced', 'cancelled'];

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: '80' });
    if (status !== 'all') qs.set('status', status);
    if (q.trim()) qs.set('q', q.trim());
    const data = await api<Order[]>(`/orders?${qs}`, { token: token() });
    setOrders(data);
    const drafts: Record<string, string> = {};
    for (const o of data) drafts[o.id] = o.notes || '';
    setNotesDraft(drafts);
  }, [status, q]);

  useEffect(() => {
    load().catch(() => setOrders([]));
  }, [load]);

  async function setStatus(id: string, next: string) {
    await api(`/orders/${id}/status`, {
      method: 'PATCH',
      token: token(),
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function saveNotes(id: string) {
    await api(`/orders/${id}`, {
      method: 'PATCH',
      token: token(),
      body: JSON.stringify({ notes: notesDraft[id] || null }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Pedidos</h1>
      <p className="mt-1 text-sm text-chrome-muted">Filtra, cambia estado y agrega notas internas.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar número, cliente, teléfono…"
            className="w-full border border-gold/20 bg-ink-3 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold/50"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gold/20 bg-ink-3 px-3 py-2.5 font-raj text-xs uppercase tracking-wider"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'Todos los estados' : s}
            </option>
          ))}
        </select>
      </div>

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
                  {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleString('es-DO')}` : ''}
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
                <div className="mt-3 flex gap-2">
                  <input
                    value={notesDraft[o.id] || ''}
                    onChange={(e) => setNotesDraft({ ...notesDraft, [o.id]: e.target.value })}
                    placeholder="Notas internas…"
                    className="min-w-0 flex-1 border border-gold/20 bg-ink px-3 py-1.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveNotes(o.id)}
                    className="border border-gold/30 px-3 py-1.5 font-raj text-[10px] uppercase tracking-wider text-gold-light"
                  >
                    Guardar nota
                  </button>
                </div>
              </div>
              <select
                value={o.status}
                onChange={(e) => setStatus(o.id, e.target.value)}
                className="border border-gold/25 bg-ink-2 px-3 py-2 font-raj text-xs uppercase tracking-wider outline-none"
              >
                {STATUSES.filter((s) => s !== 'all').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-chrome-muted">No hay pedidos con estos filtros.</p>}
      </div>
    </div>
  );
}
