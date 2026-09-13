import { ClayTheme } from '../constants/ClayTheme';

export type ForumContentStatus = 'PUBLISHED' | 'PENDING_REVIEW' | 'BLOCKED' | 'REMOVED';

type StatusInfo = { label: string; icon: 'clock-outline' | 'block-helper' | 'eye-off-outline'; colors: { bg: string; text: string } };

export const forumStatusInfo: Record<Exclude<ForumContentStatus, 'PUBLISHED'>, StatusInfo> = {
  PENDING_REVIEW: { label: 'En revisión', icon: 'clock-outline', colors: ClayTheme.states.warning },
  BLOCKED: { label: 'No publicado', icon: 'block-helper', colors: ClayTheme.states.danger },
  REMOVED: { label: 'Removido', icon: 'eye-off-outline', colors: ClayTheme.states.neutral },
};

// Motivos genéricos que devuelve el backend; nunca identifican la regla exacta.
const reasonMessages: Record<string, string> = {
  THREAT: 'Parece contener una amenaza.',
  DISCRIMINATION: 'Parece contener expresiones discriminatorias.',
  INAPPROPRIATE_CONTENT: 'Parece contener insultos u ofensas.',
  OTHER_POLICY: 'Puede no cumplir las normas de convivencia.',
};

export function forumModerationMessage(status: ForumContentStatus, reasonCode?: string | null) {
  const reason = reasonCode ? reasonMessages[reasonCode] ?? reasonMessages.OTHER_POLICY : '';
  if (status === 'PENDING_REVIEW') return `Solo vos lo ves hasta que se revise. ${reason} Podés editarlo para corregirlo.`.trim();
  if (status === 'BLOCKED') return `No se publicó. ${reason} Editalo para volver a enviarlo.`.trim();
  if (status === 'REMOVED') return 'Fue removido por moderación y no se puede editar.';
  return '';
}

export const canEditForumContent = (status: ForumContentStatus) => status !== 'REMOVED';

const errorMessages: Record<string, string> = {
  THREAD_CLOSED: 'Este hilo está cerrado a nuevas respuestas.',
  THREAD_NOT_PUBLISHED: 'El hilo todavía no está publicado.',
  PARENT_REPLY_UNAVAILABLE: 'La respuesta a la que querés contestar ya no está disponible.',
  CONTENT_REMOVED: 'Este contenido fue removido por moderación y no se puede editar.',
  FORUM_CONTENT_CONFLICT: 'El contenido cambió mientras lo editabas. Volvé a intentarlo.',
};

export function forumErrorMessage(error: any, fallback: string) {
  const message: string | undefined = error?.response?.data?.message;
  if (message && errorMessages[message]) return errorMessages[message];
  // 429 trae un mensaje pensado para el usuario.
  if (error?.response?.status === 429 && message) return message;
  return message || fallback;
}
