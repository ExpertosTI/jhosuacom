'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Customer = {
  id: string;
  name: string;
  phone: string;
  debtAmount: string;
  lastNotifiedDebtAt?: string | null;
};

export default function AdminDeudasPage() {
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const data = await api<Customer[]>('/customers/debts', { token: token() });
    setDebtors(data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function notifyAll() {
    setMsg('Enviando...');
    try {
      const res = await api<{ sent: number; candidates: number }>('/customers/notify-debts', {
        method: 'POST',
        token: token(),
        body: JSON.stringify({ minAmount: 1 }),
      });
      setMsg(`Notificados: ${res.sent} de ${res.candidates}`);
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Error');
    }
  }

  async function syncOne(id: string) {
    await api(`/customers/${id}/sync-debt`, { method: 'POST', token: token() });
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-chrome">Estado de cuenta</h1>
          <p className="mt-1 text-sm text-chrome-muted">
            Deudas desde Odoo · recordatorios WhatsApp automáticos
          </p>
        </div>
        <button
          type="button"
          onClick={notifyAll}
          className="bg-gold px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink"
        >
          Notificar deudas
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-gold-light">{msg}</p>}

      <div className="mt-8 space-y-3">
        {debtors.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-gold/15 bg-ink-3/40 p-4"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-chrome-muted">{c.phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-display text-2xl text-gradient-gold">{money(c.debtAmount)}</p>
              <button
                type="button"
                onClick={() => syncOne(c.id)}
                className="border border-gold/25 px-3 py-1.5 font-raj text-[10px] uppercase tracking-wider text-gold-light"
              >
                Sync Odoo
              </button>
            </div>
          </div>
        ))}
        {debtors.length === 0 && (
          <p className="text-chrome-muted">No hay clientes con deuda registrada.</p>
        )}
      </div>
    </div>
  );
}
