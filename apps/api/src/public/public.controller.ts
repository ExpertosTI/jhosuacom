import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { companies, products, settings } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { Public } from '../auth/auth.guard';
import { OrdersService } from '../orders/orders.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { AiEnrichmentService } from '../ai/ai-enrichment.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import type { ChatTurn } from '../ai/gemini.client';

@Controller('public')
export class PublicController {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private orders: OrdersService,
    private ai: AiOrchestratorService,
    private enrich: AiEnrichmentService,
    private aiSettings: AiSettingsService,
  ) {}

  @Public()
  @Get('catalog')
  async catalog(@Query('company') company?: string, @Query('q') q?: string) {
    try {
      const cos = await this.db.query.companies.findMany({
        where: eq(companies.active, true),
        orderBy: [asc(companies.sortOrder)],
      });

      const conditions: any[] = [eq(products.active, true)];
      if (company) {
        const co = cos.find((c: any) => c.slug === company || c.id === company);
        if (co) conditions.push(eq(products.companyId, co.id));
      }
      if (q?.trim()) {
        const term = `%${q.trim()}%`;
        conditions.push(or(ilike(products.name, term), ilike(products.sku, term)));
      }

      const items = await this.db.query.products.findMany({
        where: and(...conditions),
        with: { company: true },
        orderBy: [asc(products.name)],
        limit: 300,
      });

      const shop = await this.db.query.settings.findFirst({
        where: eq(settings.key, 'shop'),
      });

      const productsOut = items.map((p: any) => ({
        ...p,
        description: p.description || p.aiDescription || null,
      }));

      return {
        brand: shop?.value || {
          brandName: 'JH Hogar',
          tagline: 'Artículos y electrodomésticos para el hogar',
        },
        companies: cos,
        products: productsOut,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[catalog]', message);
      throw err;
    }
  }

  @Public()
  @Get('recommend')
  recommend(@Query('productId') productId?: string, @Query('limit') limit?: string) {
    if (!productId) return { product: null, recommendations: [] };
    return this.enrich.recommend(productId, Number(limit) || 6);
  }

  @Public()
  @Get('ai/status')
  async aiStatus() {
    const s = await this.aiSettings.getPublic();
    return {
      enabled: s.enabled && s.webEnabled && s.hasApiKey,
      webEnabled: s.webEnabled,
    };
  }

  @Public()
  @Post('ai/chat')
  async aiChat(
    @Body()
    body: {
      message?: string;
      history?: ChatTurn[];
      sessionId?: string;
    },
  ) {
    const message = String(body?.message || '').trim();
    if (!message) return { ok: false, reply: '', error: 'message_required' };
    return this.ai.chat({
      role: 'sales',
      channel: 'web',
      message,
      history: body.history || [],
      actor: body.sessionId || 'web',
    });
  }

  @Public()
  @Post('orders')
  async createOrder(
    @Body()
    body: {
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      notes?: string;
      priceMode?: 'detal' | 'mayor';
      companyId?: string;
      items: Array<{ productId: string; quantity: number }>;
    },
  ) {
    const key = this.orders.buildIdempotencyKey(body.customerPhone, body.items || []);
    return this.orders.create({ ...body, idempotencyKey: key });
  }

  @Public()
  @Get('orders/:number')
  track(@Param('number') number: string) {
    return this.orders.getByNumber(number);
  }

  @Public()
  @Get('whatsapp-link')
  whatsappLink(@Query('text') text?: string) {
    const phones = (process.env.ADMIN_NOTIFY_PHONES || '').split(',')[0]?.trim() || '';
    const msg = encodeURIComponent(
      text || 'Hola, quiero ver el catálogo de JH Hogar',
    );
    return {
      url: phones ? `https://wa.me/${phones}?text=${msg}` : null,
      phone: phones || null,
    };
  }
}
