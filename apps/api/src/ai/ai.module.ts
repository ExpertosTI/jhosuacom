import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { OrdersModule } from '../orders/orders.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiController, WebhooksController } from './ai.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiToolsService } from './ai-tools.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiWhatsAppService } from './ai-whatsapp.service';
import { AiEnrichmentService } from './ai-enrichment.service';

@Module({
  imports: [OrdersModule, OdooModule, WhatsAppModule],
  controllers: [AiController, WebhooksController],
  providers: [
    AiSettingsService,
    AiToolsService,
    AiOrchestratorService,
    AiWhatsAppService,
    AiEnrichmentService,
  ],
  exports: [AiSettingsService, AiOrchestratorService, AiEnrichmentService, AiWhatsAppService],
})
export class AiModule {}
