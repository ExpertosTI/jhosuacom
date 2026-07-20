import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [OdooModule],
  controllers: [AdminController],
})
export class AdminModule {}
