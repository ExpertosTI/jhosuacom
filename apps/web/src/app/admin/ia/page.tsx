'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { token } from '@/components/AdminShell';

type ChatTurn = { role: 'user' | 'model'; text: string };

type AiSettings = {
  enabled: boolean;
  whatsappEnabled: boolean;
  webEnabled: boolean;
  enrichOnSync: boolean;
  hasApiKey: boolean;
  model: string;
  source: string;
};

export default function AdminIaPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadSettings() {
    try {
      const s = await api<AiSettings>('/ai/settings', { token: token() });
      setSettings(s);
    } catch {
      setSettings(null);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, busy]);

  async function saveSettings(patch: Partial<AiSettings> & { geminiApiKey?: string }) {
    setBusy(true);
    setMsg('');
    try {
      const body: Record<string, unknown> = { ...patch };
      if (apiKey.trim()) body.geminiApiKey = apiKey.trim();
      const s = await api<AiSettings>('/ai/settings', {
        method: 'PUT',
        token: token(),
        body: JSON.stringify(body),
      });
      setSettings(s);
      setApiKey('');
      setMsg('Configuración IA guardada');
    } catch (e: any) {
      setMsg(e.message || 'Error al guardar');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMsg('');
    const nextHistory = [...history, { role: 'user' as const, text }];
    setHistory(nextHistory);
    try {
      const res = await api<{
        ok: boolean;
        reply: string;
        error?: string | null;
        actions?: Array<{ tool: string }>;
      }>('/ai/chat', {
        method: 'POST',
        token: token(),
        body: JSON.stringify({
          message: text,
          history,
          role: 'admin',
        }),
      });
      if (res.ok && res.reply) {
        setHistory([...nextHistory, { role: 'model', text: res.reply }]);
      } else {
        setMsg(res.error || 'Sin respuesta');
        setHistory([
          ...nextHistory,
          { role: 'model', text: res.reply || 'No pude responder. Revisa la API key de Gemini.' },
        ]);
      }
    } catch (e: any) {
      setMsg(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-chrome">Asistente IA</h1>
          <p className="mt-1 text-sm text-chrome-muted">
            Copiloto admin · pedidos, deudas, Odoo y borradores WhatsApp
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className="inline-flex items-center gap-2 border border-gold/30 px-3 py-2 font-raj text-[10px] uppercase tracking-wider text-gold-light"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Config
        </button>
      </div>

      {showSettings && settings && (
        <div className="mt-4 border border-gold/15 bg-ink-3/50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-chrome">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="accent-gold"
              />
              IA activa
            </label>
            <label className="flex items-center gap-2 text-sm text-chrome">
              <input
                type="checkbox"
                checked={settings.whatsappEnabled}
                onChange={(e) => setSettings({ ...settings, whatsappEnabled: e.target.checked })}
                className="accent-gold"
              />
              Vendedor WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-chrome">
              <input
                type="checkbox"
                checked={settings.webEnabled}
                onChange={(e) => setSettings({ ...settings, webEnabled: e.target.checked })}
                className="accent-gold"
              />
              Chat tienda web
            </label>
            <label className="flex items-center gap-2 text-sm text-chrome">
              <input
                type="checkbox"
                checked={settings.enrichOnSync}
                onChange={(e) => setSettings({ ...settings, enrichOnSync: e.target.checked })}
                className="accent-gold"
              />
              Enrichment al sync Odoo
            </label>
            <label className="block text-xs text-chrome-muted md:col-span-2">
              Gemini API key {settings.hasApiKey ? '(dejar vacío para no cambiar)' : ''}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.hasApiKey ? '••••••••' : 'AIza…'}
                className="mt-1 w-full border border-gold/20 bg-ink px-3 py-2 text-sm text-chrome outline-none"
                autoComplete="off"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-chrome-muted">
            Modelo: {settings.model} · origen: {settings.source} ·{' '}
            {settings.hasApiKey ? 'key OK' : 'sin key'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              saveSettings({
                enabled: settings.enabled,
                whatsappEnabled: settings.whatsappEnabled,
                webEnabled: settings.webEnabled,
                enrichOnSync: settings.enrichOnSync,
              })
            }
            className="mt-3 bg-gold px-4 py-2 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col border border-gold/15 bg-ink-3/40">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {history.length === 0 && (
            <div className="flex items-start gap-2 text-sm text-chrome-muted">
              <Bot className="mt-0.5 h-4 w-4 text-gold-light" />
              <p>
                Pregunta por ejemplo: «¿Cuántos pedidos recibidos hoy?», «Lista deudas mayores a
                1000», «Estado de Odoo».
              </p>
            </div>
          )}
          {history.map((t, i) => (
            <div
              key={i}
              className={`max-w-[90%] whitespace-pre-wrap text-sm ${
                t.role === 'user'
                  ? 'ml-auto border border-gold/25 bg-gold/10 px-3 py-2 text-chrome'
                  : 'border border-gold/10 bg-ink-2 px-3 py-2 text-chrome'
              }`}
            >
              {t.text}
            </div>
          ))}
          {busy && <p className="text-xs text-chrome-muted">Pensando…</p>}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t border-gold/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Escribe al copiloto…"
            className="flex-1 border border-gold/25 bg-ink-2 px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-2 bg-gold px-4 py-2 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-chrome-muted">{msg}</p>}
    </div>
  );
}
