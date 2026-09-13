import { ForumContentStatus, ForumModerationAction, Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import { notificationsService } from "../notifications/notifications.service";

export type ForumTarget = { kind: "thread"; id: string } | { kind: "reply"; id: string };

export const targetKey = (target: ForumTarget) =>
  target.kind === "thread" ? { threadId: target.id } : { replyId: target.id };

export const MANUAL_REVIEW_POLICY_VERSION = "forum-review-1";

// Marcadores de `moderationRuleId` para retenciones que decidió una persona (o los reportes),
// no una regla automática. Una corrección limpia no alcanza para publicar ese contenido.
export const HUMAN_HOLD_RULES = {
  manual: "MANUAL_REVIEW",
  reports: "REPORT_THRESHOLD",
  corrected: "CONTENT_CORRECTED_REVIEW"
} as const;

const humanHoldRuleIds: string[] = Object.values(HUMAN_HOLD_RULES);

export const isRetained = (status: ForumContentStatus) =>
  status === ForumContentStatus.PENDING_REVIEW || status === ForumContentStatus.BLOCKED;

export function isHumanHold(row: { status: ForumContentStatus; moderationRuleId: string | null }) {
  return isRetained(row.status) && humanHoldRuleIds.includes(row.moderationRuleId ?? "");
}

// Evalúa el texto con la política del foro. `humanHold` fuerza revisión humana cuando la
// política lo permitiría, para que editar no deshaga una decisión de moderación.
export function evaluateForumContent(target: ForumTarget["kind"], text: string, options: { humanHold?: boolean } = {}) {
  const result = contentModerationService.evaluate(text, "FORUM");
  const keepForHuman = options.humanHold === true && result.decision === "ALLOW";

  const status = keepForHuman || result.decision === "REVIEW"
    ? ForumContentStatus.PENDING_REVIEW
    : result.decision === "BLOCK" ? ForumContentStatus.BLOCKED : ForumContentStatus.PUBLISHED;

  // Código público y genérico: el autor entiende el motivo sin conocer la regla exacta.
  let reasonCode: string | null = null;
  if (keepForHuman) reasonCode = "CONTENT_CORRECTED";
  else if (result.decision !== "ALLOW") {
    if (result.categories.includes("THREAT")) reasonCode = "THREAT";
    else if (result.categories.includes("DISCRIMINATION")) reasonCode = "DISCRIMINATION";
    else if (result.categories.includes("INSULT")) reasonCode = "INAPPROPRIATE_CONTENT";
    else reasonCode = "OTHER_POLICY";

    logger.info(
      { domain: result.domain, target, decision: result.decision, ruleId: result.ruleId, policyVersion: result.policyVersion },
      "Contenido del foro retenido por moderación"
    );
  }

  const ruleId = keepForHuman ? HUMAN_HOLD_RULES.corrected : result.ruleId;
  return {
    row: {
      status,
      moderationReasonCode: reasonCode,
      moderationRuleId: ruleId,
      moderationPolicyVersion: result.policyVersion,
      moderationContentHash: result.contentHash
    },
    decision: {
      toStatus: status,
      reasonCode,
      ruleId,
      policyVersion: result.policyVersion,
      contentHash: result.contentHash,
      categories: keepForHuman ? ["CONTENT_CORRECTED"] : result.categories
    }
  };
}

// Regla automática vigente sobre un contenido retenido: la que una aprobación humana estaría revirtiendo.
export async function findOverriddenRule(tx: Prisma.TransactionClient, target: ForumTarget) {
  const latestAutomated = await tx.forumModerationDecision.findFirst({
    where: { ...targetKey(target), action: { in: [ForumModerationAction.AUTO_REVIEW, ForumModerationAction.OWNER_EDIT] } },
    orderBy: { toVersion: "desc" },
    select: { toStatus: true, ruleId: true }
  });
  if (!latestAutomated?.ruleId || !isRetained(latestAutomated.toStatus)) return null;
  if (humanHoldRuleIds.includes(latestAutomated.ruleId)) return null;
  return latestAutomated.ruleId;
}

// Texto fijo para la pantalla bloqueada: nunca copiar contenido del usuario.
const REPLY_NOTIFICATION_BODY = "Tocá para ver la respuesta.";

export async function enqueueReplyNotifications(
  tx: Prisma.TransactionClient,
  params: {
    barrioSlug: string;
    subforumSlug: string;
    threadId: string;
    threadAuthorId: string;
    replyId: string;
    replyAuthorId: string;
    parentAuthorId?: string | null;
  }
) {
  const recipients = new Map<string, string>();
  if (params.parentAuthorId && params.parentAuthorId !== params.replyAuthorId) {
    recipients.set(params.parentAuthorId, "Nueva respuesta a tu comentario");
  }
  if (params.threadAuthorId !== params.replyAuthorId && !recipients.has(params.threadAuthorId)) {
    recipients.set(params.threadAuthorId, "Nuevo comentario en tu hilo");
  }
  if (recipients.size === 0) return;

  const { barrioSlug, subforumSlug, threadId, replyId } = params;
  await notificationsService.enqueue(tx, [...recipients].map(([userId, title]) => ({
    userId,
    title,
    body: REPLY_NOTIFICATION_BODY,
    data: {
      type: "forum_reply",
      barrioSlug,
      subforumSlug,
      threadId,
      replyId,
      url: `/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}?replyId=${replyId}`
    }
  })));
}

// Publica por primera vez una respuesta y avisa una única vez; `publishedAt` es la guarda.
export async function publishReplyOnce(
  tx: Prisma.TransactionClient,
  reply: { id: string; userId: string; parentReplyId: string | null; publishedAt: Date | null },
  context: { barrioSlug: string; subforumSlug: string; threadId: string; threadAuthorId: string }
) {
  if (reply.publishedAt) return;
  const marked = await tx.forumReply.updateMany({
    where: { id: reply.id, publishedAt: null },
    data: { publishedAt: new Date() }
  });
  if (marked.count !== 1) return;

  const parent = reply.parentReplyId
    ? await tx.forumReply.findFirst({
      where: { id: reply.parentReplyId, status: ForumContentStatus.PUBLISHED },
      select: { userId: true }
    })
    : null;
  await enqueueReplyNotifications(tx, {
    ...context,
    replyId: reply.id,
    replyAuthorId: reply.userId,
    parentAuthorId: parent?.userId
  });
}
