'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import { api, money, type Company, type Product } from '@/lib/api';
import { token } from '@/components/AdminShell';

type ListResponse = {
  total: number;
  limit: number;
  offset: number;
  products: Product[];
};

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  category: '',
  priceDetal: '0',
  priceMayor: '0',
  minMayorQty: 6,
  stock: '0',
  featured: false,
  active: true,
  priceLocked: false,
  imageUrl: '',
};

const PAGE_SIZE = 50;

export default function AdminProductosPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [company, setCompany] = useState('');
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (opts?: { append?: boolean; offset?: number }) => {
      const off = opts?.offset ?? 0;
      const qs = new URLSearchParams();
      qs.set('active', active);
      qs.set('limit', String(PAGE_SIZE));
      qs.set('offset', String(off));
      if (qDebounced.trim()) qs.set('q', qDebounced.trim());
      if (company) qs.set('company', company);
      if (featuredOnly) qs.set('featured', '1');
      const res = await api<ListResponse>(`/products?${qs}`, { token: token() });
      setData((prev) =>
        opts?.append && prev
          ? { ...res, products: [...prev.products, ...res.products] }
          : res,
      );
    },
    [qDebounced, company, active, featuredOnly],
  );

  useEffect(() => {
    api<Company[]>('/companies', { token: token() })
      .then(setCompanies)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load({ offset: 0 }).catch(() => setData({ total: 0, limit: PAGE_SIZE, offset: 0, products: [] }));
  }, [load]);

  async function reload() {
    await load({ offset: 0 });
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      description: p.description || p.aiDescription || '',
      category: p.category || '',
      priceDetal: String(p.priceDetal ?? '0'),
      priceMayor: String(p.priceMayor ?? '0'),
      minMayorQty: p.minMayorQty || 6,
      stock: String(p.stock ?? '0'),
      featured: Boolean(p.featured),
      active: p.active !== false,
      priceLocked: Boolean(p.priceLocked),
      imageUrl: p.imageUrl || '',
    });
    setMsg('');
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setMsg('');
    try {
      await api(`/products/${editing.id}`, {
        method: 'PATCH',
        token: token(),
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || null,
          description: form.description || null,
          category: form.category || null,
          priceDetal: form.priceDetal,
          priceMayor: form.priceMayor,
          minMayorQty: Number(form.minMayorQty) || 6,
          stock: form.stock,
          featured: form.featured,
          active: form.active,
          priceLocked: form.priceLocked,
          imageUrl: form.imageUrl || null,
        }),
      });
      setMsg('Guardado');
      setEditing(null);
      await reload();
    } catch (e: any) {
      setMsg(e.message || 'Error al guardar');
    } finally {
      setBusy(false);
    }
  }

  async function quickToggle(p: Product, field: 'featured' | 'active') {
    await api(`/products/${p.id}`, {
      method: 'PATCH',
      token: token(),
      body: JSON.stringify({ [field]: !p[field] }),
    });
    await reload();
  }

  async function loadMore() {
    const next = data?.products.length || 0;
    await load({ append: true, offset: next });
  }

  const shown = data?.products.length || 0;
  const total = data?.total || 0;
  const hasMore = shown < total;

  const inputClass =
    'mt-1 w-full border border-gold/20 bg-ink px-3 py-2 text-sm text-chrome outline-none focus:border-gold/50';

  return (
    <div>
      <h1 className="font-display text-4xl text-chrome">Productos</h1>
      <p className="mt-1 text-sm text-chrome-muted">
        Edita precios, destacado, activo y descripciones. Sync Odoo respeta precios bloqueados y
        textos humanos.
      </p>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, SKU, categoría…"
            className="w-full border border-gold/20 bg-ink-3 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gold/50"
          />
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-gold/20 bg-ink-3 px-3 py-2.5 font-raj text-xs uppercase tracking-wider"
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value as any)}
          className="border border-gold/20 bg-ink-3 px-3 py-2.5 font-raj text-xs uppercase tracking-wider"
        >
          <option value="all">Activos + inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-chrome-muted">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
            className="accent-gold"
          />
          Destacados
        </label>
      </div>

      <p className="mt-3 font-raj text-[11px] uppercase tracking-wider text-chrome-muted">
        Mostrando {shown} de {total} productos
      </p>

      <div className="mt-4 overflow-x-auto border border-gold/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-3 font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
            <tr>
              <th className="px-3 py-3">Foto</th>
              <th className="px-3 py-3">Producto</th>
              <th className="px-3 py-3">Empresa</th>
              <th className="px-3 py-3">Precios</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Flags</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {(data?.products || []).map((p) => {
              const thumb = p.imageUrl || p.imageUrls?.[0];
              return (
                <tr
                  key={p.id}
                  className={`border-t border-gold/10 ${p.active === false ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-12 w-12 object-cover border border-gold/20" />
                    ) : (
                      <span className="text-chrome-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-chrome">{p.name}</p>
                    <p className="font-raj text-[10px] uppercase tracking-wider text-chrome-muted">
                      {p.sku || 'sin sku'}
                      {p.category ? ` · ${p.category}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-chrome-muted">{p.company?.name || '—'}</td>
                  <td className="px-3 py-3">
                    <p>{money(p.priceDetal)} detal</p>
                    <p className="text-chrome-muted">
                      {money(p.priceMayor)} mayor
                      {p.priceLocked ? ' · 🔒' : ''}
                    </p>
                  </td>
                  <td className="px-3 py-3">{p.stock}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => quickToggle(p, 'featured')}
                        className={`inline-flex items-center gap-1 border px-2 py-1 font-raj text-[9px] uppercase tracking-wider ${
                          p.featured
                            ? 'border-gold/50 bg-gold/15 text-gold-light'
                            : 'border-gold/15 text-chrome-muted'
                        }`}
                      >
                        <Star className="h-3 w-3" />
                        Destacado
                      </button>
                      <button
                        type="button"
                        onClick={() => quickToggle(p, 'active')}
                        className={`border px-2 py-1 font-raj text-[9px] uppercase tracking-wider ${
                          p.active !== false
                            ? 'border-gold/30 text-gold-light'
                            : 'border-gold/15 text-chrome-muted'
                        }`}
                      >
                        {p.active !== false ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="border border-gold/30 px-3 py-1.5 font-raj text-[10px] font-bold uppercase tracking-wider text-gold-light hover:bg-gold/10"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!data?.products?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-chrome-muted">
                  Sin productos. Sincroniza Odoo o ajusta filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => loadMore().catch(() => {})}
            className="border border-gold/30 px-5 py-2.5 font-raj text-xs uppercase tracking-wider text-gold-light hover:bg-gold/10"
          >
            Cargar más
          </button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-lg flex-col border-l border-gold/20 bg-ink-2 shadow-gold">
            <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
              <div>
                <p className="font-raj text-[10px] uppercase tracking-widest text-chrome-muted">
                  Editar producto
                </p>
                <p className="font-display text-2xl text-chrome">{editing.name}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar">
                <X className="h-5 w-5 text-chrome-muted" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <label className="block text-xs text-chrome-muted">
                Nombre
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-chrome-muted">
                  SKU
                  <input
                    className={inputClass}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-chrome-muted">
                  Categoría
                  <input
                    className={inputClass}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </label>
              </div>
              <label className="block text-xs text-chrome-muted">
                Descripción (queda marcada como humana)
                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-chrome-muted">
                  Precio detal
                  <input
                    className={inputClass}
                    type="number"
                    step="0.01"
                    value={form.priceDetal}
                    onChange={(e) => setForm({ ...form, priceDetal: e.target.value, priceLocked: true })}
                  />
                </label>
                <label className="block text-xs text-chrome-muted">
                  Precio mayor
                  <input
                    className={inputClass}
                    type="number"
                    step="0.01"
                    value={form.priceMayor}
                    onChange={(e) => setForm({ ...form, priceMayor: e.target.value, priceLocked: true })}
                  />
                </label>
                <label className="block text-xs text-chrome-muted">
                  Mín. mayor (qty)
                  <input
                    className={inputClass}
                    type="number"
                    value={form.minMayorQty}
                    onChange={(e) => setForm({ ...form, minMayorQty: Number(e.target.value) || 6 })}
                  />
                </label>
                <label className="block text-xs text-chrome-muted">
                  Stock
                  <input
                    className={inputClass}
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </label>
              </div>
              <label className="block text-xs text-chrome-muted">
                URL imagen principal
                <input
                  className={inputClass}
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://… o data:image…"
                />
              </label>
              <div className="flex flex-wrap gap-4 text-sm text-chrome">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    className="accent-gold"
                  />
                  Destacado (landing)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="accent-gold"
                  />
                  Activo en tienda
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.priceLocked}
                    onChange={(e) => setForm({ ...form, priceLocked: e.target.checked })}
                    className="accent-gold"
                  />
                  Bloquear precios vs sync Odoo
                </label>
              </div>
              {msg && <p className="text-sm text-gold-light">{msg}</p>}
            </div>
            <div className="flex gap-2 border-t border-gold/15 p-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 border border-gold/25 py-2.5 font-raj text-xs uppercase tracking-wider text-chrome-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="flex-1 bg-gold py-2.5 font-raj text-xs font-bold uppercase tracking-widest text-ink disabled:opacity-60"
              >
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
