import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { products } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OdooService } from '../odoo/odoo.service';
import { generateGeminiText } from './gemini.client';
import { AiSettingsService } from './ai-settings.service';

@Injectable()
export class AiEnrichmentService {
  private readonly logger = new Logger(AiEnrichmentService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private settings: AiSettingsService,
    private odoo: OdooService,
  ) {}

  /** Enriquece productos sin descripción humana (post-sync). */
  async enrichProducts(limit = 25, opts?: { forceAfterSync?: boolean }) {
    const cfg = await this.settings.resolve();
    if (!cfg.apiKey) {
      return { skipped: true, enriched: 0, reason: 'ai_off_or_no_key' };
    }
    if (!opts?.forceAfterSync && (!cfg.enabled || !cfg.enrichOnSync)) {
      return { skipped: true, enriched: 0, reason: 'ai_off_or_no_key' };
    }

    const rows = await this.db.query.products.findMany({
      where: and(
        eq(products.active, true),
        or(isNull(products.description), eq(products.description, '')),
        or(isNull(products.aiDescription), eq(products.aiDescription, '')),
      ),
      limit,
    });

    let enriched = 0;
    for (const p of rows) {
      try {
        const prompt =
          `Producto: ${p.name}\nSKU: ${p.sku || '—'}\nCategoría: ${p.category || '—'}\n` +
          `Escribe en español RD: 1) descripción corta (máx 2 oraciones) para tienda mayor/detal. ` +
          `2) 3-5 tags separados por coma. Formato exacto:\nDESC: ...\nTAGS: a, b, c`;
        const result = await generateGeminiText(
          prompt,
          'Eres copywriter de catálogo JH Hogar. Sé factual; no inventes specs técnicas.',
          cfg.apiKey,
        );
        if (!result.ok || !result.text) continue;
        const descMatch = result.text.match(/DESC:\s*(.+)/i);
        const tagsMatch = result.text.match(/TAGS:\s*(.+)/i);
        const aiDescription = (descMatch?.[1] || result.text).trim().slice(0, 500);
        const aiTags = (tagsMatch?.[1] || '')
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
          .slice(0, 8);

        await this.db
          .update(products)
          .set({
            aiDescription,
            aiTags,
            descriptionSource: 'ai',
            updatedAt: new Date(),
          })
          .where(eq(products.id, p.id));

        if (p.odooId) {
          await this.odoo.writeProductAiFields(p.odooId, {
            aiDescription,
            aiTags,
            clearNeedAi: true,
          });
        }
        enriched++;
      } catch (e: any) {
        this.logger.warn(`enrich ${p.id}: ${e.message}`);
      }
    }

    return { skipped: false, enriched, candidates: rows.length };
  }

  async recommend(productId: string, limit = 6) {
    const base = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.active, true)),
      with: { company: true },
    });
    if (!base) return { product: null, recommendations: [] };

    const price = Number(base.priceDetal) || 0;
    const rows = await this.db.query.products.findMany({
      where: and(eq(products.active, true), ne(products.id, productId)),
      with: { company: true },
      limit: 40,
    });

    const scored = rows
      .map((p: any) => {
        let score = 0;
        if (p.companyId === base.companyId) score += 3;
        if (p.category && p.category === base.category) score += 4;
        const pp = Number(p.priceDetal) || 0;
        if (price > 0 && Math.abs(pp - price) / price < 0.35) score += 2;
        if (p.featured) score += 1;
        return { p, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit)
      .map(({ p }: any) => p);

    return {
      product: {
        id: base.id,
        name: base.name,
        category: base.category,
        company: base.company?.name,
      },
      recommendations: scored,
    };
  }
}
