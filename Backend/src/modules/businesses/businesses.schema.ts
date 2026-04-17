import { z } from "zod";
import { BusinessCategory } from "@prisma/client";

export const businessSlugParamSchema = z.object({
  barrioSlug: z.string().min(1),
  businessSlug: z.string().min(1)
});

export const businessListQuerySchema = z.object({
  category: z.nativeEnum(BusinessCategory).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10)
});

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(255).regex(/^[a-z0-9-]+$/),
  category: z.nativeEnum(BusinessCategory),
  address: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  website: z.string().url().optional(),
  instagram: z.string().max(60).optional(),
  facebook: z.string().max(60).optional(),
  coverImage: z.string().url().optional(),
  photos: z.array(z.string().url()).max(10).default([]),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

export const updateBusinessSchema = createBusinessSchema.partial().omit({ slug: true });
