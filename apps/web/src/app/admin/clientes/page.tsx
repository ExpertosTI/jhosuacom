'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api, money } from '@/lib/api';
import { token } from '@/components/AdminShell';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  taxId?: string | null;
  priceMode: 'detal' | 'mayor' | string;
  debtAmount: string;
  notes?: string | null;
  odooPartnerId?: number | null;
};

export default function AdminClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    taxId: '',
    priceMode: 'detal' as 'detal' | 'mayor',
    notes: '',
    debtAmount: '0',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const data = await api<Customer[]>(`/customers${qs}`, { token: token() });
    setCustomers(data);
  }, [q]);

  useEffect(() => {
    load().catch(() => setCustomers([]));
  }, [load]);

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      taxId: c.taxId || '',
      priceMode: c.priceMode === 'mayor' ? 'mayor' : 'detal',
      notes: c.notes || '',
      debtAmount: String(c.debtAmount || '0'),
    });
    setMsg('');
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/customers/${editing.id}`, {
        method: 'PATCH',
        token: token(),
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          taxId: form.taxId || null,
          priceMode: form.priceMode,
          notes: form.notes || null,
          debtAmount: form.debtAmount,
        }),
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setMsg(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full border border-gold/20 bg-ink px-3 py-2 text-sm text-chrome outline-none focus:border-gold/50';

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Clientes</h1>
      <p className="mt-1 text-sm text-chrome-muted">Busca y edita datos, modo de precio y notas.</p>

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nombre, teléfono, email…"
          className="w-full border border-gold/20 bg-ink-3 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold/50"
        />
      </div>

      <div className="mt-6 overflow-x-auto border border-gold/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-3 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3">Deuda</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-gold/10">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-chrome-muted">{c.phone}</td>
                <td className="px-4 py-3 text-chrome-muted">{c.email || '—'}</td>
                <td className="px-4 py-3 capitalize">{c.priceMode}</td>
                <td className="px-4 py-3">{money(c.debtAmount)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="border border-gold/30 px-3 py-1.5 font-raj text-[10px] font-bold uppercase tracking-wider text-gold-light"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-chrome-muted">
                  Sin clientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-md flex-col border-l border-gold/20 bg-ink-2">
            <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
              <p className="font-display text-2xl text-chrome">Editar cliente</p>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="h-5 w-5 text-chrome-muted" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {(
                [
                  ['name', 'Nombre'],
                  ['phone', 'Teléfono'],
                  ['email', 'Email'],
                  ['taxId', 'RNC / cédula'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-chrome-muted">
                  {label}
                  <input
                    className={inputClass}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block text-xs text-chrome-muted">
                Modo precio
                <select
                  className={inputClass}
                  value={form.priceMode}
                  onChange={(e) =>
                    setForm({ ...form, priceMode: e.target.value as 'detal' | 'mayor' })
                  }
                >
                  <option value="detal">Detal</option>
                  <option value="mayor">Mayor</option>
                </select>
              </label>
              <label className="block text-xs text-chrome-muted">
                Deuda (manual)
                <input
                  className={inputClass}
                  type="number"
                  value={form.debtAmount}
                  onChange={(e) => setForm({ ...form, debtAmount: e.target.value })}
                />
              </label>
              <label className="block text-xs text-chrome-muted">
                Notas
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              {msg && <p className="text-sm text-gold-light">{msg}</p>}
            </div>
            <div className="flex gap-2 border-t border-gold/15 p-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 border border-gold/25 py-2.5 font-raj text-xs uppercase tracking-wider text-chrome-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="flex-1 bg-gold py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
