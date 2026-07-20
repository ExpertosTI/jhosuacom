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

  private normalizeState(raw: unknown, httpOk: boolean): string | null {
    if (!httpOk) return 'close';
    const s = String(raw || '').toLowerCase().trim();
    if (!s || s === '404' || s === 'not found' || /^\d+$/.test(s)) return 'close';
    return s;
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

    const res = await this.evo(`/instance/connectionState/${encodeURIComponent(instance)}`);
    const raw =
      res.data?.instance?.state ||
      res.data?.state ||
      res.data?.connectionState ||
      null;
    const state = this.normalizeState(raw ?? (res.ok ? null : 'close'), res.ok);

    return {
      configured: true,
      instanceName: instance,
      connectionState: state,
      phone: res.data?.instance?.owner || res.data?.owner || null,
      apiUrl: this.baseUrl(),
      error: res.ok ? null : res.error,
    };
  }

  async getConnectionState() {
    const instance = this.instance();
    if (!this.enabled()) {
      return { state: null, error: 'Evolution no configurado' };
    }
    const res = await this.evo(`/instance/connectionState/${encodeURIComponent(instance)}`);
    const raw =
      res.data?.instance?.state || res.data?.state || res.data?.connectionState || null;
    const state = this.normalizeState(raw, res.ok);
    return { state, error: res.ok ? null : res.error };
  }

  async startQr() {
    const instance = this.instance();
    if (!this.enabled()) {
      return { ok: false, qr: null as string | null, error: 'Evolution no configurado en el servidor' };
    }

    const live = await this.evo(`/instance/connectionState/${encodeURIComponent(instance)}`);
    if (live.ok) {
      const state = this.normalizeState(
        live.data?.instance?.state || live.data?.state || live.data?.connectionState,
        true,
      );
      if (state === 'open') {
        return { ok: true, qr: null, error: null, alreadyConnected: true };
      }
    }

    // Prefer connect (instancia ya existe en evoapi)
    const connected = await this.evo(`/instance/connect/${encodeURIComponent(instance)}`);
    let qr = this.extractQr(connected.data);
    if (qr) return { ok: true, qr, error: null };

    const missing =
      connected.status === 404 ||
      live.status === 404 ||
      /not found/i.test(String(connected.error || live.error || ''));

    if (!missing && !connected.ok) {
      return {
        ok: false,
        qr: null,
        error: connected.error || live.error || 'No se pudo conectar la instancia',
      };
    }

    // Crear instancia si no existe
    const created = await this.evo('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    qr = this.extractQr(created.data);
    if (qr) return { ok: true, qr, error: null };

    if (created.ok || /already|exist/i.test(String(created.error || ''))) {
      await new Promise((r) => setTimeout(r, 800));
      const again = await this.evo(`/instance/connect/${encodeURIComponent(instance)}`);
      qr = this.extractQr(again.data);
      if (qr) return { ok: true, qr, error: null };
    }

    const st = await this.getConnectionState();
    if (st.state === 'open') {
      return { ok: true, qr: null, error: null, alreadyConnected: true };
    }

    return {
      ok: false,
      qr: null,
      error: created.error || connected.error || 'No se pudo obtener QR',
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
