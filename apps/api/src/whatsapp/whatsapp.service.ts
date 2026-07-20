import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private enabled() {
    return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
  }

  private instance() {
    return process.env.EVOLUTION_INSTANCE || 'jhhogar';
  }

  normalizePhone(raw: string) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    return digits;
  }

  async sendText(to: string, text: string) {
    const phone = this.normalizePhone(to);
    if (!phone) return { ok: false, reason: 'invalid_phone' };

    if (!this.enabled()) {
      this.logger.log(`[WA MOCK] → ${phone}: ${text.slice(0, 120)}...`);
      return { ok: true, mock: true };
    }

    const base = process.env.EVOLUTION_API_URL!.replace(/\/$/, '');
    const res = await fetch(`${base}/message/sendText/${this.instance()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({
        number: phone,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`WA send failed: ${res.status} ${body}`);
      return { ok: false, reason: body };
    }
    return { ok: true, mock: false };
  }

  async notifyAdminsNewOrder(order: {
    number: string;
    customerName: string;
    customerPhone: string;
    total: string;
    itemsSummary: string;
  }) {
    const phones = (process.env.ADMIN_NOTIFY_PHONES || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (!phones.length) {
      this.logger.warn('ADMIN_NOTIFY_PHONES vacío — no se notificó admins');
      return;
    }

    const web = (process.env.PUBLIC_WEB_URL || '').replace(/\/$/, '');
    const msg =
      `🛒 *Nuevo pedido ${order.number}*\n` +
      `Cliente: ${order.customerName}\n` +
      `Tel: ${order.customerPhone}\n` +
      `Total: $${order.total}\n` +
      `${order.itemsSummary}\n` +
      (web ? `\nAdmin: ${web}/admin/pedidos` : '');

    await Promise.all(phones.map((p) => this.sendText(p, msg)));
  }

  async notifyCustomerOrderReceived(order: {
    number: string;
    customerName: string;
    customerPhone: string;
    total: string;
  }) {
    const msg =
      `Hola ${order.customerName} 👋\n` +
      `Recibimos tu pedido *${order.number}* en JH Hogar.\n` +
      `Total estimado: $${order.total}\n` +
      `Pronto te confirmamos la cotización. ¡Gracias!`;
    return this.sendText(order.customerPhone, msg);
  }

  async notifyCustomerDebt(customer: {
    name: string;
    phone: string;
    debtAmount: string;
  }) {
    const msg =
      `Hola ${customer.name},\n` +
      `Te recordamos un saldo pendiente con JH Hogar por *$${customer.debtAmount}*.\n` +
      `Si ya pagaste, ignora este mensaje. ¿Necesitas ayuda? Responde aquí.`;
    return this.sendText(customer.phone, msg);
  }
}
