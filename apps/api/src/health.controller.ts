import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'jhosua-api',
      odooMock: process.env.ODOO_MOCK === 'true' || !process.env.ODOO_API_KEY,
    };
  }
}
