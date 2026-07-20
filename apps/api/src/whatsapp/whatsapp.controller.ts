import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private wa: WhatsAppService) {}

  @Get('status')
  status() {
    return this.wa.getStatus();
  }

  @Get('instance/status')
  instanceStatus() {
    return this.wa.getConnectionState();
  }

  @Post('qr')
  async qr() {
    return this.wa.startQr();
  }

  @Delete('disconnect')
  disconnect() {
    return this.wa.disconnect();
  }

  @Post('test')
  async test(@Body() body: { phone?: string; text?: string }) {
    const phone = body.phone || process.env.ADMIN_NOTIFY_PHONES?.split(',')[0]?.trim();
    if (!phone) {
      return { ok: false, error: 'Indica phone o configura ADMIN_NOTIFY_PHONES' };
    }
    const text =
      body.text ||
      'JH Hogar — mensaje de prueba WhatsApp (Evolution). Si lo recibes, la instancia está OK.';
    return this.wa.sendText(phone, text);
  }
}
