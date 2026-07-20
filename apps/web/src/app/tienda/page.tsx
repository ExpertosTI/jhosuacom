'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { api, type CatalogResponse, type PriceMode } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { ProductCard } from '@/components/ProductCard';
import { Suspense } from 'react';

function TiendaInner() {
  const params = useSearchParams();
  const empresa = params.get('empresa') || '';
  const { priceMode, setPriceMode } = useCart();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [q, setQ] = useState('');
  const [company, setCompany] = useState(empresa);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCompany(empresa);
  }, [empresa]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (company) qs.set('company', company);
    if (q.trim()) qs.set('q', q.trim());
    api<CatalogResponse>(`/public/catalog?${qs}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [company, q]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; products: typeof data.products }>();
    for (const p of data.products) {
      const key = p.company?.slug || 'otros';
      const name = p.company?.name || 'Otros';
      if (!map.has(key)) map.set(key, { name, products: [] });
      map.get(key)!.products.push(p);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-raj text-xs font-semibold uppercase tracking-[0.35em] text-gold-light">
            Catálogo
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-wide text-chrome md:text-6xl">
            Tienda <span className="text-gradient-gold">JH</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-chrome-muted">
            Precios detalle y mayorista. Productos por empresa desde Odoo.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex overflow-hidden border border-gold/25">
            {(['detal', 'mayor'] as PriceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPriceMode(m)}
                className={`px-4 py-2 font-raj text-xs font-bold uppercase tracking-widest transition ${
                  priceMode === m
                    ? 'bg-gold text-ink'
                    : 'bg-ink-3 text-chrome-muted hover:text-gold-light'
                }`}
              >
                {m === 'detal' ? 'Detalle' : 'Mayor'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full border border-gold/20 bg-ink-3 py-3 pl-10 pr-4 text-sm text-chrome outline-none placeholder:text-chrome-muted/50 focus:border-gold/50"
          />
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-gold/20 bg-ink-3 px-4 py-3 font-raj text-xs font-semibold uppercase tracking-widest text-chrome outline-none focus:border-gold/50"
        >
          <option value="">Todas las empresas</option>
          {data?.companies.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="py-20 text-center font-raj text-sm uppercase tracking-widest text-chrome-muted">
          Cargando catálogo...
        </p>
      )}

      {!loading && grouped.length === 0 && (
        <p className="py-20 text-center text-chrome-muted">
          No hay productos. Ejecuta el seed o sincroniza Odoo desde el admin.
        </p>
      )}

      {grouped.map(([slug, group]) => (
        <section key={slug} className="mb-14">
          <h2 className="mb-5 border-b border-gold/15 pb-3 font-display text-3xl tracking-wide text-gradient-gold">
            {group.name}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.products.map((p) => (
              <ProductCard key={p.id} product={p} priceMode={priceMode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function TiendaPage() {
  return (
    <Suspense
      fallback={
        <p className="py-20 text-center text-chrome-muted">Cargando...</p>
      }
    >
      <TiendaInner />
    </Suspense>
  );
}
