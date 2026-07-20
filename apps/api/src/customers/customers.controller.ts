import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { and, desc, eq, gt, ilike, or } from 'drizzle-orm';
import { customers } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OdooService } from '../odoo/odoo.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private odoo: OdooService,
    private wa: WhatsAppService,
  ) {}

  @Get()
  async list(@Query('q') q?: string) {
    let where: any = undefined;
    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      where = or(
        ilike(customers.name, term),
        ilike(customers.phone, term),
        ilike(customers.email, term),
      );
    }
    return this.db.query.customers.findMany({
      where,
      orderBy: [desc(customers.updatedAt)],
      limit: 300,
    });
  }

  @Get('debts')
  debts(@Query('q') q?: string, @Query('minAmount') minAmount?: string) {
    const min = String(Math.max(0, Number(minAmount) || 0));
    const parts: any[] = [gt(customers.debtAmount, min)];
    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      parts.push(or(ilike(customers.name, term), ilike(customers.phone, term)));
    }
    return this.db.query.customers.findMany({
      where: and(...parts),
      orderBy: [desc(customers.debtAmount)],
      limit: 300,
    });
  }

  /** Rutas estáticas antes de `:id` para no colisionar. */
  @Post('notify-debts')
  async notifyDebts(@Body() body: { minAmount?: number }) {
    const min = Number(body.minAmount ?? 1);
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

  @Get(':id')
  async one(@Param('id') id: string) {
    return this.db.query.customers.findFirst({ where: eq(customers.id, id) });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      email?: string | null;
      taxId?: string | null;
      priceMode?: 'detal' | 'mayor';
      notes?: string | null;
      debtAmount?: string | number;
    },
  ) {
    const existing = await this.db.query.customers.findFirst({
      where: eq(customers.id, id),
    });
    if (!existing) return { ok: false, message: 'No encontrado' };

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = String(body.name).trim() || existing.name;
    if (body.phone !== undefined) {
      patch.phone = String(body.phone).replace(/\D/g, '') || existing.phone;
    }
    if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
    if (body.taxId !== undefined) patch.taxId = body.taxId ? String(body.taxId).trim() : null;
    if (body.priceMode === 'detal' || body.priceMode === 'mayor') patch.priceMode = body.priceMode;
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes).trim() : null;
    if (body.debtAmount !== undefined) patch.debtAmount = String(Number(body.debtAmount) || 0);

    await this.db.update(customers).set(patch).where(eq(customers.id, id));
    return this.db.query.customers.findFirst({ where: eq(customers.id, id) });
  }

  @Post(':id/sync-debt')
  async syncDebt(@Param('id') id: string) {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, id),
    });
    if (!customer?.odooPartnerId) {
      return { ok: false, message: 'Cliente sin partner Odoo' };
    }
    const amount = await this.odoo.fetchPartnerDebt(customer.odooPartnerId);
    await this.db
      .update(customers)
      .set({
        debtAmount: String(amount),
        debtSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));
    return { ok: true, debtAmount: amount };
  }

  @Post(':id/notify-debt')
  async notifyOne(@Param('id') id: string) {
    const c = await this.db.query.customers.findFirst({ where: eq(customers.id, id) });
    if (!c) return { ok: false, message: 'No encontrado' };
    if (Number(c.debtAmount) <= 0) return { ok: false, message: 'Sin deuda' };
    await this.wa.notifyCustomerDebt({
      name: c.name,
      phone: c.phone,
      debtAmount: String(c.debtAmount),
    });
    await this.db
      .update(customers)
      .set({ lastNotifiedDebtAt: new Date() })
      .where(eq(customers.id, id));
    return { ok: true };
  }
}
