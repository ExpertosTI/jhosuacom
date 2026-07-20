/** Base URL del API. En producción usar path relativo `/api` (proxy Next → Nest). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export type PriceMode = 'detal' | 'mayor';

export type Company = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  priceDetal: string;
  priceMayor: string;
  minMayorQty: number;
  stock: string;
  featured: boolean;
  company?: Company;
  companyId: string;
};

export type CatalogResponse = {
  brand: { brandName?: string; tagline?: string };
  companies: Company[];
  products: Product[];
};

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API ${res.status}`);
  }
  return res.json();
}

export function money(n: string | number) {
  const v = Number(n);
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);
}

export function unitPrice(p: Product, mode: PriceMode, qty: number) {
  if (mode === 'mayor' && qty >= (p.minMayorQty || 6)) return Number(p.priceMayor);
  return Number(p.priceDetal);
}
