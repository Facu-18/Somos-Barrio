import { ClayTheme } from '../constants/ClayTheme';

export type ForumContentStatus = 'PUBLISHED' | 'PENDING_REVIEW' | 'BLOCKED' | 'REMOVED';

export interface ForumAppeal {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
  statement: string;
  createdAt: string;
}

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
  HARASSMENT: 'Se consideró acoso o agresión hacia otra persona.',
  SPAM: 'Se consideró spam o contenido repetido.',
  REPORT_REVIEW: 'Recibió varios reportes de vecinos y el equipo lo va a revisar.',
  CONTENT_CORRECTED: 'Recibimos tu corrección y el equipo la va a revisar.',
  OTHER_POLICY: 'Puede no cumplir las normas de convivencia.',
};

export function forumModerationMessage(status: ForumContentStatus, reasonCode?: string | null) {
  const reason = reasonCode ? reasonMessages[reasonCode] ?? reasonMessages.OTHER_POLICY : '';
  if (status === 'PENDING_REVIEW') return `Solo vos lo ves hasta que se revise. ${reason} Podés editarlo para corregirlo.`.trim();
  if (status === 'BLOCKED') return `No se publicó. ${reason} Podés editarlo o apelar la decisión.`.trim();
  if (status === 'REMOVED') return `Fue removido por moderación. ${reason} Podés apelar la decisión.`.trim();
  return '';
}

export const canEditForumContent = (status: ForumContentStatus) => status !== 'REMOVED';
export const canAppealForumContent = (status: ForumContentStatus) => status === 'BLOCKED' || status === 'REMOVED';

export const forumReportCategories = [
  { id: 'THREAT', label: 'Amenaza o violencia' },
  { id: 'HARASSMENT', label: 'Acoso o agresión' },
  { id: 'DISCRIMINATION', label: 'Discriminación' },
  { id: 'SPAM', label: 'Spam o publicidad' },
  { id: 'OTHER', label: 'Otro motivo' },
] as const;

export type ForumReportCategory = (typeof forumReportCategories)[number]['id'];

const errorMessages: Record<string, string> = {
  THREAD_CLOSED: 'Este hilo está cerrado a nuevas respuestas.',
  THREAD_NOT_PUBLISHED: 'El hilo todavía no está publicado.',
  PARENT_REPLY_UNAVAILABLE: 'La respuesta a la que querés contestar ya no está disponible.',
  CONTENT_REMOVED: 'Este contenido fue removido por moderación y no se puede editar.',
  FORUM_CONTENT_CONFLICT: 'El contenido cambió mientras lo editabas. Volvé a intentarlo.',
  ALREADY_REPORTED: 'Ya reportaste este contenido. Gracias por avisar.',
  CANNOT_REPORT_OWN_CONTENT: 'No podés reportar tu propio contenido.',
  INVALID_APPEAL_STATE: 'Este contenido ya no se puede apelar.',
  APPEAL_ALREADY_PENDING: 'Ya hay una apelación en revisión para este contenido.',
  MODERATION_VERSION_CONFLICT: 'El contenido cambió mientras tanto. Actualizá e intentá de nuevo.',
  INVALID_MODERATION_TRANSITION: 'Esa acción no aplica al estado actual del contenido.',
  CANNOT_MODERATE_OWN_CONTENT: 'No podés publicar tu propio contenido; lo tiene que revisar otra persona del equipo.',
  IDEMPOTENCY_KEY_IN_USE: 'La solicitud ya se usó para otra acción. Volvé a intentarlo.',
};

export function forumErrorMessage(error: any, fallback: string) {
  const message: string | undefined = error?.response?.data?.message;
  if (message && errorMessages[message]) return errorMessages[message];
  // 429 trae un mensaje pensado para el usuario.
  if (error?.response?.status === 429 && message) return message;
  return message || fallback;
}
