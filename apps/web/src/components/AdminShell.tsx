'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  RefreshCw,
  LogOut,
  Wallet,
  MessageCircle,
  Bot,
} from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/deudas', label: 'Deudas', icon: Wallet },
  { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/admin/ia', label: 'IA', icon: Bot },
  { href: '/admin/odoo', label: 'Odoo', icon: RefreshCw },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jh-token');
    if (!token && path !== '/admin/login') {
      router.replace('/admin/login');
    } else {
      setReady(true);
    }
  }, [path, router]);

  if (path === '/admin/login') return <>{children}</>;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-chrome-muted">
        Cargando...
      </div>
    );
  }

  function logout() {
    localStorage.removeItem('jh-token');
    router.push('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-ink text-chrome">
      <aside className="hidden w-60 shrink-0 border-r border-gold/15 bg-ink-2 md:flex md:flex-col">
        <div className="border-b border-gold/15 px-5 py-5">
          <Link href="/" className="font-display text-2xl text-gradient-gold">
            JH HOGAR
          </Link>
          <p className="mt-1 font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
            Panel admin
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = path === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 font-raj text-xs font-semibold uppercase tracking-wider transition ${
                  active
                    ? 'border-l-2 border-gold bg-gold/10 text-gold-light'
                    : 'text-chrome-muted hover:bg-ink-3 hover:text-chrome'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="m-3 flex items-center gap-2 border border-gold/20 px-3 py-2 font-raj text-xs uppercase tracking-wider text-chrome-muted hover:text-gold-light"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gold/15 px-4 py-3 md:hidden">
          <span className="font-display text-xl text-gradient-gold">JH Admin</span>
          <button type="button" onClick={logout} className="text-xs text-chrome-muted">
            Salir
          </button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-gold/10 px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-1.5 font-raj text-[10px] uppercase tracking-wider ${
                path === item.href ? 'bg-gold/15 text-gold-light' : 'text-chrome-muted'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function token() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('jh-token') || '';
}
