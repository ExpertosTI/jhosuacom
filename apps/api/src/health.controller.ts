import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.guard';

@Public()
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
