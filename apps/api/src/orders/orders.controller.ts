import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.orders.list(Number(limit) || 50);
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
}
