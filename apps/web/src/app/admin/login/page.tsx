'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@jhhogar.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('jh-token', res.token);
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Login fallido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="jh-grid pointer-events-none absolute inset-0" />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm border border-gold/20 bg-ink-2/90 p-8 shadow-gold"
      >
        <p className="font-display text-4xl text-gradient-gold">JH HOGAR</p>
        <p className="mt-1 font-raj text-xs uppercase tracking-[0.3em] text-chrome-muted">
          Acceso admin
        </p>

        <label className="mt-8 block">
          <span className="font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-gold/20 bg-ink-3 px-3 py-2.5 text-sm outline-none focus:border-gold/50"
          />
        </label>
        <label className="mt-4 block">
          <span className="font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
            Contraseña
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-gold/20 bg-ink-3 px-3 py-2.5 text-sm outline-none focus:border-gold/50"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-gold py-3 font-raj text-sm font-bold uppercase tracking-widest text-ink disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
