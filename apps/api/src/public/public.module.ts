import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AiModule } from '../ai/ai.module';
import { PublicController } from './public.controller';

@Module({
  imports: [OrdersModule, AiModule],
  controllers: [PublicController],
})
export class PublicModule {}
