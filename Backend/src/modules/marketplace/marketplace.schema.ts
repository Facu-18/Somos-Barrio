import { z } from "zod";
import { MarketplaceCategory, MarketplaceStatus } from "@prisma/client";

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
  images: z.array(z.string().url()).max(10).default([]),
  location: z.string().max(255).optional()
});

export const updateMarketplacePostSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(5).max(2000).optional(),
  price: z.number().int().nonnegative().optional(),
  category: z.nativeEnum(MarketplaceCategory).optional(),
  status: z.nativeEnum(MarketplaceStatus).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  location: z.string().max(255).optional()
});
