import { ContentPolicy, ModerationResult } from './content-policy';
import { rulesEsAR, allowlistEsAR } from './policies/es-AR';

class ContentModerationService {
  private defaultPolicy: ContentPolicy;

  constructor() {
    // Inicializamos con la política de Argentina
    this.defaultPolicy = new ContentPolicy('es-AR-1.0', rulesEsAR, allowlistEsAR);
  }

  /**
   * Evalúa un texto según la política activa y retorna el resultado de moderación.
   * Se espera no retornar explícitamente qué palabra disparó la regla 
   * hacia el usuario (para no enseñarle a ofuscar mejor).
   */
  public evaluate(text: string, domain: 'MARKETPLACE' | 'FORUM'): ModerationResult {
    // Por ahora usamos la misma política para todos los dominios
    // En un futuro se podría filtrar reglas por dominio si hiciera falta.
    return this.defaultPolicy.evaluate(text, domain);
  }
}

export const contentModerationService = new ContentModerationService();
