'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { useCart } from '@/lib/cart';

export default function CheckoutPage() {
  const { items, priceMode, subtotal, clear, count } = useCart();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (count === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-chrome-muted">No hay productos en el carrito.</p>
        <Link href="/tienda" className="mt-4 inline-block text-gold-light underline">
          Volver a tienda
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const order = await api<{ number: string; id: string }>('/public/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          notes: notes || undefined,
          priceMode,
          items: items.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
        }),
      });
      clear();
      router.push(`/pedido?n=${encodeURIComponent(order.number)}`);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-6 py-12 md:grid-cols-2">
      <div>
        <h1 className="font-display text-5xl tracking-wide text-chrome">Checkout</h1>
        <p className="mt-2 text-sm text-chrome-muted">
          Creamos tu cotización en Odoo y te avisamos por WhatsApp.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Nombre" value={name} onChange={setName} required />
          <Field label="WhatsApp / Teléfono" value={phone} onChange={setPhone} required />
          <Field label="Email (opcional)" value={email} onChange={setEmail} type="email" />
          <label className="block">
            <span className="font-raj text-[10px] font-semibold uppercase tracking-widest text-chrome-muted">
              Notas
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-gold/20 bg-ink-3 px-3 py-2 text-sm outline-none focus:border-gold/50"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold py-3.5 font-raj text-sm font-bold uppercase tracking-[0.2em] text-ink disabled:opacity-60"
          >
            {loading ? 'Enviando...' : `Confirmar · ${money(subtotal)}`}
          </button>
        </form>
      </div>

      <aside className="border border-gold/15 bg-ink-3/40 p-6 h-fit">
        <h2 className="font-raj text-xs font-bold uppercase tracking-[0.3em] text-gold-light">
          Resumen
        </h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((l) => (
            <li key={l.product.id} className="flex justify-between gap-3 text-chrome-muted">
              <span>
                {l.quantity}× {l.product.name}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-display text-3xl text-gradient-gold">{money(subtotal)}</p>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-raj text-[10px] font-semibold uppercase tracking-widest text-chrome-muted">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gold/20 bg-ink-3 px-3 py-2.5 text-sm outline-none focus:border-gold/50"
      />
    </label>
  );
}
