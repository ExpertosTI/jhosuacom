import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { companies, products } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { Public } from '../auth/auth.guard';

@Controller('products')
export class ProductsController {
  constructor(@Inject(DRIZZLE) private db: any) {}

  @Get()
  async list(
    @Query('company') company?: string,
    @Query('q') q?: string,
    @Query('featured') featured?: string,
  ) {
    const conditions: any[] = [eq(products.active, true)];
    if (company) {
      const co = await this.db.query.companies.findFirst({
        where: or(eq(companies.slug, company), eq(companies.id, company)),
      });
      if (co) conditions.push(eq(products.companyId, co.id));
    }
    if (featured === '1' || featured === 'true') {
      conditions.push(eq(products.featured, true));
    }
    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(or(ilike(products.name, term), ilike(products.sku, term)));
    }

    return this.db.query.products.findMany({
      where: and(...conditions),
      with: { company: true },
      orderBy: [asc(products.name)],
      limit: 200,
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    return this.db.query.products.findFirst({
      where: eq(products.id, id),
      with: { company: true },
    });
  }
}

@Controller('companies')
export class CompaniesController {
  constructor(@Inject(DRIZZLE) private db: any) {}

  @Public()
  @Get()
  list() {
    return this.db.query.companies.findMany({
      where: eq(companies.active, true),
      orderBy: [asc(companies.sortOrder)],
    });
  }
}
