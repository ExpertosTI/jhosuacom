import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { desc, eq, gt } from 'drizzle-orm';
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
  list() {
    return this.db.query.customers.findMany({
      orderBy: [desc(customers.updatedAt)],
      limit: 200,
    });
  }

  @Get('debts')
  debts() {
    return this.db.query.customers.findMany({
      where: gt(customers.debtAmount, '0'),
      orderBy: [desc(customers.debtAmount)],
    });
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
}
