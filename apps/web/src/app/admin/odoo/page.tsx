'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { token } from '@/components/AdminShell';

type OdooStatus = {
  ok: boolean;
  mock: boolean;
  message: string;
  url?: string;
  database?: string;
  username?: string;
};

export default function AdminOdooPage() {
  const [status, setStatus] = useState<OdooStatus | null>(null);
  const [syncResult, setSyncResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    try {
      const s = await api<OdooStatus>('/odoo/status', { token: token() });
      setStatus(s);
    } catch {
      setStatus({ ok: false, mock: true, message: 'Sin conexión API' });
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function sync() {
    setLoading(true);
    setSyncResult('');
    try {
      const res = await api<{
        mock: boolean;
        companies: number;
        products: number;
        message?: string;
      }>('/odoo/sync', { method: 'POST', token: token() });
      setSyncResult(
        res.mock
          ? res.message || 'Modo mock — no se sincronizó'
          : `OK: ${res.companies} empresas, ${res.products} productos (con imágenes)`,
      );
      await loadStatus();
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
        Conexión multi-empresa · sync de catálogo e imágenes · cotizaciones al crear pedidos
      </p>

      <div className="mt-8 border border-gold/15 bg-ink-3/50 p-6">
        <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Estado</p>
        <p className="mt-2 text-lg text-gold-light">{status?.message || '...'}</p>
        <p className="mt-1 text-xs text-chrome-muted">
          {status?.mock
            ? 'Mock activo — define ODOO_API_KEY y ODOO_MOCK=false en el .env del VPS'
            : status?.ok
              ? 'Live — sync escribe productos e image_128 → imageUrl'
              : 'Error de conexión — revisa ODOO_* en .env'}
        </p>
        {(status?.url || status?.database) && (
          <div className="mt-4 space-y-1 font-raj text-[11px] uppercase tracking-wider text-chrome-muted">
            {status.url && <p>URL: {status.url}</p>}
            {status.database && <p>DB: {status.database}</p>}
            {status.username && <p>User: {status.username}</p>}
          </div>
        )}

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
        <p>Variables (.env VPS): ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, ODOO_COMPANY_IDS</p>
        <p>Con API key real: ODOO_MOCK=false — luego redeploy API y sincronizar aquí.</p>
      </div>
    </div>
  );
}
