'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { api } from '@/lib/api';

type ChatTurn = { role: 'user' | 'model'; text: string };

function sessionId() {
  if (typeof window === 'undefined') return 'web';
  const key = 'jh-ai-session';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function StoreChatWidget() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ enabled?: boolean; webEnabled?: boolean }>('/public/ai/status')
      .then((s) => setEnabled(Boolean(s.enabled)))
      .catch(() => setEnabled(true));
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, open, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    const next = [...history, { role: 'user' as const, text }];
    setHistory(next);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>('/public/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history,
          sessionId: sessionId(),
        }),
      });
      setHistory([
        ...next,
        {
          role: 'model',
          text:
            res.reply ||
            (res.error === 'web_ai_disabled' || res.error === 'ai_disabled'
              ? 'El asistente no está disponible ahora. Escríbenos por WhatsApp.'
              : 'No pude responder. Prueba de nuevo o WhatsApp.'),
        },
      ]);
      if (res.error === 'web_ai_disabled' || res.error === 'ai_disabled') setEnabled(false);
    } catch {
      setHistory([
        ...next,
        { role: 'model', text: 'Sin conexión al asistente. Usa WhatsApp o el catálogo.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled && !open) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[420px] w-[min(100vw-2rem,360px)] flex-col border border-gold/30 bg-ink-2 shadow-gold">
          <div className="flex items-center justify-between border-b border-gold/15 px-3 py-2">
            <p className="font-raj text-xs font-bold uppercase tracking-widest text-gold-light">
              Asistente JH
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X className="h-4 w-4 text-chrome-muted" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {history.length === 0 && (
              <p className="text-chrome-muted">
                ¿Buscas una nevera, lavadora u oferta mayorista? Pregúntame.
              </p>
            )}
            {history.map((t, i) => (
              <div
                key={i}
                className={`max-w-[90%] whitespace-pre-wrap px-2.5 py-1.5 ${
                  t.role === 'user'
                    ? 'ml-auto bg-gold/15 text-chrome'
                    : 'bg-ink-3 text-chrome'
                }`}
              >
                {t.text}
              </div>
            ))}
            {busy && <p className="text-xs text-chrome-muted">…</p>}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2 border-t border-gold/10 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Tu pregunta…"
              className="flex-1 border border-gold/20 bg-ink px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="bg-gold px-3 text-ink disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 border border-gold/40 bg-ink/90 px-4 py-3 font-raj text-xs font-bold uppercase tracking-widest text-gold-light backdrop-blur transition hover:bg-gold hover:text-ink"
      >
        <MessageCircle className="h-4 w-4" />
        {open ? 'Cerrar' : 'Ayuda IA'}
      </button>
    </div>
  );
}
