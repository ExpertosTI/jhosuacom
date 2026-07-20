import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/lib/cart';
import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'JH Hogar | Artículos y Electrodomésticos',
  description: 'Tienda mayor y detal — catálogo multi-empresa conectado a Odoo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <CartProvider>
          <SiteChrome>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
