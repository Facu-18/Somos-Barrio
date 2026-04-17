import { z } from "zod";

export const barrioSlugParamSchema = z.object({
  barrioSlug: z.string().min(1)
});

export const createBarrioSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  city: z.string().min(2).max(120),
  province: z.string().min(2).max(120),
  country: z.string().length(2).default("AR")
});
