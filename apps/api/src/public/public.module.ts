import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PublicController } from './public.controller';

@Module({
  imports: [OrdersModule],
  controllers: [PublicController],
})
export class PublicModule {}
