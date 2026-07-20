import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.guard';
import { OdooService } from './odoo/odoo.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private odoo: OdooService) {}

  @Get()
  async check() {
    const mock = await this.odoo.isMock();
    return {
      ok: true,
      service: 'jhosua-api',
      odooMock: mock,
    };
  }
}
