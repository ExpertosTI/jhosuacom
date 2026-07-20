import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OdooModule } from './odoo/odoo.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { PublicModule } from './public/public.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OdooModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    PublicModule,
    WhatsAppModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
