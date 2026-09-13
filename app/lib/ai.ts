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
};

export const aiErrorCode = (error: any): string | undefined => error?.response?.data?.details?.code;

export function aiErrorMessage(error: any, fallback: string) {
  const code = aiErrorCode(error);
  if (code && codeMessages[code]) return codeMessages[code];
  return error?.response?.data?.message || fallback;
}
