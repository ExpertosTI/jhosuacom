import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Public } from '../auth/auth.guard';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiSettingsService } from './ai-settings.service';
import { AiEnrichmentService } from './ai-enrichment.service';
import { AiWhatsAppService } from './ai-whatsapp.service';
import type { ChatTurn } from './gemini.client';

@Controller('ai')
export class AiController {
  constructor(
    private orch: AiOrchestratorService,
    private settings: AiSettingsService,
    private enrich: AiEnrichmentService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settings.getPublic();
  }

  @Put('settings')
  saveSettings(
    @Body()
    body: {
      enabled?: boolean;
      whatsappEnabled?: boolean;
      webEnabled?: boolean;
      enrichOnSync?: boolean;
      geminiApiKey?: string;
      model?: string;
    },
  ) {
    return this.settings.save(body || {});
  }

  @Get('status')
  async status() {
    const s = await this.settings.getPublic();
    return {
      ...s,
      configured: s.hasApiKey && s.enabled,
    };
  }

  @Post('chat')
  async chat(
    @Body()
    body: {
      message?: string;
      history?: ChatTurn[];
      role?: 'sales' | 'admin';
    },
    @CurrentUser() user: { sub?: string; email?: string },
  ) {
    const message = String(body?.message || '').trim();
    if (!message) return { ok: false, reply: '', error: 'message_required' };
    return this.orch.chat({
      role: body.role === 'sales' ? 'sales' : 'admin',
      channel: 'admin',
      message,
      history: body.history || [],
      actor: user?.email || user?.sub || 'admin',
    });
  }

  @Post('enrich')
  runEnrich(@Body() body: { limit?: number }) {
    return this.enrich.enrichProducts(Number(body?.limit) || 25);
  }
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private waAi: AiWhatsAppService) {}

  @Public()
  @Post('evolution')
  async evolution(@Body() body: any, @Query('secret') secret?: string) {
    const expected = (process.env.EVOLUTION_WEBHOOK_SECRET || '').trim();
    if (expected) {
      const hdr =
        typeof body?.apikey === 'string'
          ? body.apikey
          : undefined;
      if (secret !== expected && hdr !== expected) {
        return { ok: false, error: 'unauthorized' };
      }
    }

    const event = String(body?.event || body?.type || '').toLowerCase();
    const isMessage =
      !event ||
      event.includes('messages.upsert') ||
      event.includes('messageset') ||
      event.includes('message');

    if (event && !isMessage) return { ok: true, skipped: true, reason: 'event' };

    const parsed = this.waAi.parseEvolutionPayload(body);
    if (!parsed) return { ok: true, skipped: true, reason: 'parse' };

    const result = await this.waAi.handleInbound(parsed);
    return { ok: true, ...result };
  }
}
