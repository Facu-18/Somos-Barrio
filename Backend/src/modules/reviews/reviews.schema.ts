import { z } from "zod";

export const reviewParamSchema = z.object({
  barrioSlug: z.string().min(1),
  businessSlug: z.string().min(1)
});

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional()
});
