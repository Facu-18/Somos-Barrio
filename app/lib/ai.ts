export interface AiGeneration {
  generationId: string;
  operation: 'SUMMARIZE' | 'IMPROVE' | 'ASSIST';
  promptVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  sourceHash: string;
  original: { title: string; excerpt: string | null; content: string };
  suggestion: { summary: string; excerpt?: string; content?: string };
}

const codeMessages: Record<string, string> = {
  PROMPT_INJECTION_DETECTED: 'El texto no se puede procesar con la asistencia de IA. Revisalo y volvé a intentarlo.',
  AI_INPUT_TOO_LARGE: 'La noticia es demasiado larga para la asistencia de IA.',
  AI_OUTPUT_INVALID: 'La IA devolvió una propuesta inválida. Probá de nuevo en unos minutos.',
  AI_OUTPUT_TRUNCATED: 'La propuesta de la IA quedó incompleta. Probá de nuevo o acortá el texto.',
  AI_GENERATION_STALE: 'La noticia cambió desde que se generó la sugerencia. Generá una nueva antes de publicar.',
  AI_GENERATION_MISMATCH: 'La sugerencia no corresponde a esta noticia.',
  AI_GENERATION_ALREADY_APPLIED: 'Esta sugerencia ya se aplicó.',
  AI_REQUEST_IN_PROGRESS: 'Ya hay una sugerencia generándose. Esperá a que termine.',
  AI_DISABLED: 'La asistencia con IA está pausada temporalmente.',
  AI_GLOBAL_BUDGET_EXCEEDED: 'La asistencia con IA está pausada por el uso de hoy. Volvé a intentar mañana.',
  AI_CONCURRENCY_LIMIT: 'Hay mucha demanda de IA en este momento. Probá en unos minutos.',
  AI_LIMITS_UNAVAILABLE: 'La asistencia con IA no está disponible en este momento.',
  AI_PROVIDER_UNREACHABLE: 'No pudimos conectar con la IA. No se descontó tu mejora.',
};

export const aiErrorCode = (error: any): string | undefined => error?.response?.data?.details?.code;

export function aiErrorMessage(error: any, fallback: string) {
  const code = aiErrorCode(error);
  if (code === 'AI_DAILY_QUOTA_EXCEEDED') {
    const resetsAt = error?.response?.data?.details?.resetsAt;
    const time = resetsAt ? new Date(resetsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null;
    return time ? `Usaste todas tus mejoras de hoy. Se renuevan a las ${time}.` : 'Usaste todas tus mejoras de hoy.';
  }
  if (code && codeMessages[code]) return codeMessages[code];
  return error?.response?.data?.message || fallback;
}
