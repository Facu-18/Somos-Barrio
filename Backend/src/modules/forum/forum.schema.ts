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

const threadTitle = z.string().trim().min(3).max(255);
const threadContent = z.string().trim().min(5).max(5000);
const replyContent = z.string().trim().min(1).max(5000);

export const createThreadSchema = z.object({
  title: threadTitle,
  content: threadContent
});

export const updateThreadSchema = z
  .object({ title: threadTitle.optional(), content: threadContent.optional() })
  .strict()
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "Indicá al menos un campo para actualizar"
  });

export const createReplySchema = z.object({
  content: replyContent,
  parentReplyId: z.string().cuid().optional()
});

export const updateReplySchema = z.object({ content: replyContent }).strict();

export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)])
});

export const replyIdParamSchema = z.object({
  barrioSlug: z.string().min(1),
  subforumSlug: z.string().min(1),
  threadId: z.string().cuid(),
  replyId: z.string().cuid()
});
