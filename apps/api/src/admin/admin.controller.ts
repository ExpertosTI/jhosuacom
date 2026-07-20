import { Controller, Get, Inject } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { orders, syncLogs } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OdooService } from '../odoo/odoo.service';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private odoo: OdooService,
  ) {}

  @Get('dashboard')
  async dashboard() {
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

    const recentOrders = await this.db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit: 8,
      with: { items: true },
    });

    const lastSync = await this.db.query.syncLogs.findFirst({
      orderBy: [desc(syncLogs.createdAt)],
    });

    const odoo = await this.odoo.testConnection();

    return {
      orders: orderStats,
      products: productStats,
      debts: debtStats,
      recentOrders,
      lastSync,
      odoo,
    };
  }
}
