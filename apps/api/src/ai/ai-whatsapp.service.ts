import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { waConversations, waMessages } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiSettingsService } from './ai-settings.service';
import type { ChatTurn } from './gemini.client';

@Injectable()
export class AiWhatsAppService {
  private readonly logger = new Logger(AiWhatsAppService.name);
  private readonly rate = new Map<string, number[]>();

  constructor(
    @Inject(DRIZZLE) private db: any,
    private settings: AiSettingsService,
    private orch: AiOrchestratorService,
    private wa: WhatsAppService,
  ) {}

  private phoneDigits(raw: string) {
    return String(raw || '')
      .replace(/@.*/g, '')
      .replace(/\D/g, '');
  }

  private rateOk(phone: string) {
    const now = Date.now();
    const windowMs = 60_000;
    const max = 12;
    const arr = (this.rate.get(phone) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      this.rate.set(phone, arr);
      return false;
    }
    arr.push(now);
    this.rate.set(phone, arr);
    return true;
  }

  async getOrCreateConversation(phone: string, name?: string) {
    let conv = await this.db.query.waConversations.findFirst({
      where: eq(waConversations.phone, phone),
    });
    if (!conv) {
      const [created] = await this.db
        .insert(waConversations)
        .values({
          phone,
          customerName: name || null,
          status: 'ai',
        })
        .returning();
      conv = created;
    } else if (name && !conv.customerName) {
      await this.db
        .update(waConversations)
        .set({ customerName: name, updatedAt: new Date() })
        .where(eq(waConversations.id, conv.id));
      conv = { ...conv, customerName: name };
    }
    return conv;
  }

  async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    text: string,
    orderId?: string,
  ) {
    await this.db.insert(waMessages).values({
      conversationId,
      role,
      text: text.slice(0, 8000),
      orderId: orderId || null,
    });
  }

  async recentHistory(conversationId: string, limit = 12): Promise<ChatTurn[]> {
    const rows = await this.db.query.waMessages.findMany({
      where: eq(waMessages.conversationId, conversationId),
      orderBy: [desc(waMessages.createdAt)],
      limit,
    });
    return rows
      .reverse()
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        text: m.text,
      }));
  }

  /** Procesa un mensaje entrante de Evolution y responde. */
  async handleInbound(input: {
    phone: string;
    text: string;
    pushName?: string;
    fromMe?: boolean;
  }) {
    if (input.fromMe) return { skipped: true, reason: 'from_me' };
    const phone = this.phoneDigits(input.phone);
    const text = String(input.text || '').trim();
    if (!phone || phone.length < 8 || !text) {
      return { skipped: true, reason: 'invalid' };
    }

    const cfg = await this.settings.resolve();
    if (!cfg.enabled || !cfg.whatsappEnabled || !cfg.apiKey) {
      return { skipped: true, reason: 'ai_off' };
    }

    if (!this.rateOk(phone)) {
      return { skipped: true, reason: 'rate_limited' };
    }

    const conv = await this.getOrCreateConversation(phone, input.pushName);
    if (conv.status === 'human') {
      return { skipped: true, reason: 'human_mode' };
    }

    await this.appendMessage(conv.id, 'user', text);
    const history = await this.recentHistory(conv.id);

    const result = await this.orch.chat({
      role: 'sales',
      channel: 'whatsapp',
      message: text,
      history: history.slice(0, -1),
      phone,
      customerName: conv.customerName || input.pushName,
      actor: phone,
      onHandoff: async (reason) => {
        await this.db
          .update(waConversations)
          .set({ status: 'human', updatedAt: new Date(), meta: { handoffReason: reason } })
          .where(eq(waConversations.id, conv.id));
      },
    });

    if (result.ok && result.reply) {
      await this.appendMessage(conv.id, 'assistant', result.reply);
      await this.db
        .update(waConversations)
        .set({ updatedAt: new Date() })
        .where(eq(waConversations.id, conv.id));

      const orderAction = result.actions.find((a) => a.tool === 'create_order');
      const orderId =
        orderAction &&
        typeof orderAction.result === 'object' &&
        orderAction.result &&
        (orderAction.result as any).id
          ? String((orderAction.result as any).id)
          : undefined;
      if (orderId) {
        await this.db
          .update(waConversations)
          .set({ lastOrderId: orderId, updatedAt: new Date() })
          .where(eq(waConversations.id, conv.id));
      }

      await this.wa.sendText(phone, result.reply);
    }

    return { skipped: false, ...result };
  }

  /** Extrae texto/phone de payload Evolution (messages.upsert / MESSAGE_RECEIVED). */
  parseEvolutionPayload(body: any): {
    phone: string;
    text: string;
    pushName?: string;
    fromMe?: boolean;
  } | null {
    try {
      const data = body?.data || body;
      const key = data?.key || data?.message?.key;
      const fromMe = Boolean(key?.fromMe || data?.fromMe);
      const remote =
        key?.remoteJid ||
        data?.remoteJid ||
        data?.sender ||
        body?.sender ||
        '';
      const phone = this.phoneDigits(String(remote));
      const msg = data?.message || data;
      const text =
        msg?.conversation ||
        msg?.extendedTextMessage?.text ||
        msg?.imageMessage?.caption ||
        data?.message?.conversation ||
        data?.text ||
        body?.text ||
        '';
      const pushName = data?.pushName || body?.pushName || undefined;
      if (!phone || !text) return null;
      return { phone, text: String(text), pushName, fromMe };
    } catch (e: any) {
      this.logger.warn(`parse evo: ${e.message}`);
      return null;
    }
  }
}
