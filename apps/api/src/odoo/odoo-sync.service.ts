import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { companies, products, syncLogs } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { OdooService } from './odoo.service';

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

@Injectable()
export class OdooSyncService {
  private readonly logger = new Logger(OdooSyncService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private odoo: OdooService,
    private moduleRef: ModuleRef,
  ) {}

  async syncAll() {
    const started = Date.now();
    try {
      if (await this.odoo.isMock()) {
        await this.db.insert(syncLogs).values({
          kind: 'products',
          status: 'skipped',
          message: 'Modo mock activo — usando catálogo local/seed',
        });
        return {
          mock: true,
          companies: 0,
          products: 0,
          message: 'Modo mock: no se sincronizó con Odoo',
        };
      }

      const cfg = await this.odoo.resolveConfig();
      const odooCompanies = await this.odoo.fetchCompanies(cfg);
      let companyCount = 0;
      let productCount = 0;

      for (const [idx, oc] of odooCompanies.entries()) {
        const slug = slugify(oc.name) || `company-${oc.id}`;
        const existing = await this.db.query.companies.findFirst({
          where: eq(companies.odooId, oc.id),
        });

        let companyId: string;
        if (existing) {
          await this.db
            .update(companies)
            .set({ name: oc.name, updatedAt: new Date(), active: true })
            .where(eq(companies.id, existing.id));
          companyId = existing.id;
        } else {
          const [created] = await this.db
            .insert(companies)
            .values({
              odooId: oc.id,
              name: oc.name,
              slug,
              sortOrder: idx + 1,
            })
            .returning();
          companyId = created.id;
        }
        companyCount++;

        const rows = await this.odoo.fetchProducts(oc.id, cfg);
        for (const p of rows) {
          const price = String(p.list_price ?? 0);
          const { imageUrl, imageUrls } = OdooService.imagesToUrls(p.images);
          const payload = {
            sku: p.default_code || null,
            name: p.name,
            description: p.description_sale || null,
            category: p.categ_id ? p.categ_id[1] : null,
            imageUrl,
            imageUrls,
            priceDetal: price,
            priceMayor: price,
            stock: String(p.qty_available ?? 0),
            active: true,
            syncedAt: new Date(),
            updatedAt: new Date(),
          };

          const found = await this.db.query.products.findFirst({
            where: (pr: any, { and, eq: e }: any) =>
              and(e(pr.companyId, companyId), e(pr.odooId, p.id)),
          });

          if (found) {
            await this.db.update(products).set(payload).where(eq(products.id, found.id));
          } else {
            await this.db.insert(products).values({
              companyId,
              odooId: p.id,
              ...payload,
            });
          }
          productCount++;
        }
      }

      let enrichMeta: Record<string, unknown> | null = null;
      try {
        const { AiEnrichmentService } = await import('../ai/ai-enrichment.service');
        const enrich = this.moduleRef.get(AiEnrichmentService, { strict: false });
        if (enrich) {
          enrichMeta = (await enrich.enrichProducts(25)) as Record<string, unknown>;
        }
      } catch (e: any) {
        this.logger.warn(`AI enrich post-sync: ${e.message}`);
      }

      await this.db.insert(syncLogs).values({
        kind: 'products',
        status: 'ok',
        message: `Sync OK en ${Date.now() - started}ms`,
        meta: {
          companies: companyCount,
          products: productCount,
          source: 'jh.website.catalog | jh_show_on_website | sale_ok',
          images: true,
          enrich: enrichMeta,
        },
      });

      return {
        mock: false,
        companies: companyCount,
        products: productCount,
        enrich: enrichMeta,
        message: `Sync OK: ${productCount} productos (con galería de imágenes)`,
      };
    } catch (e: any) {
      this.logger.error(e);
      await this.db.insert(syncLogs).values({
        kind: 'products',
        status: 'error',
        message: e.message || 'Sync failed',
      });
      throw e;
    }
  }
}
