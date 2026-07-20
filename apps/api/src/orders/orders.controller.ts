import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.orders.list(Number(limit) || 80, { status, q });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.orders.create(body);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() body: { status: string }) {
    return this.orders.updateStatus(id, body.status);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { notes?: string | null; status?: string },
  ) {
    return this.orders.updateMeta(id, body || {});
  }
}
