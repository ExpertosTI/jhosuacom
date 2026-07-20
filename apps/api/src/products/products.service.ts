import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { companies, products } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';

export type ProductUpdateInput = {
  name?: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  priceDetal?: string | number;
  priceMayor?: string | number;
  minMayorQty?: number;
  stock?: string | number;
  featured?: boolean;
  active?: boolean;
  priceLocked?: boolean;
  imageUrl?: string | null;
  imageUrls?: string[];
};

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async list(opts: {
    company?: string;
    q?: string;
    featured?: boolean;
    active?: 'true' | 'false' | 'all';
    limit?: number;
    offset?: number;
  }) {
    const conditions: any[] = [];
    const activeMode = opts.active || 'true';
    if (activeMode === 'true') conditions.push(eq(products.active, true));
    if (activeMode === 'false') conditions.push(eq(products.active, false));

    if (opts.company) {
      const co = await this.db.query.companies.findFirst({
        where: or(eq(companies.slug, opts.company), eq(companies.id, opts.company)),
      });
      if (co) conditions.push(eq(products.companyId, co.id));
    }
    if (opts.featured) conditions.push(eq(products.featured, true));
    if (opts.q?.trim()) {
      const term = `%${opts.q.trim()}%`;
      conditions.push(
        or(ilike(products.name, term), ilike(products.sku, term), ilike(products.category, term)),
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(200, Math.max(1, opts.limit || 50));
    const offset = Math.max(0, opts.offset || 0);

    const [totalRow] = await this.db
      .select({ c: count() })
      .from(products)
      .where(where);

    const rows = await this.db.query.products.findMany({
      where,
      with: { company: true },
      orderBy: [desc(products.updatedAt), asc(products.name)],
      limit,
      offset,
    });

    return {
      total: Number(totalRow?.c ?? rows.length),
      limit,
      offset,
      products: rows,
    };
  }

  async get(id: string) {
    const row = await this.db.query.products.findFirst({
      where: eq(products.id, id),
      with: { company: true },
    });
    if (!row) throw new NotFoundException('Producto no encontrado');
    return row;
  }

  async update(id: string, input: ProductUpdateInput) {
    const existing = await this.get(id);
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = String(input.name || '').trim();
      if (!name) throw new BadRequestException('Nombre requerido');
      patch.name = name;
    }
    if (input.sku !== undefined) patch.sku = input.sku ? String(input.sku).trim() : null;
    if (input.category !== undefined) {
      patch.category = input.category ? String(input.category).trim() : null;
    }
    if (input.description !== undefined) {
      patch.description = input.description ? String(input.description).trim() : null;
      patch.descriptionSource = 'human';
    }
    if (input.priceDetal !== undefined) {
      patch.priceDetal = String(Number(input.priceDetal) || 0);
      patch.priceLocked = true;
    }
    if (input.priceMayor !== undefined) {
      patch.priceMayor = String(Number(input.priceMayor) || 0);
      patch.priceLocked = true;
    }
    if (input.minMayorQty !== undefined) {
      const n = Math.max(1, Math.floor(Number(input.minMayorQty) || 6));
      patch.minMayorQty = n;
    }
    if (input.stock !== undefined) patch.stock = String(Number(input.stock) || 0);
    if (typeof input.featured === 'boolean') patch.featured = input.featured;
    if (typeof input.active === 'boolean') patch.active = input.active;
    if (typeof input.priceLocked === 'boolean') patch.priceLocked = input.priceLocked;
    if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl || null;
    if (input.imageUrls !== undefined) {
      const urls = Array.isArray(input.imageUrls)
        ? input.imageUrls.filter((u) => typeof u === 'string' && u.trim())
        : [];
      patch.imageUrls = urls;
      if (!patch.imageUrl && urls[0]) patch.imageUrl = urls[0];
    }

    await this.db.update(products).set(patch).where(eq(products.id, existing.id));
    return this.get(id);
  }
}
