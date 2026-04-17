import { z } from "zod";

export const messageIdParamSchema = z.object({
  messageId: z.string().cuid()
});

export const messagesListQuerySchema = z.object({
  type: z.enum(["inbox", "sent"]).default("inbox"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

export const sendMessageSchema = z.object({
  receiverId: z.string().cuid(),
  content: z.string().min(1).max(2000),
  postId: z.string().cuid().optional()
});
