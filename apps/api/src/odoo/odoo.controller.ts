import { Controller, Get, Post } from '@nestjs/common';
import { OdooService } from './odoo.service';
import { OdooSyncService } from './odoo-sync.service';

@Controller('odoo')
export class OdooController {
  constructor(
    private odoo: OdooService,
    private sync: OdooSyncService,
  ) {}

  @Get('status')
  status() {
    return this.odoo.testConnection();
  }

  @Post('sync')
  syncProducts() {
    return this.sync.syncAll();
  }

  @Get('companies')
  companies() {
    return this.odoo.fetchCompanies();
  }
}
