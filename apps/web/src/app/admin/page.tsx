'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Dash = {
  orders: {
    total: number;
    received: number;
    quoted: number;
    confirmed: number;
    sales_30d: string;
  };
  products: { total: number };
  debts: { debtors: number; debt_total: string };
  recentOrders: Array<{
    id: string;
    number: string;
    customerName: string;
    total: string;
    status: string;
  }>;
  odoo: { ok: boolean; mock: boolean; message: string };
  lastSync?: { status: string; message?: string; createdAt: string } | null;
};

export default function AdminDashboard() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    api<Dash>('/admin/dashboard', { token: token() })
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return <p className="text-chrome-muted">Cargando dashboard...</p>;
  }

  const cards = [
    { label: 'Pedidos', value: data.orders.total },
    { label: 'Ventas 30d', value: money(data.orders.sales_30d) },
    { label: 'Productos', value: data.products.total },
    { label: 'Deuda total', value: money(data.debts.debt_total) },
  ];

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide text-chrome">Dashboard</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Odoo: {data.odoo.message}
        {data.odoo.mock ? ' · mock' : ''}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-gold/15 bg-ink-3/50 p-5">
            <p className="font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl text-gradient-gold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-raj text-sm font-bold uppercase tracking-widest text-gold-light">
            Pedidos recientes
          </h2>
          <Link href="/admin/pedidos" className="text-xs text-chrome-muted hover:text-gold-light">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto border border-gold/15">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-3 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-gold/10">
                  <td className="px-4 py-3 font-medium text-gold-light">{o.number}</td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  <td className="px-4 py-3">{money(o.total)}</td>
                  <td className="px-4 py-3 capitalize text-chrome-muted">{o.status}</td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-chrome-muted">
                    Sin pedidos aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
