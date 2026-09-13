import { ForumContentStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import { notificationsService } from "../notifications/notifications.service";

const userSelect = { id: true, nickname: true, avatarUrl: true };

// Datos internos de moderación que nunca salen en respuestas: identifican la regla exacta.
const moderationOmit = { moderationRuleId: true, moderationContentHash: true, moderationPolicyVersion: true } as const;

// Texto fijo para la pantalla bloqueada: nunca copiar contenido del usuario.
const REPLY_NOTIFICATION_BODY = "Tocá para ver la respuesta.";

export type ForumViewer = { id: string; role: UserRole; barrioSlug?: string };

type LockedThread = { id: string; userId: string; status: ForumContentStatus; isClosed: boolean };
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

function moderate(target: "thread" | "reply", text: string) {
  const result = contentModerationService.evaluate(text, "FORUM");
  const status = result.decision === "BLOCK"
    ? ForumContentStatus.BLOCKED
    : result.decision === "REVIEW" ? ForumContentStatus.PENDING_REVIEW : ForumContentStatus.PUBLISHED;

  // Código público y genérico: el autor entiende el motivo sin conocer la regla exacta.
  let moderationReasonCode: string | null = null;
  if (result.decision !== "ALLOW") {
    if (result.categories.includes("THREAT")) moderationReasonCode = "THREAT";
    else if (result.categories.includes("DISCRIMINATION")) moderationReasonCode = "DISCRIMINATION";
    else if (result.categories.includes("INSULT")) moderationReasonCode = "INAPPROPRIATE_CONTENT";
    else moderationReasonCode = "OTHER_POLICY";

    logger.info(
      { domain: result.domain, target, decision: result.decision, ruleId: result.ruleId, policyVersion: result.policyVersion },
      "Contenido del foro retenido por moderación"
    );
  }

  return {
    status,
    moderationReasonCode,
    moderationRuleId: result.ruleId,
    moderationPolicyVersion: result.policyVersion,
    moderationContentHash: result.contentHash
  };
}

async function lockThread(tx: Prisma.TransactionClient, threadId: string, subforumId: string) {
  // FOR SHARE: respuestas concurrentes no se bloquean entre sí, pero cerrar o moderar el hilo
  // espera a que terminen, así nadie responde a un hilo que se está cerrando.
  const [thread] = await tx.$queryRaw<LockedThread[]>`
    SELECT id, "userId", status, "isClosed"
    FROM "ForumThread"
    WHERE id = ${threadId} AND "subforumId" = ${subforumId}
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

async function enqueueReplyNotifications(
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

export const forumService = {
  async listSubforums(barrioSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);

    return prisma.forumSubforum.findMany({
      where: { barrioId: barrio.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { threads: { where: { status: ForumContentStatus.PUBLISHED } } } } }
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

    const where = { subforumId: subforum.id, ...visibleTo(viewer) };

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
      where: { id: threadId, subforumId: subforum.id },
      omit: moderationOmit,
      include: {
        user: { select: userSelect },
        replies: {
          where: moderator ? {} : visibleTo(viewer),
          orderBy: { createdAt: "asc" },
          omit: moderationOmit,
          include: {
            user: { select: userSelect }
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

    return prisma.forumThread.create({
      data: {
        title,
        content,
        ...moderate("thread", `${title}\n${content}`),
        userId,
        barrioId: barrio.id,
        subforumId: subforum.id
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
    input: { title?: string; content?: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");
    if (thread.userId !== requesterId) {
      if (thread.status !== ForumContentStatus.PUBLISHED) throw new ApiError(404, "Hilo no encontrado");
      throw new ApiError(403, "No tienes permisos para editar este hilo");
    }
    if (thread.status === ForumContentStatus.REMOVED) throw new ApiError(409, "CONTENT_REMOVED");

    const title = input.title !== undefined ? cleanText(input.title) : thread.title;
    const content = input.content !== undefined ? cleanText(input.content) : thread.content;

    // La condición sobre updatedAt evita pisar una decisión de moderación concurrente.
    const updated = await prisma.forumThread.updateMany({
      where: { id: thread.id, updatedAt: thread.updatedAt, status: { not: ForumContentStatus.REMOVED } },
      data: { title, content, ...moderate("thread", `${title}\n${content}`) }
    });
    if (updated.count !== 1) throw new ApiError(409, "FORUM_CONTENT_CONFLICT");

    return prisma.forumThread.findUniqueOrThrow({
      where: { id: thread.id },
      omit: moderationOmit,
      include: { user: { select: userSelect } }
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
    const moderation = moderate("reply", content);

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

      const published = moderation.status === ForumContentStatus.PUBLISHED;
      const reply = await tx.forumReply.create({
        data: {
          content,
          parentReplyId: input.parentReplyId,
          threadId,
          userId,
          ...moderation,
          publishedAt: published ? new Date() : null
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
    input: { content: string }
  ) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const content = cleanText(input.content);
    const moderation = moderate("reply", content);

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

      const firstPublication = moderation.status === ForumContentStatus.PUBLISHED && reply.publishedAt === null;
      const updated = await tx.forumReply.updateMany({
        where: {
          id: reply.id,
          updatedAt: reply.updatedAt,
          publishedAt: reply.publishedAt,
          status: { not: ForumContentStatus.REMOVED }
        },
        data: { content, ...moderation, ...(firstPublication ? { publishedAt: new Date() } : {}) }
      });
      if (updated.count !== 1) throw new ApiError(409, "FORUM_CONTENT_CONFLICT");

      // Una respuesta retenida que se corrige y queda publicada notifica por primera y única vez.
      if (firstPublication) {
        const parent = reply.parentReplyId
          ? await tx.forumReply.findFirst({
            where: { id: reply.parentReplyId, status: ForumContentStatus.PUBLISHED },
            select: { userId: true }
          })
          : null;
        await enqueueReplyNotifications(tx, {
          barrioSlug,
          subforumSlug,
          threadId,
          threadAuthorId: thread.userId,
          replyId: reply.id,
          replyAuthorId: requesterId,
          parentAuthorId: parent?.userId
        });
      }

      return tx.forumReply.findUniqueOrThrow({
        where: { id: reply.id },
        omit: moderationOmit,
        include: { user: { select: userSelect } }
      });
    });
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
      where: { id: threadId, subforumId: subforum.id, status: ForumContentStatus.PUBLISHED }
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
      where: { id: threadId, subforumId: subforum.id, status: ForumContentStatus.PUBLISHED }
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

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    if (thread.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar este hilo");
    }

    await prisma.forumThread.delete({ where: { id: thread.id } });
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

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
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
