import { z } from "zod";

export const forumThreadParamSchema = z.object({
  barrioSlug: z.string().min(1),
  subforumSlug: z.string().min(1),
  threadId: z.string().cuid()
});

export const forumSubforumParamSchema = z.object({
  barrioSlug: z.string().min(1),
  subforumSlug: z.string().min(1)
});

export const forumListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10)
});

export const createThreadSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(5).max(5000)
});

export const createReplySchema = z.object({
  content: z.string().min(1).max(5000),
  parentReplyId: z.string().cuid().optional()
});

export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)])
});

export const replyIdParamSchema = z.object({
  barrioSlug: z.string().min(1),
  subforumSlug: z.string().min(1),
  threadId: z.string().cuid(),
  replyId: z.string().cuid()
});
