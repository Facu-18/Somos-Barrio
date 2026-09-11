import { ApiError } from "../../utils/api-error";

const SUSPICIOUS_PATTERNS = [
  "ignora",
  "olvida",
  "instrucciones anteriores",
  "system:",
  "assistant:",
  "eres ahora",
  "actúa como",
  "bypassear",
  "no sigas las reglas",
  "jailbreak"
];

export class PromptInjectionGuard {
  /**
   * Revisa si el texto del usuario contiene patrones obvios de cambio de rol o directivas del sistema.
   * Arroja un ApiError si se detecta inyección.
   */
  static validate(input: string): void {
    const normalized = input.toLowerCase();

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (normalized.includes(pattern)) {
        throw new ApiError(400, "Contenido rechazado por políticas de seguridad (posible inyección de prompt).");
      }
    }
  }

  /**
   * Verifica los límites crudos del payload antes de llamar al proveedor para evitar agotar el presupuesto o denegar el servicio.
   */
  static validateLength(title: string, excerpt: string | null, content: string): void {
    if (title.length > 255) {
      throw new ApiError(400, "El título excede el límite máximo permitido para la asistencia de IA.");
    }
    if (excerpt && excerpt.length > 500) {
      throw new ApiError(400, "La descripción excede el límite máximo permitido para la asistencia de IA.");
    }
    if (content.length > 50000) { // 50k chars is approx 10k-12k tokens depending on language
      throw new ApiError(400, "El cuerpo de la noticia excede el límite máximo permitido para la asistencia de IA.");
    }
  }
}
