'use client';

import { useEffect, useState } from 'react';
import { api, money, type Product } from '@/lib/api';
import { token } from '@/components/AdminShell';

export default function AdminProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api<Product[]>('/products', { token: token() })
      .then(setProducts)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Productos</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Catálogo local sincronizado desde Odoo (solo lectura en MVP).
      </p>
      <div className="mt-8 overflow-x-auto border border-gold/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-3 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Detal</th>
              <th className="px-4 py-3">Mayor</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-gold/10">
                <td className="px-4 py-3 text-chrome-muted">{p.sku || '—'}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-chrome-muted">{p.company?.name}</td>
                <td className="px-4 py-3">{money(p.priceDetal)}</td>
                <td className="px-4 py-3">{money(p.priceMayor)}</td>
                <td className="px-4 py-3">{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
