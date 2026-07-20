'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, QrCode, Power, RefreshCw, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { token } from '@/components/AdminShell';

type WaStatus = {
  configured: boolean;
  instanceName: string;
  connectionState: string | null;
  phone: string | null;
  apiUrl: string | null;
};

export default function AdminWhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [testPhone, setTestPhone] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api<WaStatus>('/whatsapp/status', { token: token() });
      setStatus(s);
      return s;
    } catch {
      setStatus({
        configured: false,
        instanceName: 'jhhogar',
        connectionState: null,
        phone: null,
        apiUrl: null,
      });
      return null;
    }
  }, []);

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
    return () => stopPoll();
  }, [loadStatus, stopPoll]);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const st = await api<{ state: string | null }>('/whatsapp/instance/status', {
          token: token(),
        });
        if (st.state === 'open') {
          stopPoll();
          setQr(null);
          setMsg('WhatsApp conectado');
          await loadStatus();
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 3500);
  }, [loadStatus, stopPoll]);

  async function connect() {
    setBusy('qr');
    setMsg('');
    try {
      const res = await api<{
        ok: boolean;
        qr: string | null;
        error?: string | null;
        alreadyConnected?: boolean;
      }>('/whatsapp/qr', { method: 'POST', token: token() });
      if (res.alreadyConnected) {
        setQr(null);
        setMsg('Ya estaba conectado');
        await loadStatus();
        return;
      }
      if (res.qr) {
        setQr(res.qr);
        setMsg('Escanea el QR con WhatsApp');
        startPoll();
      } else {
        setMsg(res.error || 'No se obtuvo QR');
      }
    } catch (e: any) {
      setMsg(e.message || 'Error al pedir QR');
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    setBusy('off');
    setMsg('');
    stopPoll();
    setQr(null);
    try {
      const res = await api<{ ok: boolean; error?: string | null }>('/whatsapp/disconnect', {
        method: 'DELETE',
        token: token(),
      });
      setMsg(res.ok ? 'Desconectado' : res.error || 'No se pudo desconectar');
      await loadStatus();
    } catch (e: any) {
      setMsg(e.message || 'Error al desconectar');
    } finally {
      setBusy('');
    }
  }

  async function sendTest() {
    setBusy('test');
    setMsg('');
    try {
      const res = await api<{ ok: boolean; reason?: string; error?: string; mock?: boolean }>(
        '/whatsapp/test',
        {
          method: 'POST',
          token: token(),
          body: JSON.stringify({ phone: testPhone || undefined }),
        },
      );
      if (res.ok) {
        setMsg(res.mock ? 'Mock: mensaje no enviado (sin Evolution)' : 'Mensaje de prueba enviado');
      } else {
        setMsg(res.error || res.reason || 'Falló el envío');
      }
    } catch (e: any) {
      setMsg(e.message || 'Error de prueba');
    } finally {
      setBusy('');
    }
  }

  const open = status?.connectionState === 'open';

  if (loading) {
    return <p className="text-chrome-muted">Cargando WhatsApp...</p>;
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">WhatsApp</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Instancia Evolution · escanea QR · notificaciones de pedidos y deudas
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-gold/15 bg-ink-3/50 p-6">
          <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Estado</p>
          <div className="mt-3 flex items-center gap-2">
            <MessageCircle className={`h-5 w-5 ${open ? 'text-gold-light' : 'text-chrome-muted'}`} />
            <p className="text-lg text-gold-light">
              {open ? 'Conectado' : status?.configured ? 'Desconectado' : 'Sin configurar'}
            </p>
          </div>
          <div className="mt-4 space-y-1 font-raj text-[11px] uppercase tracking-wider text-chrome-muted">
            <p>Instancia: {status?.instanceName}</p>
            <p>Estado: {status?.connectionState || '—'}</p>
            {status?.phone && <p>Número: {status.phone}</p>}
            {status?.apiUrl && <p>API: {status.apiUrl}</p>}
          </div>
          {!status?.configured && (
            <p className="mt-4 text-sm text-chrome-muted">
              Define EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE en el .env del VPS.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={connect}
              disabled={!!busy || !status?.configured}
              className="inline-flex items-center gap-2 bg-gold px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              {busy === 'qr' ? 'Generando…' : open ? 'Reconectar / QR' : 'Escanear QR'}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={!!busy || !status?.configured}
              className="inline-flex items-center gap-2 border border-gold/30 px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-gold-light disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              {busy === 'off' ? '…' : 'Desconectar'}
            </button>
            <button
              type="button"
              onClick={() => loadStatus()}
              className="inline-flex items-center gap-2 border border-gold/20 px-4 py-2.5 font-raj text-xs uppercase tracking-wider text-chrome-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
          {msg && <p className="mt-4 text-sm text-chrome">{msg}</p>}
        </div>

        <div className="border border-gold/15 bg-ink-3/50 p-6">
          <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">Código QR</p>
          {qr ? (
            <div className="mt-4 inline-block bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="WhatsApp QR" className="h-56 w-56 object-contain" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-chrome-muted">
              {open
                ? 'Conectado — no hace falta QR.'
                : 'Pulsa “Escanear QR” y abre WhatsApp → Dispositivos vinculados.'}
            </p>
          )}

          <div className="mt-8 border-t border-gold/10 pt-6">
            <p className="font-raj text-xs uppercase tracking-widest text-chrome-muted">
              Mensaje de prueba
            </p>
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Teléfono (o usa ADMIN_NOTIFY_PHONES)"
              className="mt-3 w-full border border-gold/25 bg-ink-2 px-3 py-2 text-sm outline-none focus:border-gold/50"
            />
            <button
              type="button"
              onClick={sendTest}
              disabled={!!busy || !status?.configured}
              className="mt-3 inline-flex items-center gap-2 border border-gold/30 px-5 py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-gold-light disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === 'test' ? 'Enviando…' : 'Enviar prueba'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
