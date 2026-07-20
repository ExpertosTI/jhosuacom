'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Customer = {
  id: string;
  name: string;
  phone: string;
  debtAmount: string;
  lastNotifiedDebtAt?: string | null;
  debtSyncedAt?: string | null;
};

export default function AdminDeudasPage() {
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [minAmount, setMinAmount] = useState('1');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (minAmount) qs.set('minAmount', minAmount);
    const data = await api<Customer[]>(`/customers/debts?${qs}`, { token: token() });
    setDebtors(data);
  }, [q, minAmount]);

  useEffect(() => {
    load().catch(() => setDebtors([]));
  }, [load]);

  async function notifyAll() {
    setMsg('Enviando...');
    try {
      const res = await api<{ sent: number; candidates: number }>('/customers/notify-debts', {
        method: 'POST',
        token: token(),
        body: JSON.stringify({ minAmount: Number(minAmount) || 1 }),
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

  async function notifyOne(id: string) {
    setMsg('');
    try {
      await api(`/customers/${id}/notify-debt`, { method: 'POST', token: token() });
      setMsg('Recordatorio enviado');
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Error');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-chrome">Estado de cuenta</h1>
          <p className="mt-1 text-sm text-chrome-muted">
            Deudas · sync Odoo · recordatorios WhatsApp
          </p>
        </div>
        <button
          type="button"
          onClick={notifyAll}
          className="bg-gold px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink"
        >
          Notificar lote
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-gold-light">{msg}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar deudor…"
            className="w-full border border-gold/20 bg-ink-3 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold/50"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-chrome-muted">
          Mín.
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-24 border border-gold/20 bg-ink-3 px-2 py-2 text-sm outline-none"
          />
        </label>
      </div>

      <div className="mt-8 space-y-3">
        {debtors.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-gold/15 bg-ink-3/40 p-4"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-chrome-muted">{c.phone}</p>
              <p className="mt-1 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
                {c.lastNotifiedDebtAt
                  ? `Último aviso: ${new Date(c.lastNotifiedDebtAt).toLocaleDateString('es-DO')}`
                  : 'Sin aviso'}
                {c.debtSyncedAt
                  ? ` · Sync: ${new Date(c.debtSyncedAt).toLocaleDateString('es-DO')}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl text-gradient-gold">{money(c.debtAmount)}</p>
              <button
                type="button"
                onClick={() => syncOne(c.id)}
                className="border border-gold/25 px-3 py-1.5 font-raj text-[10px] uppercase tracking-wider text-gold-light"
              >
                Sync Odoo
              </button>
              <button
                type="button"
                onClick={() => notifyOne(c.id)}
                className="border border-gold/40 bg-gold/10 px-3 py-1.5 font-raj text-[10px] uppercase tracking-wider text-gold-light"
              >
                WhatsApp
              </button>
            </div>
          </div>
        ))}
        {debtors.length === 0 && (
          <p className="text-chrome-muted">No hay clientes con deuda en este filtro.</p>
        )}
      </div>
    </div>
  );
}
