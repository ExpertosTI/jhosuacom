import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { settings } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  apiKey: string;
}

export type OdooRuntimeConfig = OdooConfig & {
  mock: boolean;
  companyIds: number[];
};

/** Valores guardados en settings.key = 'odoo' (sin hardcode en código). */
export type OdooStoredSettings = {
  url?: string;
  database?: string;
  username?: string;
  apiKey?: string;
  companyIds?: string | number[];
  mock?: boolean;
};

export interface OdooCompany {
  id: number;
  name: string;
}

export interface OdooProduct {
  id: number;
  name: string;
  list_price: number;
  default_code: string | false;
  description_sale: string | false;
  qty_available: number;
  categ_id: [number, string] | false;
  company_id: [number, string] | false;
  image_128?: string | false;
  product_template_image_ids?: number[];
  /** Imágenes resueltas (base64 sin data: prefix) — principal + galería */
  images?: string[];
}

function parseCompanyIds(raw: string | number[] | undefined): number[] {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function toDataUrl(b64: string): string {
  return `data:image/jpeg;base64,${b64}`;
}

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);

  constructor(@Inject(DRIZZLE) private db: any) {}

  async getStored(): Promise<OdooStoredSettings> {
    const row = await this.db.query.settings.findFirst({
      where: eq(settings.key, 'odoo'),
    });
    return ((row?.value || {}) as OdooStoredSettings) || {};
  }

  /**
   * Config efectiva: panel admin (settings) tiene prioridad sobre .env.
   * No hay URLs/credenciales hardcodeadas en el código.
   */
  async resolveConfig(override?: Partial<OdooStoredSettings>): Promise<OdooRuntimeConfig> {
    const stored = await this.getStored();
    const merged: OdooStoredSettings = { ...stored, ...override };

    const url = (merged.url || process.env.ODOO_URL || '').trim();
    const database = (merged.database || process.env.ODOO_DB || '').trim();
    const username = (merged.username || process.env.ODOO_USERNAME || '').trim();
    const apiKey = (merged.apiKey || process.env.ODOO_API_KEY || '').trim();
    const companyIds = parseCompanyIds(
      merged.companyIds ?? process.env.ODOO_COMPANY_IDS,
    );

    let mock: boolean;
    if (typeof merged.mock === 'boolean') {
      mock = merged.mock;
    } else if (process.env.ODOO_MOCK === 'true') {
      mock = true;
    } else if (process.env.ODOO_MOCK === 'false') {
      mock = !apiKey;
    } else {
      mock = !apiKey;
    }

    return { url, database, username, apiKey, mock, companyIds };
  }

  async isMock(): Promise<boolean> {
    const cfg = await this.resolveConfig();
    return cfg.mock;
  }

  async getPublicConfig() {
    const stored = await this.getStored();
    const cfg = await this.resolveConfig();
    const fromDb = Boolean(
      stored.url || stored.database || stored.username || stored.apiKey,
    );
    return {
      url: cfg.url,
      database: cfg.database,
      username: cfg.username,
      hasApiKey: Boolean(cfg.apiKey),
      companyIds: cfg.companyIds.join(','),
      mock: cfg.mock,
      source: fromDb ? ('database' as const) : ('env' as const),
    };
  }

  async saveConfig(input: {
    url?: string;
    database?: string;
    username?: string;
    apiKey?: string;
    companyIds?: string;
    mock?: boolean;
  }) {
    const stored = await this.getStored();
    const keepKey =
      !input.apiKey ||
      input.apiKey === '********' ||
      input.apiKey === '__KEEP__';

    const next: OdooStoredSettings = {
      url: (input.url ?? stored.url ?? '').trim(),
      database: (input.database ?? stored.database ?? '').trim(),
      username: (input.username ?? stored.username ?? '').trim(),
      apiKey: keepKey ? stored.apiKey || '' : (input.apiKey || '').trim(),
      companyIds: (input.companyIds ?? stored.companyIds ?? '').toString().trim(),
      mock: typeof input.mock === 'boolean' ? input.mock : stored.mock,
    };

    const existing = await this.db.query.settings.findFirst({
      where: eq(settings.key, 'odoo'),
    });

    if (existing) {
      await this.db
        .update(settings)
        .set({ value: next, updatedAt: new Date() })
        .where(eq(settings.id, existing.id));
    } else {
      await this.db.insert(settings).values({ key: 'odoo', value: next });
    }

    return this.getPublicConfig();
  }

  private async jsonRpc(url: string, service: string, method: string, args: unknown[]) {
    const response = await fetch(`${url.replace(/\/$/, '')}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: Date.now(),
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC error');
    }
    return data.result;
  }

  async authenticate(config: OdooConfig): Promise<number> {
    const uid = await this.jsonRpc(config.url, 'common', 'authenticate', [
      config.database,
      config.username,
      config.apiKey,
      {},
    ]);
    if (!uid) throw new Error('Credenciales Odoo inválidas');
    return uid as number;
  }

  async testConnection(override?: Partial<OdooStoredSettings>): Promise<{
    ok: boolean;
    uid?: number;
    message: string;
    mock: boolean;
    url?: string;
    database?: string;
    username?: string;
  }> {
    const cfg = await this.resolveConfig(override);
    if (cfg.mock) {
      return {
        ok: true,
        mock: true,
        message: 'Modo mock activo (sin API key Odoo o mock=true)',
        url: cfg.url || undefined,
        database: cfg.database || undefined,
        username: cfg.username || undefined,
      };
    }
    if (!cfg.url || !cfg.database || !cfg.username || !cfg.apiKey) {
      return {
        ok: false,
        mock: false,
        message: 'Faltan URL, base de datos, usuario o API key',
        url: cfg.url || undefined,
        database: cfg.database || undefined,
        username: cfg.username || undefined,
      };
    }
    try {
      const uid = await this.authenticate(cfg);
      return {
        ok: true,
        uid,
        mock: false,
        message: 'Conectado a Odoo 18',
        url: cfg.url,
        database: cfg.database,
        username: cfg.username,
      };
    } catch (e: any) {
      return {
        ok: false,
        mock: false,
        message: e.message || 'Error de conexión',
        url: cfg.url,
        database: cfg.database,
        username: cfg.username,
      };
    }
  }

  async fetchCompanies(config?: OdooRuntimeConfig): Promise<OdooCompany[]> {
    const cfg = config ?? (await this.resolveConfig());
    if (cfg.mock) {
      return [
        { id: 1, name: 'JH Hogar' },
        { id: 2, name: 'Electro JH' },
        { id: 3, name: 'Muebles JH' },
      ];
    }
    const uid = await this.authenticate(cfg);
    const filterIds = cfg.companyIds;
    const domain = filterIds.length ? [[['id', 'in', filterIds]]] : [[]];
    const ids = await this.jsonRpc(cfg.url, 'object', 'execute_kw', [
      cfg.database,
      uid,
      cfg.apiKey,
      'res.company',
      'search',
      domain,
      { limit: 50 },
    ]);
    if (!ids?.length) return [];
    const rows = await this.jsonRpc(cfg.url, 'object', 'execute_kw', [
      cfg.database,
      uid,
      cfg.apiKey,
      'res.company',
      'read',
      [ids],
      { fields: ['id', 'name'] },
    ]);
    return rows as OdooCompany[];
  }

  async fetchProducts(companyId?: number, config?: OdooRuntimeConfig): Promise<OdooProduct[]> {
    const cfg = config ?? (await this.resolveConfig());
    if (cfg.mock) return [];

    const uid = await this.authenticate(cfg);

    const catalogProductIds = await this.fetchCatalogProductIds(cfg, uid, companyId);
    const domain: any[] = [['sale_ok', '=', true]];
    if (catalogProductIds !== null) {
      if (!catalogProductIds.length) return [];
      domain.push(['id', 'in', catalogProductIds]);
    } else if (await this.hasField(cfg, uid, 'product.template', 'jh_show_on_website')) {
      domain.push(['jh_show_on_website', '=', true]);
    }
    if (companyId) domain.push(['company_id', 'in', [false, companyId]]);

    const hasExtraImages = await this.hasField(
      cfg,
      uid,
      'product.template',
      'product_template_image_ids',
    );

    const fields = [
      'id',
      'name',
      'list_price',
      'default_code',
      'description_sale',
      'qty_available',
      'categ_id',
      'company_id',
      'image_128',
      ...(hasExtraImages ? ['product_template_image_ids'] : []),
    ];

    const all: OdooProduct[] = [];
    const pageSize = 200;
    let offset = 0;

    while (true) {
      const productIds = await this.jsonRpc(cfg.url, 'object', 'execute_kw', [
        cfg.database,
        uid,
        cfg.apiKey,
        'product.template',
        'search',
        [domain],
        { limit: pageSize, offset },
      ]);
      if (!productIds?.length) break;

      const products = (await this.jsonRpc(cfg.url, 'object', 'execute_kw', [
        cfg.database,
        uid,
        cfg.apiKey,
        'product.template',
        'read',
        [productIds],
        { fields },
      ])) as OdooProduct[];

      await this.attachExtraImages(cfg, uid, products, hasExtraImages);
      all.push(...products);
      if (productIds.length < pageSize) break;
      offset += pageSize;
    }

    return all;
  }

  private async attachExtraImages(
    config: OdooConfig,
    uid: number,
    products: OdooProduct[],
    hasExtraImages: boolean,
  ) {
    const imageMap = new Map<number, string>();

    if (hasExtraImages) {
      const allImageIds = [
        ...new Set(products.flatMap((p) => p.product_template_image_ids || [])),
      ];
      if (allImageIds.length) {
        try {
          const rows = (await this.jsonRpc(config.url, 'object', 'execute_kw', [
            config.database,
            uid,
            config.apiKey,
            'product.image',
            'read',
            [allImageIds],
            { fields: ['id', 'image_128', 'sequence'] },
          ])) as Array<{ id: number; image_128?: string | false; sequence?: number }>;

          rows.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
          for (const row of rows) {
            if (typeof row.image_128 === 'string' && row.image_128.length > 20) {
              imageMap.set(row.id, row.image_128);
            }
          }
        } catch (e: any) {
          this.logger.warn(`No se pudieron leer product.image: ${e.message}`);
        }
      }
    }

    for (const p of products) {
      const images: string[] = [];
      if (typeof p.image_128 === 'string' && p.image_128.length > 20) {
        images.push(p.image_128);
      }
      for (const iid of p.product_template_image_ids || []) {
        const b64 = imageMap.get(iid);
        if (b64 && !images.includes(b64)) images.push(b64);
      }
      p.images = images;
    }
  }

  /** IDs de product.template en catálogos publicados. null = módulo no instalado. */
  private async fetchCatalogProductIds(
    config: OdooConfig,
    uid: number,
    companyId?: number,
  ): Promise<number[] | null> {
    try {
      const domain: any[] = [
        ['published', '=', true],
        ['active', '=', true],
      ];
      if (companyId) domain.push(['company_id', '=', companyId]);

      const catalogIds = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'jh.website.catalog',
        'search',
        [domain],
        { limit: 200 },
      ]);
      if (!catalogIds?.length) return [];

      const catalogs = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'jh.website.catalog',
        'read',
        [catalogIds],
        { fields: ['id', 'product_ids'] },
      ]);

      const set = new Set<number>();
      for (const c of catalogs as Array<{ product_ids: number[] }>) {
        for (const pid of c.product_ids || []) set.add(pid);
      }
      return Array.from(set);
    } catch (e: any) {
      this.logger.warn(
        `jh.website.catalog no disponible (${e.message}) — fallback sale_ok / jh_show_on_website`,
      );
      return null;
    }
  }

  private async hasField(
    config: OdooConfig,
    uid: number,
    model: string,
    field: string,
  ): Promise<boolean> {
    try {
      const fields = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        model,
        'fields_get',
        [[field]],
        { attributes: ['string'] },
      ]);
      return Boolean(fields && fields[field]);
    } catch {
      return false;
    }
  }

  /** Crea cotización (sale.order en draft) y retorna id + name */
  async createQuotation(input: {
    partnerId?: number;
    partnerName: string;
    partnerPhone: string;
    companyId?: number;
    notes?: string;
    lines: Array<{ productTemplateId: number; qty: number; price: number }>;
  }): Promise<{ id: number; name: string } | null> {
    const config = await this.resolveConfig();
    if (config.mock) {
      const fakeId = Math.floor(Math.random() * 9000) + 1000;
      return { id: fakeId, name: `S${fakeId}` };
    }

    const uid = await this.authenticate(config);

    let partnerId = input.partnerId;
    if (!partnerId) {
      const found = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'res.partner',
        'search',
        [[['phone', 'ilike', input.partnerPhone.replace(/\D/g, '').slice(-8)]]],
        { limit: 1 },
      ]);
      if (found?.length) {
        partnerId = found[0];
      } else {
        partnerId = await this.jsonRpc(config.url, 'object', 'execute_kw', [
          config.database,
          uid,
          config.apiKey,
          'res.partner',
          'create',
          [
            {
              name: input.partnerName,
              phone: input.partnerPhone,
              customer_rank: 1,
            },
          ],
        ]);
      }
    }

    const orderVals: Record<string, unknown> = {
      partner_id: partnerId,
      note: input.notes || 'Pedido desde tienda JH Hogar',
    };
    if (input.companyId) orderVals.company_id = input.companyId;

    const orderId = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'sale.order',
      'create',
      [orderVals],
    ]);

    for (const line of input.lines) {
      const variantIds = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'product.product',
        'search',
        [[['product_tmpl_id', '=', line.productTemplateId]]],
        { limit: 1 },
      ]);
      const productId = variantIds?.[0];
      if (!productId) {
        this.logger.warn(`Sin variante para template ${line.productTemplateId}`);
        continue;
      }
      await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'sale.order.line',
        'create',
        [
          {
            order_id: orderId,
            product_id: productId,
            product_uom_qty: line.qty,
            price_unit: line.price,
          },
        ],
      ]);
    }

    const [order] = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'sale.order',
      'read',
      [[orderId]],
      { fields: ['id', 'name'] },
    ]);

    return { id: order.id, name: order.name };
  }

  async fetchPartnerDebt(partnerId: number): Promise<number> {
    const config = await this.resolveConfig();
    if (config.mock) return 0;
    const uid = await this.authenticate(config);
    const [partner] = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'res.partner',
      'read',
      [[partnerId]],
      { fields: ['total_due', 'credit'] },
    ]);
    return Number(partner?.total_due ?? partner?.credit ?? 0);
  }

  async fetchSaleOrderStatus(orderId: number): Promise<{ state: string; name: string } | null> {
    const config = await this.resolveConfig();
    if (config.mock) return { state: 'draft', name: `S${orderId}` };
    const uid = await this.authenticate(config);
    const rows = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'sale.order',
      'read',
      [[orderId]],
      { fields: ['id', 'name', 'state'] },
    ]);
    return rows?.[0] || null;
  }

  /** Helper para sync: convierte lista base64 → data URLs */
  static imagesToUrls(images: string[] | undefined): { imageUrl: string | null; imageUrls: string[] } {
    const urls = (images || []).filter((b) => b && b.length > 20).map(toDataUrl);
    return { imageUrl: urls[0] || null, imageUrls: urls };
  }
}
