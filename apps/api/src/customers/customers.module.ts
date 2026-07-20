import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { CustomersController } from './customers.controller';

@Module({
  imports: [OdooModule, WhatsAppModule],
  controllers: [CustomersController],
})
export class CustomersModule {}
