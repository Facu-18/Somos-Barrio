import { z } from "zod";
import { NewsStatus } from "@prisma/client";

export const adminBarrioSlugParamSchema = z.object({
  slug: z.string().min(1)
});

export const adminBusinessIdParamSchema = z.object({
  businessId: z.string().cuid()
});

export const createBarrioSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  city: z.string().min(2).max(120),
  province: z.string().min(2).max(120),
  country: z.string().length(2).default("AR")
});

export const updateBarrioSchema = createBarrioSchema.partial().omit({ slug: true });

export const adminNewsQuerySchema = z.object({
  status: z.nativeEnum(NewsStatus).optional(),
  barrioSlug: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const verifyBusinessSchema = z.object({
  verified: z.boolean()
});
