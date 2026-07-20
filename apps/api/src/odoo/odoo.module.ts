import { Module } from '@nestjs/common';
import { OdooService } from './odoo.service';
import { OdooSyncService } from './odoo-sync.service';
import { OdooController } from './odoo.controller';

@Module({
  controllers: [OdooController],
  providers: [OdooService, OdooSyncService],
  exports: [OdooService, OdooSyncService],
})
export class OdooModule {}
