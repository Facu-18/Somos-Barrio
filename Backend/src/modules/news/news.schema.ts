import { z } from "zod";
import { NewsCategory, NewsStatus, NewsVoteValue } from "@prisma/client";

export const newsSlugParamSchema = z.object({
  barrioSlug: z.string().min(1),
  newsSlug: z.string().min(1)
});

export const newsListQuerySchema = z.object({
  category: z.nativeEnum(NewsCategory).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10)
});

export const createNewsSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10),
  category: z.nativeEnum(NewsCategory),
  status: z.enum([NewsStatus.DRAFT, NewsStatus.PENDING_REVIEW]).default(NewsStatus.DRAFT)
});

export const updateNewsSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10).optional(),
  category: z.nativeEnum(NewsCategory).optional(),
  status: z.nativeEnum(NewsStatus).optional()
});

export const newsVoteSchema = z.object({
  value: z.nativeEnum(NewsVoteValue),
  reason: z.string().trim().min(10, "El fundamento debe tener al menos 10 caracteres").max(1000),
  sourceUrl: z.string().url("Debe ser una URL válida").max(500).optional().or(z.literal(''))
});

export const aiSummarySchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(255),
  generatedAt: z.string().datetime()
});

export const approveNewsSchema = z.object({
  aiSummary: aiSummarySchema.optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).optional()
}).default({});

export const rejectNewsSchema = z.object({
  observation: z.string().trim().min(5).max(1000)
});

export const newsAssistSchema = z.object({
  title: z.string().trim().min(3).max(255),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10)
});
