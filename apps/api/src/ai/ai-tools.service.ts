import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import { companies, customers, orders, products } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OrdersService } from '../orders/orders.service';
import { OdooService } from '../odoo/odoo.service';
import { OdooSyncService } from '../odoo/odoo-sync.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { ToolDeclaration } from './gemini.client';

export type AiRole = 'sales' | 'admin' | 'catalog';

export type ToolContext = {
  role: AiRole;
  channel: 'whatsapp' | 'admin' | 'web';
  phone?: string;
  customerName?: string;
  actor?: string;
  /** Marca conversación WA como humana */
  onHandoff?: (reason: string) => Promise<void>;
};

function money(n: string | number) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private orders: OrdersService,
    private odoo: OdooService,
    private sync: OdooSyncService,
    private wa: WhatsAppService,
  ) {}

  salesTools(): ToolDeclaration[] {
    return [
      {
        name: 'search_products',
        description: 'Busca productos activos en el catálogo JH Hogar por nombre, SKU o categoría.',
        parameters: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Texto de búsqueda' },
            company: { type: 'string', description: 'Slug o nombre de empresa (opcional)' },
            priceMode: { type: 'string', enum: ['detal', 'mayor'], description: 'Modo de precio' },
            limit: { type: 'number', description: 'Máx resultados (default 8)' },
          },
          required: ['q'],
        },
      },
      {
        name: 'get_product',
        description: 'Detalle de un producto por id UUID.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      {
        name: 'get_customer_by_phone',
        description: 'Cliente y deuda por teléfono.',
        parameters: {
          type: 'object',
          properties: { phone: { type: 'string' } },
          required: ['phone'],
        },
      },
      {
        name: 'get_order_status',
        description: 'Estado de un pedido por número (ej. JH26-00001).',
        parameters: {
          type: 'object',
          properties: { number: { type: 'string' } },
          required: ['number'],
        },
      },
      {
        name: 'create_order',
        description:
          'Crea un pedido real. SOLO si el cliente confirmó explícitamente (confirmed=true).',
        parameters: {
          type: 'object',
          properties: {
            confirmed: { type: 'boolean' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            priceMode: { type: 'string', enum: ['detal', 'mayor'] },
            notes: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                },
                required: ['productId', 'quantity'],
              },
            },
          },
          required: ['confirmed', 'customerName', 'customerPhone', 'items'],
        },
      },
      {
        name: 'handoff_to_human',
        description: 'Escala a un asesor humano y notifica al admin.',
        parameters: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    ];
  }

  adminTools(): ToolDeclaration[] {
    return [
      {
        name: 'dashboard_kpis',
        description: 'KPIs del negocio: pedidos, productos, deudas, última sync.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'list_orders',
        description: 'Lista pedidos recientes.',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['received', 'quoted', 'confirmed', 'invoiced', 'cancelled', 'all'],
            },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'update_order_status',
        description: 'Cambia estado de un pedido por id.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['received', 'quoted', 'confirmed', 'invoiced', 'cancelled'],
            },
          },
          required: ['id', 'status'],
        },
      },
      {
        name: 'list_debts',
        description: 'Clientes con deuda pendiente.',
        parameters: {
          type: 'object',
          properties: { minAmount: { type: 'number' }, limit: { type: 'number' } },
        },
      },
      {
        name: 'draft_debt_message',
        description: 'Redacta mensaje de cobro (no envía).',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            debtAmount: { type: 'string' },
          },
          required: ['customerName', 'debtAmount'],
        },
      },
      {
        name: 'send_debt_reminders',
        description: 'Envía recordatorios de deuda por WhatsApp. Requiere confirmed=true.',
        parameters: {
          type: 'object',
          properties: {
            confirmed: { type: 'boolean' },
            minAmount: { type: 'number' },
          },
          required: ['confirmed'],
        },
      },
      {
        name: 'odoo_status',
        description: 'Estado de conexión Odoo.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'trigger_sync',
        description: 'Sincroniza catálogo desde Odoo. Requiere confirmed=true.',
        parameters: {
          type: 'object',
          properties: { confirmed: { type: 'boolean' } },
          required: ['confirmed'],
        },
      },
      {
        name: 'draft_whatsapp',
        description: 'Redacta un mensaje WhatsApp (no envía).',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            intent: { type: 'string' },
          },
          required: ['intent'],
        },
      },
      {
        name: 'send_whatsapp',
        description: 'Envía WhatsApp. Requiere confirmed=true.',
        parameters: {
          type: 'object',
          properties: {
            confirmed: { type: 'boolean' },
            phone: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['confirmed', 'phone', 'text'],
        },
      },
      {
        name: 'search_products',
        description: 'Busca productos del catálogo.',
        parameters: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['q'],
        },
      },
    ];
  }

  webTools(): ToolDeclaration[] {
    return this.salesTools().filter((t) => t.name !== 'create_order' && t.name !== 'handoff_to_human');
  }

  toolsFor(role: AiRole, channel: ToolContext['channel']): ToolDeclaration[] {
    if (channel === 'web') return this.webTools();
    if (role === 'admin') return this.adminTools();
    return this.salesTools();
  }

  async runTool(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<Record<string, unknown>> {
    try {
      switch (name) {
        case 'search_products':
          return this.searchProducts(args);
        case 'get_product':
          return this.getProduct(String(args.id || ''));
        case 'get_customer_by_phone':
          return this.getCustomerByPhone(String(args.phone || ctx.phone || ''));
        case 'get_order_status':
          return this.getOrderStatus(String(args.number || ''));
        case 'create_order':
          return this.createOrder(args, ctx);
        case 'handoff_to_human':
          return this.handoff(String(args.reason || 'cliente pidió asesor'), ctx);
        case 'dashboard_kpis':
          return this.dashboardKpis();
        case 'list_orders':
          return this.listOrders(args);
        case 'update_order_status':
          return this.updateOrderStatus(String(args.id || ''), String(args.status || ''));
        case 'list_debts':
          return this.listDebts(args);
        case 'draft_debt_message':
          return {
            draft:
              `Hola ${args.customerName},\n` +
              `Te recordamos un saldo pendiente con JH Hogar por *$${args.debtAmount}*.\n` +
              `Si ya pagaste, ignora este mensaje. ¿Necesitas ayuda? Responde aquí.`,
          };
        case 'send_debt_reminders':
          return this.sendDebtReminders(args);
        case 'odoo_status':
          return this.odoo.testConnection();
        case 'trigger_sync':
          if (!args.confirmed) return { ok: false, error: 'confirmed_required' };
          return this.sync.syncAll();
        case 'draft_whatsapp':
          return {
            draft: String(args.intent || ''),
            to: args.to || null,
            note: 'Borrador — usa send_whatsapp con confirmed=true para enviar',
          };
        case 'send_whatsapp':
          if (!args.confirmed) return { ok: false, error: 'confirmed_required' };
          return this.wa.sendText(String(args.phone || ''), String(args.text || ''));
        default:
          return { error: 'unknown_tool', name };
      }
    } catch (e: any) {
      this.logger.warn(`tool ${name}: ${e.message}`);
      return { ok: false, error: e.message || 'tool_failed' };
    }
  }

  private async searchProducts(args: Record<string, unknown>) {
    const q = String(args.q || '').trim();
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 8));
    const conditions: any[] = [eq(products.active, true)];
    if (q) {
      const term = `%${q}%`;
      conditions.push(
        or(ilike(products.name, term), ilike(products.sku, term), ilike(products.category, term)),
      );
    }
    if (args.company) {
      const cos = await this.db.query.companies.findMany({ where: eq(companies.active, true) });
      const needle = String(args.company).toLowerCase();
      const co = cos.find(
        (c: any) =>
          c.slug === needle || c.name.toLowerCase().includes(needle) || c.id === args.company,
      );
      if (co) conditions.push(eq(products.companyId, co.id));
    }

    const rows = await this.db.query.products.findMany({
      where: and(...conditions),
      with: { company: true },
      orderBy: [asc(products.name)],
      limit,
    });

    const priceMode = args.priceMode === 'mayor' ? 'mayor' : 'detal';
    return {
      count: rows.length,
      products: rows.map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description || p.aiDescription || null,
        category: p.category,
        company: p.company?.name,
        priceDetal: money(p.priceDetal),
        priceMayor: money(p.priceMayor),
        minMayorQty: p.minMayorQty,
        stock: money(p.stock),
        displayPrice: priceMode === 'mayor' ? money(p.priceMayor) : money(p.priceDetal),
        priceMode,
      })),
    };
  }

  private async getProduct(id: string) {
    if (!id) return { ok: false, error: 'id_required' };
    const p = await this.db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.active, true)),
      with: { company: true },
    });
    if (!p) return { ok: false, error: 'not_found' };
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description || p.aiDescription || null,
      category: p.category,
      company: p.company?.name,
      priceDetal: money(p.priceDetal),
      priceMayor: money(p.priceMayor),
      minMayorQty: p.minMayorQty,
      stock: money(p.stock),
      imageUrl: p.imageUrl ? 'yes' : null,
    };
  }

  private async getCustomerByPhone(phone: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 8) return { ok: false, error: 'invalid_phone' };
    const c = await this.db.query.customers.findFirst({
      where: eq(customers.phone, digits),
    });
    if (!c) return { found: false, phone: digits };
    return {
      found: true,
      name: c.name,
      phone: c.phone,
      debtAmount: money(c.debtAmount),
      priceMode: c.priceMode,
    };
  }

  private async getOrderStatus(number: string) {
    const n = String(number || '').trim().toUpperCase();
    if (!n) return { ok: false, error: 'number_required' };
    try {
      const o = await this.orders.getByNumber(n);
      return {
        number: o.number,
        status: o.status,
        total: money(o.total),
        customerName: o.customerName,
        items: (o.items || []).map((i: any) => ({
          name: i.name,
          qty: money(i.quantity),
          lineTotal: money(i.lineTotal),
        })),
        odooSaleOrderName: o.odooSaleOrderName,
      };
    } catch {
      return { ok: false, error: 'not_found' };
    }
  }

  private async createOrder(args: Record<string, unknown>, ctx: ToolContext) {
    if (ctx.channel === 'web') {
      return {
        ok: false,
        error: 'use_checkout_or_whatsapp',
        message: 'En la web usa el carrito o escribe por WhatsApp para confirmar el pedido.',
      };
    }
    if (!args.confirmed) {
      return {
        ok: false,
        error: 'confirmation_required',
        message:
          'Debes preguntar al cliente y solo llamar create_order con confirmed=true cuando diga que sí.',
      };
    }
    const items = Array.isArray(args.items) ? args.items : [];
    const phone = String(args.customerPhone || ctx.phone || '').replace(/\D/g, '');
    const name = String(args.customerName || ctx.customerName || '').trim() || 'Cliente WA';
    if (!items.length) return { ok: false, error: 'items_required' };

    const payload = {
      customerName: name,
      customerPhone: phone,
      priceMode: (args.priceMode === 'mayor' ? 'mayor' : 'detal') as 'detal' | 'mayor',
      notes: String(args.notes || 'Pedido vía asistente IA WhatsApp'),
      items: items.map((i: any) => ({
        productId: String(i.productId),
        quantity: Number(i.quantity),
      })),
      idempotencyKey: this.orders.buildIdempotencyKey(
        phone,
        items.map((i: any) => ({ productId: String(i.productId), quantity: Number(i.quantity) })),
      ),
    };

    const order = await this.orders.create(payload);
    return {
      ok: true,
      number: order.number,
      total: money(order.total),
      status: order.status,
      id: order.id,
    };
  }

  private async handoff(reason: string, ctx: ToolContext) {
    if (ctx.onHandoff) await ctx.onHandoff(reason);
    const phone = ctx.phone || 'desconocido';
    await this.wa.notifyAdminsNewOrder({
      number: 'HANDOFF',
      customerName: ctx.customerName || 'Cliente WA',
      customerPhone: phone,
      total: '0',
      itemsSummary: `🤝 Handoff IA → humano\nMotivo: ${reason}`,
    });
    return { ok: true, handedOff: true, reason };
  }

  private async dashboardKpis() {
    const [orderStats] = await this.db.execute(sql`
      select
        count(*)::int as total,
        count(*) filter (where status = 'received')::int as received,
        count(*) filter (where status = 'quoted')::int as quoted,
        count(*) filter (where status = 'confirmed')::int as confirmed,
        coalesce(sum(total::numeric) filter (where created_at > now() - interval '30 days'), 0)::text as sales_30d
      from orders
    `);
    const [productStats] = await this.db.execute(sql`
      select count(*)::int as total from products where active = true
    `);
    const [debtStats] = await this.db.execute(sql`
      select
        count(*) filter (where debt_amount::numeric > 0)::int as debtors,
        coalesce(sum(debt_amount::numeric) filter (where debt_amount::numeric > 0), 0)::text as debt_total
      from customers
    `);
    return { orders: orderStats, products: productStats, debts: debtStats };
  }

  private async listOrders(args: Record<string, unknown>) {
    const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
    const status = String(args.status || 'all');
    let rows = await this.orders.list(limit * 2);
    if (status !== 'all') rows = rows.filter((o: any) => o.status === status);
    return {
      orders: rows.slice(0, limit).map((o: any) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        total: money(o.total),
        createdAt: o.createdAt,
      })),
    };
  }

  private async updateOrderStatus(id: string, status: string) {
    if (!id || !status) return { ok: false, error: 'id_and_status_required' };
    const o = await this.orders.updateStatus(id, status);
    return { ok: true, number: o.number, status: o.status };
  }

  private async listDebts(args: Record<string, unknown>) {
    const min = Number(args.minAmount ?? 0.01);
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const rows = await this.db.query.customers.findMany({
      where: gt(customers.debtAmount, String(min)),
      orderBy: [desc(customers.debtAmount)],
      limit,
    });
    return {
      debtors: rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        debtAmount: money(c.debtAmount),
      })),
    };
  }

  private async sendDebtReminders(args: Record<string, unknown>) {
    if (!args.confirmed) return { ok: false, error: 'confirmed_required' };
    const min = Number(args.minAmount ?? 1);
    const debtors = await this.db.query.customers.findMany({
      where: gt(customers.debtAmount, String(min)),
    });
    let sent = 0;
    for (const c of debtors) {
      const last = c.lastNotifiedDebtAt ? new Date(c.lastNotifiedDebtAt).getTime() : 0;
      const days = Number(process.env.DEBT_REMINDER_DAYS || 7);
      if (Date.now() - last < days * 86400000) continue;
      await this.wa.notifyCustomerDebt({
        name: c.name,
        phone: c.phone,
        debtAmount: String(c.debtAmount),
      });
      await this.db
        .update(customers)
        .set({ lastNotifiedDebtAt: new Date() })
        .where(eq(customers.id, c.id));
      sent++;
    }
    return { ok: true, candidates: debtors.length, sent };
  }
}
