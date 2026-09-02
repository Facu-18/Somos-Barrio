import { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { notificationsService } from "../notifications/notifications.service";

const userSelect = { id: true, name: true, nickname: true, avatarUrl: true, avatarPublicId: true };

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

export const forumService = {
  async listSubforums(barrioSlug: string) {
    const barrio = await resolveBarrio(barrioSlug);

    return prisma.forumSubforum.findMany({
      where: { barrioId: barrio.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { threads: true } } }
    });
  },

  async listThreads(barrioSlug: string, subforumSlug: string, opts: { page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = { subforumId: subforum.id };

    const [items, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: userSelect },
          _count: { select: { replies: true } }
        }
      }),
      prisma.forumThread.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getThread(barrioSlug: string, subforumSlug: string, threadId: string) {
    const barrio = await resolveBarrio(barrioSlug);
    const subforum = await resolveSubforum(barrio.id, subforumSlug);

    const thread = await prisma.forumThread.findFirst({
      where: { id: threadId, subforumId: subforum.id },
      include: {
        user: { select: userSelect },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: userSelect }
          }
        }
      }
    });

    if (!thread) throw new ApiError(404, "Hilo no encontrado");
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

    return prisma.forumThread.create({
      data: {
        ...input,
        userId,
        barrioId: barrio.id,
        subforumId: subforum.id
      },
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

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    let parent = null;
    if (input.parentReplyId) {
      parent = await prisma.forumReply.findUnique({ where: { id: input.parentReplyId } });
      if (!parent || parent.threadId !== threadId) {
        throw new ApiError(400, "La respuesta padre no pertenece a este hilo");
      }
    }

    const reply = await prisma.forumReply.create({
      data: { ...input, threadId, userId },
      include: { user: { select: userSelect } }
    });

    // Fire & Forget Push Notification
    const targetUserId = input.parentReplyId ? parent?.userId : thread.userId;
    if (targetUserId && targetUserId !== userId) {
      const senderName = reply.user.nickname || reply.user.name;
      const title = input.parentReplyId ? "Nueva respuesta a tu comentario" : "Nuevo comentario en tu hilo";
      notificationsService.sendToUser(targetUserId, title, `${senderName}: ${input.content.substring(0, 50)}...`, {
        url: `/thread/${threadId}`
      }).catch(err => console.error("Error sending push:", err));
    }

    return reply;
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

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
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

    const thread = await prisma.forumThread.findFirst({ where: { id: threadId, subforumId: subforum.id } });
    if (!thread) throw new ApiError(404, "Hilo no encontrado");

    const reply = await prisma.forumReply.findFirst({ where: { id: replyId, threadId } });
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
  }
};
