import { z } from "zod";
import { NewsCategory, NewsStatus } from "@prisma/client";

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
  category: z.nativeEnum(NewsCategory)
});

export const updateNewsSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10).optional(),
  category: z.nativeEnum(NewsCategory).optional(),
  status: z.nativeEnum(NewsStatus).optional()
});
