import { Body, Controller, Get, Post, Put } from '@nestjs/common';
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

  @Get('config')
  getConfig() {
    return this.odoo.getPublicConfig();
  }

  @Put('config')
  saveConfig(
    @Body()
    body: {
      url?: string;
      database?: string;
      username?: string;
      apiKey?: string;
      companyIds?: string;
      mock?: boolean;
    },
  ) {
    return this.odoo.saveConfig(body || {});
  }

  @Post('config/test')
  testConfig(
    @Body()
    body: {
      url?: string;
      database?: string;
      username?: string;
      apiKey?: string;
      companyIds?: string;
      mock?: boolean;
    },
  ) {
    return this.odoo.testConnection(body || {});
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
