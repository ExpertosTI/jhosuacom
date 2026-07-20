import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { companies } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { Public } from '../auth/auth.guard';
import { ProductsService, type ProductUpdateInput } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  async list(
    @Query('company') company?: string,
    @Query('q') q?: string,
    @Query('featured') featured?: string,
    @Query('active') active?: 'true' | 'false' | 'all',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.products.list({
      company,
      q,
      featured: featured === '1' || featured === 'true',
      active: active || 'all',
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: ProductUpdateInput) {
    return this.products.update(id, body || {});
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
