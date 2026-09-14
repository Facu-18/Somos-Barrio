import { ForumAppealStatus, ForumContentStatus, ForumModerationAction, ForumReportCategory, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { moderationMetrics } from "../../lib/metrics";
import { ApiError } from "../../utils/api-error";
import { serializable } from "../moderation/moderation.access";
import {
  ForumTarget,
  HUMAN_HOLD_RULES,
  MANUAL_REVIEW_POLICY_VERSION,
  enqueueReplyNotifications,
  evaluateForumContent,
  isHumanHold,
  publishReplyOnce,
  targetKey
} from "./forum.moderation";

const userSelect = { id: true, nickname: true, avatarUrl: true };

// Datos internos de moderación que nunca salen en respuestas: identifican la regla exacta.
const moderationOmit = { moderationRuleId: true, moderationContentHash: true, moderationPolicyVersion: true } as const;
const pendingAppealInclude = {
  where: { status: ForumAppealStatus.PENDING },
  take: 1,
  select: { id: true, status: true, statement: true, createdAt: true }
} as const;

export type ForumViewer = { id: string; role: UserRole; barrioSlug?: string };

type LockedThread = {
  id: string;
  userId: string;
  barrioId: string;
  status: ForumContentStatus;
  isClosed: boolean;
};
type LockedReply = { id: string; threadId: string; userId: string; status: ForumContentStatus };

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

async function resolveSubforum(barrioId: string, subforumSlug: string) {
  const subforum = await prisma.forumSubforum.findUnique({
    where: { barrioId_slug: { barrioId, slug: subforumSlug } }
  });
  if (!subforum) throw new ApiError(404, "Subforo no encontrado");
  return subforum;
}

function isModerator(viewer: ForumViewer | undefined, barrioSlug: string) {
  return viewer?.role === UserRole.ADMIN || (viewer?.role === UserRole.EDITOR && viewer.barrioSlug === barrioSlug);
}

// Público: solo contenido publicado. Autenticado: además lo propio, para que el autor vea su estado.
function visibleTo(viewer: ForumViewer | undefined) {
  return viewer
    ? { OR: [{ status: ForumContentStatus.PUBLISHED }, { userId: viewer.id }] }
    : { status: ForumContentStatus.PUBLISHED };
}

function cleanText(value: string) {
  const text = value.trim();
  if (!text) throw new ApiError(400, "El contenido no puede estar vacío");
  return text;
}

async function lockThread(tx: Prisma.TransactionClient, threadId: string, subforumId: string) {
  // FOR SHARE: respuestas concurrentes no se bloquean entre sí, pero cerrar o moderar el hilo
  // espera a que terminen, así nadie responde a un hilo que se está cerrando.
  const [thread] = await tx.$queryRaw<LockedThread[]>`
    SELECT id, "userId", "barrioId", status, "isClosed"
    FROM "ForumThread"
    WHERE id = ${threadId} AND "subforumId" = ${subforumId} AND "deletedAt" IS NULL
    FOR SHARE
  `;
  if (!thread) throw new ApiError(404, "Hilo no encontrado");
  return thread;
}

function assertThreadAcceptsReplies(thread: LockedThread, requesterId: string) {
  if (thread.status !== ForumContentStatus.PUBLISHED) {
    if (thread.userId === requesterId) throw new ApiError(409, "THREAD_NOT_PUBLISHED");
    throw new ApiError(404, "Hilo no encontrado");
  }
  if (thread.isClosed) throw new ApiError(409, "THREAD_CLOSED");
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Hilo o respuesta del subforo, con lo necesario para reportar o apelar.
async function resolveTarget(
  tx: Prisma.TransactionClient,
  subforumId: string,
  threadId: string,
  replyId?: string
) {
  const [thread] = await tx.$queryRaw<(LockedThread & { moderationVersion: number })[]>`
    SELECT id, "userId", "barrioId", status, "isClosed", "moderationVersion"
    FROM "ForumThread"
    WHERE id = ${threadId} AND "subforumId" = ${subforumId} AND "deletedAt" IS NULL
    FOR UPDATE
  `;
  if (!thread) throw new ApiError(404, "Hilo no encontrado");
  if (!replyId) {
    return { target: { kind: "thread", id: thread.id } as ForumTarget, thread, content: thread };
  }

  const [reply] = await tx.$queryRaw<(LockedReply & { moderationVersion: number })[]>`
    SELECT id, "threadId", "userId", status, "moderationVersion"
    FROM "ForumReply"
    WHERE id = ${replyId} AND "threadId" = ${threadId}
    FOR UPDATE
  `;
  if (!reply) throw new ApiError(404, "Respuesta no encontrada");
  return { target: { kind: "reply", id: reply.id } as ForumTarget, thread, content: reply };
}

export const forumService = {
  async listSubforums(barrioSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);

    return prisma.forumSubforum.findMany({
      where: { barrioId: barrio.id },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { threads: { where: { status: ForumContentStatus.PUBLISHED, deletedAt: null } } } }
      }
    });
  },

  async listThreads(
    barrioSlug: string,
    subforumSlug: string,
    opts: { page: number; limit: number },
    viewer?: ForumViewer
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = { subforumId: subforum.id, deletedAt: null, ...visibleTo(viewer) };

    const [items, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        omit: moderationOmit,
        include: {
          user: { select: userSelect },
          _count: { select: { replies: { where: { status: ForumContentStatus.PUBLISHED } } } }
        }
      }),
      prisma.forumThread.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getThread(barrioSlug: string, subforumSlug: string, threadId: string, viewer?: ForumViewer) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const moderator = isModerator(viewer, barrioSlug);

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, subforumId: subforum.id, deletedAt: null },
      omit: moderationOmit,
      include: {
        user: { select: userSelect },
        appeals: pendingAppealInclude,
        replies: {
          where: moderator ? {} : visibleTo(viewer),
          orderBy: { createdAt: "asc" },
          omit: moderationOmit,
          include: {
            user: { select: userSelect },
            appeals: pendingAppealInclude
          }
        },
        _count: { select: { replies: { where: { status: ForumContentStatus.PUBLISHED } } } }
      }
    });

    if (!thread) throw new ApiError(404, "Hilo no encontrado");
    if (thread.status !== ForumContentStatus.PUBLISHED && thread.userId !== viewer?.id && !moderator) {
      throw new ApiError(404, "Hilo no encontrado");
    }
    return thread;
  },

  async createThread(
    barrioSlug: string,
    subforumSlug: string,
    userId: string,
    input: { title: string; content: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const title = cleanText(input.title);
    const content = cleanText(input.content);
    const evaluation = evaluateForumContent("thread", `${title}\n${content}`);

    return prisma.forumThread.create({
      data: {
        title,
        content,
        ...evaluation.row,
        userId,
        barrioId: barrio.id,
        subforumId: subforum.id,
        decisions: {
          create: {
            barrioId: barrio.id,
            actorId: userId,
            action: ForumModerationAction.AUTO_REVIEW,
            toVersion: 0,
            ...evaluation.decision
          }
        }
      },
      omit: moderationOmit,
      include: { user: { select: userSelect } }
    });
  },

  async updateThread(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    requesterId: string,
    input: { title?: string; content?: string; expectedVersion?: number }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id, deletedAt: null } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");
    if (thread.userId !== requesterId) {
      if (thread.status !== ForumContentStatus.PUBLISHED) throw new ApiError(404, "Hilo no encontrado");
      throw new ApiError(403, "No tienes permisos para editar este hilo");
    }
    if (thread.status === ForumContentStatus.REMOVED) throw new ApiError(409, "CONTENT_REMOVED");
    if (input.expectedVersion !== undefined && input.expectedVersion !== thread.moderationVersion) {
      throw new ApiError(409, "FORUM_CONTENT_CONFLICT");
    }

    const title = input.title !== undefined ? cleanText(input.title) : thread.title;
    const content = input.content !== undefined ? cleanText(input.content) : thread.content;
    const evaluation = evaluateForumContent("thread", `${title}\n${content}`, { humanHold: isHumanHold(thread) });

    return prisma.$transaction(async (tx) => {
      // CAS sobre la versión: una decisión de moderación concurrente no se pisa.
      const updated = await tx.forumThread.updateMany({
        where: {
          id: thread.id,
          moderationVersion: thread.moderationVersion,
          deletedAt: null,
          status: { not: ForumContentStatus.REMOVED }
        },
        data: { title, content, ...evaluation.row, moderationVersion: { increment: 1 } }
      });
      if (updated.count !== 1) throw new ApiError(409, "FORUM_CONTENT_CONFLICT");

      await tx.forumModerationDecision.create({
        data: {
          threadId: thread.id,
          barrioId: thread.barrioId,
          actorId: requesterId,
          action: ForumModerationAction.OWNER_EDIT,
          fromStatus: thread.status,
          fromVersion: thread.moderationVersion,
          toVersion: thread.moderationVersion + 1,
          ...evaluation.decision
        }
      });
      // Una corrección reemplaza la apelación pendiente sobre la versión anterior.
      await tx.forumAppeal.updateMany({
        where: { threadId: thread.id, status: ForumAppealStatus.PENDING },
        data: { status: ForumAppealStatus.SUPERSEDED }
      });

      return tx.forumThread.findUniqueOrThrow({
        where: { id: thread.id },
        omit: moderationOmit,
        include: { user: { select: userSelect }, appeals: pendingAppealInclude }
      });
    });
  },

  async createReply(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    userId: string,
    input: { content: string; parentReplyId?: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const content = cleanText(input.content);
    const evaluation = evaluateForumContent("reply", content);

    return prisma.$transaction(async (tx) => {
      const thread = await lockThread(tx, threadId, subforum.id);
      assertThreadAcceptsReplies(thread, userId);

      let parent: LockedReply | undefined;
      if (input.parentReplyId) {
        [parent] = await tx.$queryRaw<LockedReply[]>`
          SELECT id, "threadId", "userId", status
          FROM "ForumReply"
          WHERE id = ${input.parentReplyId}
          FOR SHARE
        `;
        if (!parent || parent.threadId !== threadId) {
          throw new ApiError(400, "La respuesta padre no pertenece a este hilo");
        }
        if (parent.status !== ForumContentStatus.PUBLISHED) {
          throw new ApiError(409, "PARENT_REPLY_UNAVAILABLE");
        }
      }

      const published = evaluation.row.status === ForumContentStatus.PUBLISHED;
      const reply = await tx.forumReply.create({
        data: {
          content,
          parentReplyId: input.parentReplyId,
          threadId,
          userId,
          ...evaluation.row,
          publishedAt: published ? new Date() : null,
          decisions: {
            create: {
              barrioId: thread.barrioId,
              actorId: userId,
              action: ForumModerationAction.AUTO_REVIEW,
              toVersion: 0,
              ...evaluation.decision
            }
          }
        },
        omit: moderationOmit,
        include: { user: { select: userSelect } }
      });

      if (published) {
        await enqueueReplyNotifications(tx, {
          barrioSlug,
          subforumSlug,
          threadId,
          threadAuthorId: thread.userId,
          replyId: reply.id,
          replyAuthorId: userId,
          parentAuthorId: parent?.userId
        });
      }

      return reply;
    });
  },

  async updateReply(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    replyId: string,
    requesterId: string,
    input: { content: string; expectedVersion?: number }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const content = cleanText(input.content);

    return prisma.$transaction(async (tx) => {
      const thread = await lockThread(tx, threadId, subforum.id);

      const reply = await tx.forumReply.findFirst({ where: { id: replyId, threadId } });
      if (!reply) throw new ApiError(404, "Respuesta no encontrada");
      if (reply.userId !== requesterId) {
        if (reply.status !== ForumContentStatus.PUBLISHED) throw new ApiError(404, "Respuesta no encontrada");
        throw new ApiError(403, "No tienes permisos para editar esta respuesta");
      }
      if (reply.status === ForumContentStatus.REMOVED) throw new ApiError(409, "CONTENT_REMOVED");
      assertThreadAcceptsReplies(thread, requesterId);
      if (input.expectedVersion !== undefined && input.expectedVersion !== reply.moderationVersion) {
        throw new ApiError(409, "FORUM_CONTENT_CONFLICT");
      }

      const evaluation = evaluateForumContent("reply", content, { humanHold: isHumanHold(reply) });
      const updated = await tx.forumReply.updateMany({
        where: { id: reply.id, moderationVersion: reply.moderationVersion, status: { not: ForumContentStatus.REMOVED } },
        data: { content, ...evaluation.row, moderationVersion: { increment: 1 } }
      });
      if (updated.count !== 1) throw new ApiError(409, "FORUM_CONTENT_CONFLICT");

      await tx.forumModerationDecision.create({
        data: {
          replyId: reply.id,
          barrioId: thread.barrioId,
          actorId: requesterId,
          action: ForumModerationAction.OWNER_EDIT,
          fromStatus: reply.status,
          fromVersion: reply.moderationVersion,
          toVersion: reply.moderationVersion + 1,
          ...evaluation.decision
        }
      });
      await tx.forumAppeal.updateMany({
        where: { replyId: reply.id, status: ForumAppealStatus.PENDING },
        data: { status: ForumAppealStatus.SUPERSEDED }
      });

      // Una respuesta retenida que se corrige y queda publicada notifica por primera y única vez.
      if (evaluation.row.status === ForumContentStatus.PUBLISHED) {
        await publishReplyOnce(tx, reply, { barrioSlug, subforumSlug, threadId, threadAuthorId: thread.userId });
      }

      return tx.forumReply.findUniqueOrThrow({
        where: { id: reply.id },
        omit: moderationOmit,
        include: { user: { select: userSelect }, appeals: pendingAppealInclude }
      });
    });
  },

  async report(
    barrioSlug: string,
    subforumSlug: string,
    reporterId: string,
    params: { threadId: string; replyId?: string },
    input: { category: ForumReportCategory; comment?: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    try {
      await serializable(async (tx) => {
        const { target, thread, content } = await resolveTarget(tx, subforum.id, params.threadId, params.replyId);
        // Solo se reporta lo visible públicamente; el resto ya está fuera de circulación.
        if (thread.status !== ForumContentStatus.PUBLISHED || content.status !== ForumContentStatus.PUBLISHED) {
          throw new ApiError(404, target.kind === "thread" ? "Hilo no encontrado" : "Respuesta no encontrada");
        }
        if (content.userId === reporterId) throw new ApiError(400, "CANNOT_REPORT_OWN_CONTENT");

        moderationMetrics.reports.inc({ domain: "FORUM", category: input.category });
        await tx.forumReport.create({
          data: { ...targetKey(target), reporterId, category: input.category, comment: input.comment }
        });

        const openReports = await tx.forumReport.count({ where: { ...targetKey(target), status: "OPEN" } });
        if (openReports < env.FORUM_REPORT_THRESHOLD) return;

        // Umbral alcanzado: se oculta preventivamente hasta que alguien del equipo lo revise.
        const hidden = target.kind === "thread"
          ? await tx.forumThread.updateMany({
            where: { id: target.id, moderationVersion: content.moderationVersion, status: ForumContentStatus.PUBLISHED },
            data: {
              status: ForumContentStatus.PENDING_REVIEW,
              moderationReasonCode: "REPORT_REVIEW",
              moderationRuleId: HUMAN_HOLD_RULES.reports,
              moderationVersion: { increment: 1 }
            }
          })
          : await tx.forumReply.updateMany({
            where: { id: target.id, moderationVersion: content.moderationVersion, status: ForumContentStatus.PUBLISHED },
            data: {
              status: ForumContentStatus.PENDING_REVIEW,
              moderationReasonCode: "REPORT_REVIEW",
              moderationRuleId: HUMAN_HOLD_RULES.reports,
              moderationVersion: { increment: 1 }
            }
          });
        if (hidden.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

        await tx.forumModerationDecision.create({
          data: {
            ...targetKey(target),
            barrioId: thread.barrioId,
            action: ForumModerationAction.REPORT_THRESHOLD,
            fromStatus: ForumContentStatus.PUBLISHED,
            toStatus: ForumContentStatus.PENDING_REVIEW,
            fromVersion: content.moderationVersion,
            toVersion: content.moderationVersion + 1,
            reasonCode: "REPORT_REVIEW",
            ruleId: HUMAN_HOLD_RULES.reports,
            policyVersion: MANUAL_REVIEW_POLICY_VERSION,
            categories: ["REPORT_THRESHOLD"],
            evidence: { openReports }
          }
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "ALREADY_REPORTED");
      throw error;
    }
  },

  async appeal(
    barrioSlug: string,
    subforumSlug: string,
    ownerId: string,
    params: { threadId: string; replyId?: string },
    input: { statement: string; expectedVersion: number; idempotencyKey: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const statement = cleanText(input.statement);

    const sameRequest = (appeal: { threadId: string | null; replyId: string | null; ownerId: string; statement: string; contentVersion: number }) =>
      appeal.ownerId === ownerId
      && appeal.statement === statement
      && appeal.contentVersion === input.expectedVersion
      && (params.replyId ? appeal.replyId === params.replyId : appeal.threadId === params.threadId);

    try {
      return await serializable(async (tx) => {
        const byKey = await tx.forumAppeal.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (byKey) {
          if (sameRequest(byKey)) return byKey;
          throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
        }

        const { target, content } = await resolveTarget(tx, subforum.id, params.threadId, params.replyId);
        if (content.userId !== ownerId) {
          if (content.status !== ForumContentStatus.PUBLISHED) {
            throw new ApiError(404, target.kind === "thread" ? "Hilo no encontrado" : "Respuesta no encontrada");
          }
          throw new ApiError(403, "Solo el autor puede apelar");
        }
        if (content.status !== ForumContentStatus.BLOCKED && content.status !== ForumContentStatus.REMOVED) {
          throw new ApiError(409, "INVALID_APPEAL_STATE");
        }
        if (content.moderationVersion !== input.expectedVersion) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

        const againstDecision = await tx.forumModerationDecision.findFirst({
          where: targetKey(target),
          orderBy: { toVersion: "desc" },
          select: { id: true }
        });
        return tx.forumAppeal.create({
          data: {
            ...targetKey(target),
            ownerId,
            statement,
            idempotencyKey: input.idempotencyKey,
            contentVersion: input.expectedVersion,
            againstDecisionId: againstDecision?.id
          }
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const byKey = await prisma.forumAppeal.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (byKey && sameRequest(byKey)) return byKey;
        throw new ApiError(409, byKey ? "IDEMPOTENCY_KEY_IN_USE" : "APPEAL_ALREADY_PENDING");
      }
      throw error;
    }
  },

  async voteThread(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    userId: string,
    value: 1 | -1
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, subforumId: subforum.id, status: ForumContentStatus.PUBLISHED, deletedAt: null }
    });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    return prisma.$transaction(async (tx) => {
      const existing = await tx.forumVote.findUnique({
        where: { userId_threadId: { userId, threadId } }
      });

      if (existing) {
        if (existing.value === value) {
          // Toggle off: quitar voto
          await tx.forumVote.delete({ where: { userId_threadId: { userId, threadId } } });
          await tx.forumThread.update({
            where: { id: threadId },
            data: {
              upVotes:   { decrement: value === 1  ? 1 : 0 },
              downVotes: { decrement: value === -1 ? 1 : 0 }
            }
          });
          return { voted: false, value: null };
        } else {
          // Cambiar sentido del voto
          await tx.forumVote.update({
            where: { userId_threadId: { userId, threadId } },
            data: { value }
          });
          await tx.forumThread.update({
            where: { id: threadId },
            data: {
              upVotes:   { increment: value === 1  ? 1 : -1 },
              downVotes: { increment: value === -1 ? 1 : -1 }
            }
          });
          return { voted: true, value };
        }
      } else {
        await tx.forumVote.create({ data: { userId, threadId, value } });
        await tx.forumThread.update({
          where: { id: threadId },
          data: {
            upVotes:   { increment: value === 1  ? 1 : 0 },
            downVotes: { increment: value === -1 ? 1 : 0 }
          }
        });
        return { voted: true, value };
      }
    });
  },

  async voteReply(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    replyId: string,
    userId: string,
    value: 1 | -1
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, subforumId: subforum.id, status: ForumContentStatus.PUBLISHED, deletedAt: null }
    });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    const reply = await prisma.forumReply.findFirst({
      where: { id: replyId, threadId, status: ForumContentStatus.PUBLISHED }
    });
    if (!reply) throw new ApiError(404, "Respuesta no encontrada");

    return prisma.$transaction(async (tx) => {
      const existing = await tx.forumVote.findUnique({
        where: { userId_replyId: { userId, replyId } }
      });

      if (existing) {
        if (existing.value === value) {
          await tx.forumVote.delete({ where: { userId_replyId: { userId, replyId } } });
          await tx.forumReply.update({
            where: { id: replyId },
            data: {
              upVotes:   { decrement: value === 1  ? 1 : 0 },
              downVotes: { decrement: value === -1 ? 1 : 0 }
            }
          });
          return { voted: false, value: null };
        } else {
          await tx.forumVote.update({
            where: { userId_replyId: { userId, replyId } },
            data: { value }
          });
          await tx.forumReply.update({
            where: { id: replyId },
            data: {
              upVotes:   { increment: value === 1  ? 1 : -1 },
              downVotes: { increment: value === -1 ? 1 : -1 }
            }
          });
          return { voted: true, value };
        }
      } else {
        await tx.forumVote.create({ data: { userId, replyId, value } });
        await tx.forumReply.update({
          where: { id: replyId },
          data: {
            upVotes:   { increment: value === 1  ? 1 : 0 },
            downVotes: { increment: value === -1 ? 1 : 0 }
          }
        });
        return { voted: true, value };
      }
    });
  },

  async deleteThread(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    requesterId: string,
    requesterRole: UserRole
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id, deletedAt: null } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    if (thread.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar este hilo");
    }

    // Borrado lógico: se oculta de todo el foro, pero decisiones, reportes y apelaciones quedan como evidencia.
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.forumThread.updateMany({
        where: { id: thread.id, moderationVersion: thread.moderationVersion, deletedAt: null },
        data: { deletedAt: new Date(), moderationVersion: { increment: 1 } }
      });
      if (deleted.count !== 1) throw new ApiError(409, "FORUM_CONTENT_CONFLICT");

      await tx.forumModerationDecision.create({
        data: {
          threadId: thread.id,
          barrioId: thread.barrioId,
          actorId: requesterId,
          action: ForumModerationAction.OWNER_DELETE,
          fromStatus: thread.status,
          toStatus: thread.status,
          fromVersion: thread.moderationVersion,
          toVersion: thread.moderationVersion + 1,
          policyVersion: MANUAL_REVIEW_POLICY_VERSION,
          evidence: { deletedByRole: thread.userId === requesterId ? "AUTHOR" : requesterRole }
        }
      });
    });
  },

  async closeThread(
    barrioSlug: string,
    subforumSlug: string,
    threadId: string,
    requesterId: string,
    requesterRole: UserRole
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id, deletedAt: null } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    if (thread.userId !== requesterId && requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.EDITOR) {
      throw new ApiError(403, "No tienes permisos para cerrar este hilo");
    }

    if (thread.isClosed) {
      throw new ApiError(400, "El hilo ya se encuentra cerrado");
    }

    return prisma.forumThread.update({
      where: { id: thread.id },
      data: {
        isClosed: true,
        closedAt: new Date(),
        closedById: requesterId
      },
      omit: moderationOmit
    });
  }
};
