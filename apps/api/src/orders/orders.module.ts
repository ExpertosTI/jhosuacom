import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [OdooModule, WhatsAppModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
