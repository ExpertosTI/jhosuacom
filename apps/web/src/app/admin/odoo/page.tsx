'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { token } from '@/components/AdminShell';

export default function AdminOdooPage() {
  const [status, setStatus] = useState<{ ok: boolean; mock: boolean; message: string } | null>(
    null,
  );
  const [syncResult, setSyncResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<any>('/odoo/status', { token: token() })
      .then(setStatus)
      .catch(() => setStatus({ ok: false, mock: true, message: 'Sin conexión API' }));
  }, []);

  async function sync() {
    setLoading(true);
    setSyncResult('');
    try {
      const res = await api<{ mock: boolean; companies: number; products: number; message?: string }>(
        '/odoo/sync',
        { method: 'POST', token: token() },
      );
      setSyncResult(
        res.mock
          ? res.message || 'Modo mock — no se sincronizó'
          : `OK: ${res.companies} empresas, ${res.products} productos`,
      );
    } catch (e: any) {
      setSyncResult(e.message || 'Error de sync');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Odoo</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Conexión multi-empresa · sync de catálogo · cotizaciones al crear pedidos
      </p>

      <div className="mt-8 border border-gold/15 bg-ink-3/50 p-6">
        <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Estado</p>
        <p className="mt-2 text-lg text-gold-light">{status?.message || '...'}</p>
        <p className="mt-1 text-xs text-chrome-muted">
          Mock: {status?.mock ? 'sí' : 'no'} · Configura ODOO_* en .env
        </p>

        <button
          type="button"
          onClick={sync}
          disabled={loading}
          className="mt-6 bg-gold px-6 py-3 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-60"
        >
          {loading ? 'Sincronizando...' : 'Sincronizar productos'}
        </button>
        {syncResult && <p className="mt-4 text-sm text-chrome">{syncResult}</p>}
      </div>

      <div className="mt-6 space-y-2 text-sm text-chrome-muted">
        <p>Variables: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, ODOO_COMPANY_IDS</p>
        <p>Con API key real, pon ODOO_MOCK=false para sincronizar en vivo.</p>
      </div>
    </div>
  );
}
