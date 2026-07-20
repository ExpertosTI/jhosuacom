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

type OdooConfigForm = {
  url: string;
  database: string;
  username: string;
  apiKey: string;
  companyIds: string;
  mock: boolean;
  hasApiKey?: boolean;
  source?: 'database' | 'env';
};

const emptyForm: OdooConfigForm = {
  url: '',
  database: '',
  username: '',
  apiKey: '',
  companyIds: '',
  mock: false,
};

export default function AdminOdooPage() {
  const [status, setStatus] = useState<OdooStatus | null>(null);
  const [form, setForm] = useState<OdooConfigForm>(emptyForm);
  const [syncResult, setSyncResult] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [s, c] = await Promise.all([
        api<OdooStatus>('/odoo/status', { token: token() }),
        api<OdooConfigForm>('/odoo/config', { token: token() }),
      ]);
      setStatus(s);
      setForm({
        url: c.url || '',
        database: c.database || '',
        username: c.username || '',
        apiKey: '',
        companyIds: c.companyIds || '',
        mock: Boolean(c.mock),
        hasApiKey: c.hasApiKey,
        source: c.source,
      });
    } catch {
      setStatus({ ok: false, mock: true, message: 'Sin conexión API' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function patch<K extends keyof OdooConfigForm>(key: K, value: OdooConfigForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveConfig() {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload: Record<string, unknown> = {
        url: form.url.trim(),
        database: form.database.trim(),
        username: form.username.trim(),
        companyIds: form.companyIds.trim(),
        mock: form.mock,
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

      const c = await api<OdooConfigForm>('/odoo/config', {
        method: 'PUT',
        token: token(),
        body: JSON.stringify(payload),
      });
      setForm((f) => ({
        ...f,
        apiKey: '',
        hasApiKey: c.hasApiKey,
        source: c.source,
        mock: Boolean(c.mock),
      }));
      setSaveMsg('Configuración guardada en la base de datos.');
      const s = await api<OdooStatus>('/odoo/status', { token: token() });
      setStatus(s);
    } catch (e: any) {
      setSaveMsg(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function testConfig() {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload: Record<string, unknown> = {
        url: form.url.trim(),
        database: form.database.trim(),
        username: form.username.trim(),
        companyIds: form.companyIds.trim(),
        mock: form.mock,
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

      const s = await api<OdooStatus>('/odoo/config/test', {
        method: 'POST',
        token: token(),
        body: JSON.stringify(payload),
      });
      setStatus(s);
      setSaveMsg(s.ok ? s.message : `Fallo: ${s.message}`);
    } catch (e: any) {
      setSaveMsg(e.message || 'Error al probar');
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setLoading(true);
    setSyncResult('');
    try {
      const res = await api<{
        mock: boolean;
        companies: number;
        products: number;
        purged?: number;
        enrich?: { enriched?: number; skipped?: boolean };
        message?: string;
      }>('/odoo/sync', { method: 'POST', token: token() });
      const enrichBit =
        res.enrich && !res.enrich.skipped
          ? ` · IA: ${res.enrich.enriched ?? 0} descripciones`
          : '';
      setSyncResult(
        res.mock
          ? res.message || 'Modo mock — no se sincronizó'
          : `OK: ${res.companies} empresas, ${res.products} productos, ${res.purged ?? 0} obsoletos${enrichBit}`,
      );
      await load();
    } catch (e: any) {
      setSyncResult(e.message || 'Error de sync');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'mt-1 w-full border border-gold/20 bg-ink px-3 py-2 text-sm text-chrome outline-none focus:border-gold/50';

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Odoo 18</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Credenciales de la API desde este panel (guardadas en BD). Sync de catálogo e imágenes
        múltiples.
      </p>

      <div className="mt-8 border border-gold/15 bg-ink-3/50 p-6">
        <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">
          Configuración API
        </p>
        <p className="mt-1 text-xs text-chrome-muted">
          Origen actual: {form.source === 'database' ? 'base de datos (panel)' : 'variables .env'}
          {form.hasApiKey ? ' · API key configurada' : ' · sin API key'}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-xs text-chrome-muted">
            URL Odoo
            <input
              className={inputClass}
              value={form.url}
              onChange={(e) => patch('url', e.target.value)}
              placeholder="https://tu-odoo.ejemplo.com"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-chrome-muted">
            Base de datos
            <input
              className={inputClass}
              value={form.database}
              onChange={(e) => patch('database', e.target.value)}
              placeholder="nombre_db"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-chrome-muted">
            Usuario
            <input
              className={inputClass}
              value={form.username}
              onChange={(e) => patch('username', e.target.value)}
              placeholder="admin@empresa.com"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-chrome-muted">
            API Key {form.hasApiKey ? '(dejar vacío para no cambiar)' : ''}
            <input
              className={inputClass}
              type="password"
              value={form.apiKey}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, apiKey: v, mock: v.trim() ? false : f.mock }));
              }}
              placeholder={form.hasApiKey ? '••••••••' : 'API key de Odoo'}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-xs text-chrome-muted md:col-span-2">
            IDs de empresas Odoo (opcional, separados por coma)
            <input
              className={inputClass}
              value={form.companyIds}
              onChange={(e) => patch('companyIds', e.target.value)}
              placeholder="1,2,3"
              autoComplete="off"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-chrome md:col-span-2">
            <input
              type="checkbox"
              checked={form.mock}
              onChange={(e) => patch('mock', e.target.checked)}
              className="accent-gold"
            />
            Modo mock (no conectar a Odoo)
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={testConfig}
            disabled={saving}
            className="border border-gold/40 px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-gold-light disabled:opacity-60"
          >
            Probar conexión
          </button>
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="bg-gold px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
        {saveMsg && <p className="mt-3 text-sm text-chrome">{saveMsg}</p>}
      </div>

      <div className="mt-6 border border-gold/15 bg-ink-3/50 p-6">
        <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Estado</p>
        <p className="mt-2 text-lg text-gold-light">{status?.message || '...'}</p>
        <p className="mt-1 text-xs text-chrome-muted">
          {status?.mock
            ? 'Mock activo — desmarca mock y guarda URL/DB/usuario/API key'
            : status?.ok
              ? 'Live — sync: logos empresa, fotos producto, purge de obsoletos + IA'
              : 'Error de conexión — revisa los datos y prueba de nuevo'}
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
          disabled={loading || Boolean(status?.mock)}
          className="mt-6 bg-gold px-6 py-3 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-60"
        >
          {loading ? 'Sincronizando...' : 'Sincronizar (purge + logos + IA)'}
        </button>
        {syncResult && <p className="mt-4 text-sm text-chrome">{syncResult}</p>}
      </div>

      <div className="mt-6 space-y-2 text-sm text-chrome-muted">
        <p>
          Sync consulta solo productos <span className="text-chrome">activos/vendibles</span> en
          Odoo, importa logos de empresa e imágenes, desactiva lo que ya no está, y genera
          descripciones con Gemini si faltan.
        </p>
        <p>
          En Odoo (módulo JH): pestaña <span className="text-chrome">JH Hogar Web</span> → fotos,
          descripción web y botón «Pedir descripción IA».
        </p>
      </div>
    </div>
  );
}
