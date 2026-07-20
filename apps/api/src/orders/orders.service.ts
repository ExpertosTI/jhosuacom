import { createHash } from 'crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { customers, orderItems, orders, products } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OdooService } from '../odoo/odoo.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  priceMode?: 'detal' | 'mayor';
  companyId?: string;
  idempotencyKey?: string;
  items: Array<{ productId: string; quantity: number }>;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private odoo: OdooService,
    private wa: WhatsAppService,
  ) {}

  private phoneDigits(raw: string) {
    return String(raw || '').replace(/\D/g, '');
  }

  private async nextNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const rows = await this.db.execute(
      sql`select count(*)::int as c from orders where extract(year from created_at) = extract(year from now())`,
    );
    const count = Number(rows[0]?.c ?? 0) + 1;
    return `JH${year}-${String(count).padStart(5, '0')}`;
  }

  async create(input: CreateOrderInput) {
    const name = String(input.customerName || '').trim();
    const phone = this.phoneDigits(input.customerPhone);
    if (!name || phone.length < 8) {
      throw new BadRequestException('Nombre y teléfono válidos requeridos');
    }
    if (!input.items?.length) throw new BadRequestException('El pedido no tiene items');

    if (input.idempotencyKey) {
      const existing = await this.db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, input.idempotencyKey),
      });
      if (existing) return this.getById(existing.id);
    }

    const priceMode = input.priceMode === 'mayor' ? 'mayor' : 'detal';
    const lines: Array<{
      product: any;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const item of input.items) {
      const product = await this.db.query.products.findFirst({
        where: and(eq(products.id, item.productId), eq(products.active, true)),
      });
      if (!product) throw new BadRequestException(`Producto no encontrado: ${item.productId}`);
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException(`Cantidad inválida para ${product.name}`);
      }
      const unit =
        priceMode === 'mayor' && qty >= (product.minMayorQty || 6)
          ? Number(product.priceMayor)
          : Number(product.priceDetal);
      lines.push({
        product,
        qty,
        unitPrice: unit,
        lineTotal: Math.round(unit * qty * 100) / 100,
      });
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    const number = await this.nextNumber();

    let customer = await this.db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });
    if (!customer) {
      const [created] = await this.db
        .insert(customers)
        .values({
          name,
          phone,
          email: input.customerEmail || null,
          priceMode,
        })
        .returning();
      customer = created;
    } else {
      await this.db
        .update(customers)
        .set({
          name,
          email: input.customerEmail || customer.email,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.id));
    }

    const companyId = input.companyId || lines[0]?.product.companyId;

    const [order] = await this.db
      .insert(orders)
      .values({
        number,
        customerId: customer.id,
        companyId,
        status: 'received',
        priceMode,
        customerName: name,
        customerPhone: phone,
        customerEmail: input.customerEmail || null,
        notes: input.notes || null,
        subtotal: String(subtotal),
        total: String(subtotal),
        idempotencyKey: input.idempotencyKey || null,
      })
      .returning();

    for (const line of lines) {
      await this.db.insert(orderItems).values({
        orderId: order.id,
        productId: line.product.id,
        odooProductId: line.product.odooId,
        name: line.product.name,
        sku: line.product.sku,
        quantity: String(line.qty),
        unitPrice: String(line.unitPrice),
        lineTotal: String(line.lineTotal),
      });
    }

    // Cotización en Odoo
    try {
      const company = companyId
        ? await this.db.query.companies.findFirst({
            where: (c: any, { eq: e }: any) => e(c.id, companyId),
          })
        : null;

      const quote = await this.odoo.createQuotation({
        partnerId: customer.odooPartnerId || undefined,
        partnerName: name,
        partnerPhone: phone,
        companyId: company?.odooId,
        notes: input.notes,
        lines: lines.map((l) => ({
          productTemplateId: l.product.odooId,
          qty: l.qty,
          price: l.unitPrice,
        })),
      });

      if (quote) {
        await this.db
          .update(orders)
          .set({
            status: 'quoted',
            odooSaleOrderId: quote.id,
            odooSaleOrderName: quote.name,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }
    } catch (e: any) {
      // Pedido queda received aunque falle Odoo
      console.error('Odoo quote failed', e.message);
    }

    const itemsSummary = lines
      .map((l) => `• ${l.qty}x ${l.product.name}`)
      .slice(0, 8)
      .join('\n');

    await this.wa.notifyAdminsNewOrder({
      number,
      customerName: name,
      customerPhone: phone,
      total: String(subtotal),
      itemsSummary,
    });
    await this.wa.notifyCustomerOrderReceived({
      number,
      customerName: name,
      customerPhone: phone,
      total: String(subtotal),
    });

    await this.db
      .update(orders)
      .set({ whatsappNotifiedAt: new Date() })
      .where(eq(orders.id, order.id));

    return this.getById(order.id);
  }

  async list(limit = 50) {
    return this.db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit,
      with: { items: true, company: true },
    });
  }

  async getById(id: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true, company: true, customer: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async getByNumber(number: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.number, number),
      with: { items: true, company: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async updateStatus(id: string, status: string) {
    const allowed = ['received', 'quoted', 'confirmed', 'invoiced', 'cancelled'];
    if (!allowed.includes(status)) throw new BadRequestException('Estado inválido');
    await this.db
      .update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(orders.id, id));
    return this.getById(id);
  }

  buildIdempotencyKey(phone: string, items: Array<{ productId: string; quantity: number }>) {
    const normalized = items
      .map((i) => `${i.productId}:${Number(i.quantity)}`)
      .sort()
      .join('|');
    return createHash('sha256')
      .update(`${this.phoneDigits(phone)}|${normalized}`)
      .digest('hex')
      .slice(0, 48);
  }
}
