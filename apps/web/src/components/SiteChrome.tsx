'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { API_URL } from '@/lib/api';
import { useEffect, useState } from 'react';

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isAdmin = path.startsWith('/admin');
  const { count } = useCart();
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/whatsapp-link`)
      .then((r) => r.json())
      .then((d) => setWa(d.url))
      .catch(() => {});
  }, []);

  if (isAdmin) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      <div className="jh-grid pointer-events-none fixed inset-0 z-0" />
      <div className="jh-scanlines pointer-events-none fixed inset-0 z-[1]" />

      <header className="relative z-20 flex items-center justify-between border-b border-gold/15 bg-ink/70 px-5 py-4 backdrop-blur-md md:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <span className="font-display text-3xl tracking-wide text-gradient-gold md:text-4xl">
            JH HOGAR
          </span>
          <span className="hidden border-l border-gold/25 pl-3 font-raj text-[10px] font-semibold uppercase tracking-[0.25em] text-chrome-muted sm:block">
            Artículos & Electro
          </span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-4">
          <Link
            href="/tienda"
            className="font-raj text-xs font-semibold uppercase tracking-[0.2em] text-chrome-muted transition hover:text-gold-light"
          >
            Tienda
          </Link>
          <Link
            href="/pedido"
            className="hidden font-raj text-xs font-semibold uppercase tracking-[0.2em] text-chrome-muted transition hover:text-gold-light sm:inline"
          >
            Seguimiento
          </Link>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 px-3 py-1.5 font-raj text-[10px] font-bold uppercase tracking-widest text-gold-light transition hover:border-gold/50 hover:bg-gold/10"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
          <Link
            href="/carrito"
            className="relative inline-flex items-center justify-center rounded-full border border-gold/30 p-2 text-gold-light transition hover:bg-gold/10"
          >
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink"
              >
                {count}
              </motion.span>
            )}
          </Link>
        </nav>
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-gold/10 px-6 py-10 text-center">
        <p className="font-display text-2xl tracking-wider text-gradient-gold">JH HOGAR</p>
        <p className="mt-2 font-raj text-xs uppercase tracking-[0.3em] text-chrome-muted">
          Artículos y electrodomésticos para el hogar
        </p>
        <p className="mt-4 text-xs text-chrome-muted/70">
          Powered by{' '}
          <a href="https://renace.tech" className="text-gold/80 hover:text-gold-light">
            Renace.tech
          </a>
        </p>
      </footer>
    </div>
  );
}
