import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { ContentNormalizer } from "../content-moderation/content-normalizer";
import { moderationMetrics } from "../../lib/metrics";

export const PROMPT_INJECTION_CODE = "PROMPT_INJECTION_DETECTED";
export const AI_INPUT_TOO_LARGE_CODE = "AI_INPUT_TOO_LARGE";

// Límites duros por campo, además del presupuesto de tokens configurable.
export const AI_INPUT_LIMITS = {
  titleChars: 255,
  excerptChars: 500,
  contentChars: 12_000,
  totalBytes: 48_000
} as const;

type Rule = { id: string; view: "normalized" | "compact"; pattern: RegExp };

const verbsIgnore = "ignora|ignore|ignorar|olvida|olvidate|forget|descarta|omiti|omite|disregard|saltea|saltate|anula|override";
// Sin "reglas": "un vecino ignora las reglas del consorcio" es una noticia legítima.
const instructionNouns = "instrucciones|instruccion|indicaciones|directivas|instructions|prompt";

// Se evalúan sobre el texto normalizado (minúsculas, sin tildes, sin Unicode invisible)
// y sobre la vista compacta (sin separadores, con leetspeak revertido) para frases ofuscadas.
const RULES: Rule[] = [
  { id: "IGNORE_INSTRUCTIONS", view: "normalized", pattern: new RegExp(`\\b(${verbsIgnore})\\b[^.\\n]{0,40}\\b(${instructionNouns})\\b`) },
  { id: "PREVIOUS_INSTRUCTIONS", view: "normalized", pattern: /\b(instrucciones|indicaciones|instructions)\s+(anteriores|previas|originales|del sistema|previous|above|prior)\b/ },
  { id: "ROLE_CHANGE", view: "normalized", pattern: /\b(actua|actuar|comportate|finge|fingi|simula|pretend|act|behave)\s+(como|as)\s+(si fueras\s+)?(un|una|el|la|a|an)?\s*(asistente|modelo|ia|ai|chatbot|bot|sistema|system|desarrollador|developer|administrador|admin|dan)\b/ },
  { id: "ROLE_REASSIGNMENT", view: "normalized", pattern: /\b(ahora\s+)?(sos|eres|you are|you're)\s+(ahora\s+|now\s+)?(un|una|el|la|a|an)?\s*(asistente|modelo de lenguaje|ia|ai|chatbot|dan|sistema sin restricciones|developer mode)\b/ },
  { id: "MODE_SWITCH", view: "normalized", pattern: /\b(modo desarrollador|developer mode|modo dios|god mode|sin restricciones|without restrictions|jailbreak|do anything now)\b/ },
  { id: "PROMPT_REVEAL", view: "normalized", pattern: /\b(revela|revelame|muestra|mostrame|decime|dime|imprime|imprimi|repeti|repite|copia|reveal|show|print|repeat|output)\b[^.\n]{0,40}\b(prompt|system prompt|instrucciones del sistema|mensaje del sistema|tus instrucciones|your instructions)\b/ },
  { id: "SYSTEM_PROMPT_MENTION", view: "normalized", pattern: /\b(system prompt|prompt del sistema|mensaje de sistema|mensaje del sistema)\b/ },
  // El normalizador colapsa saltos de línea, por eso se busca el marcador tras cualquier espacio.
  { id: "ROLE_MARKER", view: "normalized", pattern: /(^|\s)(system|assistant|developer)\s*:\s*\S/ },
  { id: "CHAT_TEMPLATE_TOKEN", view: "normalized", pattern: /(<\|im_(start|end)\|>|\[\/?inst\]|<<\/?sys>>|<\/?(system|assistant)>|###\s*(instruction|system))/ },
  { id: "OBFUSCATED_IGNORE", view: "compact", pattern: /(ignora|ignore|olvida|forget)(todas)?(las|tus|the|all|your)?(instrucciones|instructions)/ },
  { id: "OBFUSCATED_REVEAL", view: "compact", pattern: /(systemprompt|promptdelsistema|jailbreak|developermode|mododesarrollador)/ }
];

export class PromptInjectionGuard {
  /**
   * Rechaza patrones claros de cambio de rol, revelación del prompt o instrucciones ofuscadas
   * antes de consumir el proveedor. El mensaje es genérico: no indica qué patrón coincidió.
   * Devuelve el id de la regla solo para que el servidor lo registre.
   */
  static detect(input: string): string | null {
    const views = { normalized: ContentNormalizer.normalize(input), compact: ContentNormalizer.compact(input) };
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(views[rule.view])) return rule.id;
    }
    return null;
  }

  static validate(...inputs: (string | null | undefined)[]): void {
    for (const input of inputs) {
      if (!input) continue;
      const ruleId = PromptInjectionGuard.detect(input);
      if (ruleId) {
        moderationMetrics.promptInjectionRejected.inc({ ruleId });
        throw new ApiError(
          400,
          "El contenido no se puede procesar con la asistencia de IA. Revisalo y volvé a intentarlo.",
          { code: PROMPT_INJECTION_CODE }
        );
      }
    }
  }

  /**
   * Estimación conservadora de tokens (~3 bytes por token) para cortar antes de llamar al proveedor.
   */
  static estimateTokens(...inputs: (string | null | undefined)[]): number {
    const bytes = inputs.reduce((total, input) => total + (input ? Buffer.byteLength(input, "utf8") : 0), 0);
    return Math.ceil(bytes / 3);
  }

  /**
   * Verifica caracteres por campo, bytes totales y presupuesto estimado de tokens.
   */
  static validateLength(title: string, excerpt: string | null, content: string): number {
    const tooLarge = (message: string) => {
      moderationMetrics.aiInputTooLarge.inc();
      return new ApiError(400, message, { code: AI_INPUT_TOO_LARGE_CODE, limits: AI_INPUT_LIMITS, maxInputTokens: env.AI_MAX_INPUT_TOKENS });
    };

    if (title.length > AI_INPUT_LIMITS.titleChars) throw tooLarge("El título excede el límite permitido para la asistencia de IA.");
    if (excerpt && excerpt.length > AI_INPUT_LIMITS.excerptChars) throw tooLarge("La descripción excede el límite permitido para la asistencia de IA.");
    if (content.length > AI_INPUT_LIMITS.contentChars) throw tooLarge("El cuerpo de la noticia excede el límite permitido para la asistencia de IA.");

    const bytes = Buffer.byteLength(title, "utf8") + Buffer.byteLength(excerpt ?? "", "utf8") + Buffer.byteLength(content, "utf8");
    if (bytes > AI_INPUT_LIMITS.totalBytes) throw tooLarge("La noticia excede el tamaño permitido para la asistencia de IA.");

    const estimatedTokens = PromptInjectionGuard.estimateTokens(title, excerpt, content);
    if (estimatedTokens > env.AI_MAX_INPUT_TOKENS) throw tooLarge("La noticia excede el presupuesto de la asistencia de IA.");
    return estimatedTokens;
  }
}
