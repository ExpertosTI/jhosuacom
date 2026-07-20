import { Injectable, Logger } from '@nestjs/common';

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  apiKey: string;
}

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
}

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);

  isMock(): boolean {
    return process.env.ODOO_MOCK === 'true' || !process.env.ODOO_API_KEY;
  }

  getConfig(): OdooConfig {
    return {
      url: process.env.ODOO_URL || '',
      database: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      apiKey: process.env.ODOO_API_KEY || '',
    };
  }

  companyFilterIds(): number[] {
    const raw = process.env.ODOO_COMPANY_IDS || '';
    return raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
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

  async testConnection(): Promise<{ ok: boolean; uid?: number; message: string; mock: boolean }> {
    if (this.isMock()) {
      return { ok: true, mock: true, message: 'Modo mock activo (sin API key Odoo)' };
    }
    try {
      const uid = await this.authenticate(this.getConfig());
      return { ok: true, uid, mock: false, message: 'Conectado a Odoo' };
    } catch (e: any) {
      return { ok: false, mock: false, message: e.message || 'Error de conexión' };
    }
  }

  async fetchCompanies(config = this.getConfig()): Promise<OdooCompany[]> {
    if (this.isMock()) {
      return [
        { id: 1, name: 'JH Hogar' },
        { id: 2, name: 'Electro JH' },
        { id: 3, name: 'Muebles JH' },
      ];
    }
    const uid = await this.authenticate(config);
    const filterIds = this.companyFilterIds();
    const domain = filterIds.length ? [[['id', 'in', filterIds]]] : [[]];
    const ids = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'res.company',
      'search',
      domain,
      { limit: 50 },
    ]);
    if (!ids?.length) return [];
    const rows = await this.jsonRpc(config.url, 'object', 'execute_kw', [
      config.database,
      uid,
      config.apiKey,
      'res.company',
      'read',
      [ids],
      { fields: ['id', 'name'] },
    ]);
    return rows as OdooCompany[];
  }

  async fetchProducts(config = this.getConfig(), companyId?: number): Promise<OdooProduct[]> {
    if (this.isMock()) return [];

    const uid = await this.authenticate(config);
    const domain: any[] = [['sale_ok', '=', true]];
    if (companyId) domain.push(['company_id', 'in', [false, companyId]]);

    const all: OdooProduct[] = [];
    const pageSize = 200;
    let offset = 0;

    while (true) {
      const productIds = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'product.template',
        'search',
        [domain],
        { limit: pageSize, offset },
      ]);
      if (!productIds?.length) break;

      const products = await this.jsonRpc(config.url, 'object', 'execute_kw', [
        config.database,
        uid,
        config.apiKey,
        'product.template',
        'read',
        [productIds],
        {
          fields: [
            'id',
            'name',
            'list_price',
            'default_code',
            'description_sale',
            'qty_available',
            'categ_id',
            'company_id',
          ],
        },
      ]);
      all.push(...(products as OdooProduct[]));
      if (productIds.length < pageSize) break;
      offset += pageSize;
    }

    return all;
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
    if (this.isMock()) {
      const fakeId = Math.floor(Math.random() * 9000) + 1000;
      return { id: fakeId, name: `S${fakeId}` };
    }

    const config = this.getConfig();
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
      // product.template → product.product (variante)
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
    if (this.isMock()) return 0;
    const config = this.getConfig();
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
    if (this.isMock()) return { state: 'draft', name: `S${orderId}` };
    const config = this.getConfig();
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
}
