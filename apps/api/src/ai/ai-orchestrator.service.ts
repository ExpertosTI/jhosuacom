import { Inject, Injectable, Logger } from '@nestjs/common';
import { aiRuns } from '@jhosua/db';
import { DRIZZLE } from '../database/database.module';
import {
  generateWithTools,
  turnsToContents,
  type ChatTurn,
  type GeminiContent,
} from './gemini.client';
import { AiSettingsService } from './ai-settings.service';
import { AiToolsService, type AiRole, type ToolContext } from './ai-tools.service';

const SALES_SYSTEM = `Eres el vendedor virtual de JH Hogar (República Dominicana), catálogo mayor y detal conectado a Odoo.
Reglas:
- Responde en español claro y breve (WhatsApp-friendly).
- NUNCA inventes precios, SKUs ni stock: usa tools.
- Precio detal vs mayor: mayor solo si qty >= minMayorQty del producto.
- Multi-empresa: menciona la empresa del producto si aplica.
- Para crear pedido: resume ítems y total, pregunta confirmación; solo entonces create_order con confirmed=true.
- Si no puedes ayudar o el cliente pide persona, usa handoff_to_human.
- No menciones que eres Gemini ni detalles técnicos.`;

const ADMIN_SYSTEM = `Eres el copiloto admin de JH Hogar.
- Usa tools para datos vivos; no inventes KPIs.
- Acciones destructivas o envíos (sync, deudas WA, send_whatsapp) requieren confirmed=true tras confirmación del usuario.
- Responde en el idioma del usuario (normalmente español).
- Sé concreto y operativo.`;

const WEB_SYSTEM = `Eres el asistente de la tienda JH Hogar en la web.
- Ayuda a encontrar productos con tools; no inventes precios.
- No crees pedidos: sugiere agregar al carrito/checkout o escribir por WhatsApp.
- Español breve.`;

export type AiChatInput = {
  role: AiRole;
  channel: ToolContext['channel'];
  message: string;
  history?: ChatTurn[];
  phone?: string;
  customerName?: string;
  actor?: string;
  onHandoff?: (reason: string) => Promise<void>;
};

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private settings: AiSettingsService,
    private tools: AiToolsService,
  ) {}

  systemFor(role: AiRole, channel: ToolContext['channel']) {
    if (channel === 'web') return WEB_SYSTEM;
    if (role === 'admin') return ADMIN_SYSTEM;
    return SALES_SYSTEM;
  }

  async chat(input: AiChatInput) {
    const cfg = await this.settings.resolve();
    if (!cfg.enabled || !cfg.apiKey) {
      return {
        ok: false as const,
        reply: 'La IA no está configurada en el servidor.',
        actions: [] as Array<{ tool: string; result: unknown }>,
        error: 'ai_disabled',
      };
    }
    if (input.channel === 'whatsapp' && !cfg.whatsappEnabled) {
      return {
        ok: false as const,
        reply: '',
        actions: [],
        error: 'whatsapp_ai_disabled',
      };
    }
    if (input.channel === 'web' && !cfg.webEnabled) {
      return {
        ok: false as const,
        reply: 'Asistente web desactivado.',
        actions: [],
        error: 'web_ai_disabled',
      };
    }

    const history = (input.history || []).slice(-12);
    const turns: ChatTurn[] = [...history, { role: 'user', text: input.message }];
    const contents: GeminiContent[] = turnsToContents(turns);
    const toolDecls = this.tools.toolsFor(input.role, input.channel);
    const ctx: ToolContext = {
      role: input.role,
      channel: input.channel,
      phone: input.phone,
      customerName: input.customerName,
      actor: input.actor,
      onHandoff: input.onHandoff,
    };
    const actions: Array<{ tool: string; result: unknown }> = [];

    for (let i = 0; i < 8; i++) {
      const result = await generateWithTools(
        contents,
        {
          systemInstruction: this.systemFor(input.role, input.channel),
          tools: toolDecls,
          temperature: 0.35,
        },
        cfg.apiKey,
        cfg.model,
      );

      if (!result.ok) {
        await this.logRun({
          role: input.role,
          channel: input.channel,
          actor: input.actor || input.phone,
          promptSummary: input.message.slice(0, 240),
          replySummary: '',
          toolsUsed: actions.map((a) => a.tool),
          ok: false,
          error: result.error,
        });
        return {
          ok: false as const,
          reply: 'No pude procesar tu mensaje ahora. Intenta de nuevo.',
          actions,
          error: result.error,
        };
      }

      if (result.functionCall?.name) {
        const toolResult = await this.tools.runTool(
          result.functionCall.name,
          result.functionCall.args || {},
          ctx,
        );
        actions.push({ tool: result.functionCall.name, result: toolResult });
        contents.push({
          role: 'model',
          parts: [{ functionCall: result.functionCall }],
        });
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: result.functionCall.name,
                response: toolResult as Record<string, unknown>,
              },
            },
          ],
        });
        continue;
      }

      const reply = result.text || 'Listo.';
      await this.logRun({
        role: input.role,
        channel: input.channel,
        actor: input.actor || input.phone,
        promptSummary: input.message.slice(0, 240),
        replySummary: reply.slice(0, 240),
        toolsUsed: actions.map((a) => a.tool),
        ok: true,
        error: null,
        meta: { model: result.model, usage: result.usage },
      });
      return { ok: true as const, reply, actions, error: null };
    }

    await this.logRun({
      role: input.role,
      channel: input.channel,
      actor: input.actor || input.phone,
      promptSummary: input.message.slice(0, 240),
      replySummary: '',
      toolsUsed: actions.map((a) => a.tool),
      ok: false,
      error: 'tool_loop_limit',
    });
    return {
      ok: false as const,
      reply: 'Se me complicó un poco. ¿Puedes reformular?',
      actions,
      error: 'tool_loop_limit',
    };
  }

  private async logRun(row: {
    role: string;
    channel: string;
    actor?: string | null;
    promptSummary: string;
    replySummary: string;
    toolsUsed: string[];
    ok: boolean;
    error: string | null;
    meta?: Record<string, unknown>;
  }) {
    try {
      await this.db.insert(aiRuns).values({
        role: row.role,
        channel: row.channel,
        actor: row.actor || null,
        promptSummary: row.promptSummary,
        replySummary: row.replySummary,
        toolsUsed: row.toolsUsed,
        ok: row.ok,
        error: row.error,
        meta: row.meta || null,
      });
    } catch (e: any) {
      this.logger.warn(`ai_runs insert failed: ${e.message}`);
    }
  }
}
