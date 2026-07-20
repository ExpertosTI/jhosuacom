import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { settings } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import { isGeminiConfigured } from './gemini.client';

export type AiStoredSettings = {
  enabled?: boolean;
  whatsappEnabled?: boolean;
  webEnabled?: boolean;
  enrichOnSync?: boolean;
  geminiApiKey?: string;
  model?: string;
};

export type AiPublicSettings = {
  enabled: boolean;
  whatsappEnabled: boolean;
  webEnabled: boolean;
  enrichOnSync: boolean;
  hasApiKey: boolean;
  model: string;
  source: 'database' | 'env';
};

@Injectable()
export class AiSettingsService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  async getStored(): Promise<AiStoredSettings> {
    const row = await this.db.query.settings.findFirst({
      where: eq(settings.key, 'ai'),
    });
    return ((row?.value || {}) as AiStoredSettings) || {};
  }

  async resolve(): Promise<{
    enabled: boolean;
    whatsappEnabled: boolean;
    webEnabled: boolean;
    enrichOnSync: boolean;
    apiKey: string;
    model: string;
    source: 'database' | 'env';
  }> {
    const stored = await this.getStored();
    const fromDb = Boolean(stored.geminiApiKey || typeof stored.enabled === 'boolean');
    const apiKey = (stored.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    const model = (stored.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
    const enabled =
      typeof stored.enabled === 'boolean' ? stored.enabled : Boolean(apiKey);
    return {
      enabled,
      whatsappEnabled:
        typeof stored.whatsappEnabled === 'boolean' ? stored.whatsappEnabled : enabled,
      webEnabled: typeof stored.webEnabled === 'boolean' ? stored.webEnabled : enabled,
      enrichOnSync:
        typeof stored.enrichOnSync === 'boolean' ? stored.enrichOnSync : false,
      apiKey,
      model,
      source: fromDb ? 'database' : 'env',
    };
  }

  async getPublic(): Promise<AiPublicSettings> {
    const r = await this.resolve();
    return {
      enabled: r.enabled,
      whatsappEnabled: r.whatsappEnabled,
      webEnabled: r.webEnabled,
      enrichOnSync: r.enrichOnSync,
      hasApiKey: isGeminiConfigured(r.apiKey),
      model: r.model,
      source: r.source,
    };
  }

  async save(input: {
    enabled?: boolean;
    whatsappEnabled?: boolean;
    webEnabled?: boolean;
    enrichOnSync?: boolean;
    geminiApiKey?: string;
    model?: string;
  }) {
    const stored = await this.getStored();
    const keepKey =
      !input.geminiApiKey ||
      input.geminiApiKey === '********' ||
      input.geminiApiKey === '__KEEP__';

    const next: AiStoredSettings = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : stored.enabled,
      whatsappEnabled:
        typeof input.whatsappEnabled === 'boolean'
          ? input.whatsappEnabled
          : stored.whatsappEnabled,
      webEnabled:
        typeof input.webEnabled === 'boolean' ? input.webEnabled : stored.webEnabled,
      enrichOnSync:
        typeof input.enrichOnSync === 'boolean' ? input.enrichOnSync : stored.enrichOnSync,
      geminiApiKey: keepKey
        ? stored.geminiApiKey || ''
        : input.geminiApiKey!.trim(),
      model: (input.model ?? stored.model ?? 'gemini-2.5-flash').trim(),
    };

    const existing = await this.db.query.settings.findFirst({
      where: eq(settings.key, 'ai'),
    });
    if (existing) {
      await this.db
        .update(settings)
        .set({ value: next, updatedAt: new Date() })
        .where(eq(settings.id, existing.id));
    } else {
      await this.db.insert(settings).values({ key: 'ai', value: next });
    }
    return this.getPublic();
  }
}
