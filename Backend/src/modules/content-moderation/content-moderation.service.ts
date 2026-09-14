import { ContentPolicy, ModerationResult } from './content-policy';
import { rulesEsAR, allowlistEsAR } from './policies/es-AR';
import { env } from '../../config/env';
import { METRIC_EVENTS, metrics, moderationMetrics } from '../../lib/metrics';

class ContentModerationService {
  private defaultPolicy: ContentPolicy;

  constructor() {
    // Inicializamos con la política de Argentina
    this.defaultPolicy = new ContentPolicy('es-AR-1.1', rulesEsAR, allowlistEsAR, env.MODERATION_SHADOW_RULES);
  }

  /**
   * Evalúa un texto según la política activa y retorna el resultado de moderación.
   * Se espera no retornar explícitamente qué palabra disparó la regla 
   * hacia el usuario (para no enseñarle a ofuscar mejor).
   */
  public evaluate(text: string, domain: 'MARKETPLACE' | 'FORUM'): ModerationResult {
    // Por ahora usamos la misma política para todos los dominios
    // En un futuro se podría filtrar reglas por dominio si hiciera falta.
    const result = this.defaultPolicy.evaluate(text, domain);
    moderationMetrics.automatedDecisions.inc({ domain, decision: result.decision, policyVersion: result.policyVersion });
    for (const match of result.shadowMatches) {
      moderationMetrics.shadowMatches.inc({ domain, ruleId: match.ruleId, decision: match.decision });
    }
    if (result.decision === 'BLOCK') metrics.recordEvent(METRIC_EVENTS.automatedBlock);
    return result;
  }
}

export const contentModerationService = new ContentModerationService();
