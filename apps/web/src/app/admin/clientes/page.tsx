'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  priceMode: string;
  debtAmount: string;
  odooPartnerId?: number | null;
};

export default function AdminClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    api<Customer[]>('/customers', { token: token() })
      .then(setCustomers)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Clientes</h1>
      <div className="mt-8 overflow-x-auto border border-gold/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-3 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3">Deuda</th>
              <th className="px-4 py-3">Odoo</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-gold/10">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-chrome-muted">{c.phone}</td>
                <td className="px-4 py-3 capitalize">{c.priceMode}</td>
                <td className="px-4 py-3">{money(c.debtAmount)}</td>
                <td className="px-4 py-3 text-chrome-muted">{c.odooPartnerId || '—'}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-chrome-muted">
                  Sin clientes aún
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
