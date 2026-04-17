import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

const userSelect = { id: true, name: true, avatarUrl: true };

export const messagesService = {
  async list(userId: string, opts: { type: "inbox" | "sent"; page: number; limit: number }) {
    const skip = (opts.page - 1) * opts.limit;

    const where =
      opts.type === "inbox" ? { receiverId: userId } : { senderId: userId };

    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: userSelect },
          receiver: { select: userSelect },
          post: { select: { id: true, title: true } }
        }
      }),
      prisma.message.count({ where })
    ]);

    return { items, total, page: opts.page, limit: opts.limit };
  },

  async send(senderId: string, input: { receiverId: string; content: string; postId?: string }) {
    if (senderId === input.receiverId) {
      throw new ApiError(400, "No puedes enviarte un mensaje a ti mismo");
    }

    const receiver = await prisma.user.findUnique({ where: { id: input.receiverId } });
    if (!receiver) throw new ApiError(404, "Destinatario no encontrado");

    if (input.postId) {
      const post = await prisma.marketplacePost.findUnique({ where: { id: input.postId } });
      if (!post) throw new ApiError(404, "Publicacion no encontrada");
    }

    return prisma.message.create({
      data: { ...input, senderId },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect }
      }
    });
  },

  async markRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new ApiError(404, "Mensaje no encontrado");

    if (message.receiverId !== userId) {
      throw new ApiError(403, "No puedes marcar este mensaje como leido");
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() }
    });
  }
};
