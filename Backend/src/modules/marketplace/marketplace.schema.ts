import { z } from "zod";
import { MarketplaceCategory, MarketplaceAvailability } from "@prisma/client";

export const marketplaceIdParamSchema = z.object({
  barrioSlug: z.string().min(1),
  postId: z.string().cuid()
});

export const marketplaceListQuerySchema = z.object({
  category: z.nativeEnum(MarketplaceCategory).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10)
});

export const createMarketplacePostSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(5).max(2000),
  price: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default("ARS"),
  category: z.nativeEnum(MarketplaceCategory),
  assetIds: z.array(z.string().cuid()).max(5).refine((ids) => new Set(ids).size === ids.length, "No se permiten assets duplicados").default([]),
  location: z.string().max(120).optional(),
  whatsapp: z.string().min(8).max(30)
}).strict();

export const updateMarketplacePostSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(5).max(2000).optional(),
  price: z.number().int().nonnegative().optional(),
  category: z.nativeEnum(MarketplaceCategory).optional(),
  availability: z.nativeEnum(MarketplaceAvailability).optional(),
  assetIds: z.array(z.string().cuid()).max(5).refine((ids) => new Set(ids).size === ids.length, "No se permiten assets duplicados").optional(),
  location: z.string().max(120).optional(),
  whatsapp: z.string().min(8).max(30).optional()
}).strict();

import { MarketplaceReportCategory } from "@prisma/client";
export const createMarketplaceReportSchema = z.object({
  category: z.nativeEnum(MarketplaceReportCategory),
  comment: z.string().max(1000).optional()
});
