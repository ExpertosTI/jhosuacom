import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private enabled() {
    return Boolean(this.apiKey());
  }

  instance() {
    return process.env.EVOLUTION_INSTANCE || 'jhhogar';
  }

  private apiKey() {
    return (process.env.EVOLUTION_API_KEY || '').trim();
  }

  private baseUrl() {
    return (process.env.EVOLUTION_API_URL || 'https://evoapi.renace.tech').replace(
      /\/$/,
      '',
    );
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey(),
    };
  }

  private extractQr(data: any): string | null {
    const raw =
      data?.qrcode?.base64 ||
      data?.base64 ||
      data?.qrcode?.code ||
      data?.code ||
      null;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('data:')) return raw;
    return `data:image/png;base64,${raw}`;
  }

  private async evo(path: string, init: RequestInit = {}) {
    if (!this.enabled()) {
      return { ok: false as const, status: 0, data: null, error: 'Evolution no configurado' };
    }
    const url = `${this.baseUrl()}${path}`;
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...this.headers(),
          ...(init.headers || {}),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const error =
          data?.message || data?.error || data?.response?.message || `HTTP ${res.status}`;
        this.logger.error(`Evolution ${path}: ${error}`);
        return { ok: false as const, status: res.status, data, error: String(error) };
      }
      return { ok: true as const, status: res.status, data, error: null };
    } catch (e: any) {
      this.logger.error(`Evolution network ${path}: ${e.message}`);
      return { ok: false as const, status: 0, data: null, error: e.message || 'network' };
    }
  }

  normalizePhone(raw: string) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    return digits;
  }

  async getStatus() {
    const instance = this.instance();
    const configured = this.enabled();
    if (!configured) {
      return {
        configured: false,
        instanceName: instance,
        connectionState: null as string | null,
        phone: null as string | null,
        apiUrl: this.baseUrl() || null,
      };
    }

    const res = await this.evo(`/instance/connectionState/${instance}`);
    const state =
      res.data?.instance?.state ||
      res.data?.state ||
      res.data?.status ||
      (res.ok ? null : 'close');

    return {
      configured: true,
      instanceName: instance,
      connectionState: state,
      phone: res.data?.instance?.owner || res.data?.owner || null,
      apiUrl: this.baseUrl(),
    };
  }

  async getConnectionState() {
    const instance = this.instance();
    if (!this.enabled()) {
      return { state: null, error: 'Evolution no configurado' };
    }
    const res = await this.evo(`/instance/connectionState/${instance}`);
    const state =
      res.data?.instance?.state || res.data?.state || res.data?.status || null;
    return { state, error: res.ok ? null : res.error };
  }

  async startQr() {
    const instance = this.instance();
    if (!this.enabled()) {
      return { ok: false, qr: null as string | null, error: 'Evolution no configurado en el servidor' };
    }

    // Create if missing (ignore "already exists")
    const created = await this.evo('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    let qr = this.extractQr(created.data);
    if (qr) {
      return { ok: true, qr, error: null };
    }

    const connected = await this.evo(`/instance/connect/${instance}`);
    qr = this.extractQr(connected.data);
    if (qr) {
      return { ok: true, qr, error: null };
    }

    // Already open?
    const st = await this.getConnectionState();
    if (st.state === 'open') {
      return { ok: true, qr: null, error: null, alreadyConnected: true };
    }

    return {
      ok: false,
      qr: null,
      error: connected.error || created.error || 'No se pudo obtener QR',
    };
  }

  async disconnect() {
    const instance = this.instance();
    if (!this.enabled()) {
      return { ok: false, error: 'Evolution no configurado' };
    }
    const res = await this.evo(`/instance/logout/${instance}`, { method: 'DELETE' });
    return { ok: res.ok, error: res.ok ? null : res.error };
  }

  async sendText(to: string, text: string) {
    const phone = this.normalizePhone(to);
    if (!phone) return { ok: false, reason: 'invalid_phone' };

    if (!this.enabled()) {
      this.logger.log(`[WA MOCK] → ${phone}: ${text.slice(0, 120)}...`);
      return { ok: true, mock: true };
    }

    const res = await this.evo(`/message/sendText/${this.instance()}`, {
      method: 'POST',
      body: JSON.stringify({
        number: phone,
        text,
      }),
    });

    if (!res.ok) {
      return { ok: false, reason: res.error || 'send_failed' };
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
