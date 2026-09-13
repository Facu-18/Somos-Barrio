import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { moderationController } from "./moderation.controller";
import {
  getMarketplaceQueueQuerySchema,
  moderateMarketplaceDecisionSchema,
  getMarketplaceAssetQueueQuerySchema,
  moderateMarketplaceAssetDecisionSchema
} from "./moderation.schema";

export const moderationRouter = Router();

// Require Auth and at least EDITOR role
moderationRouter.use(requireAuth, requireRole(UserRole.EDITOR, UserRole.ADMIN));

// ── Marketplace Moderation Queue ──────────────────────────────────────────
moderationRouter.get(
  "/marketplace",
  validate({ query: getMarketplaceQueueQuerySchema }),
  asyncHandler(moderationController.getMarketplaceQueue)
);

// ── Marketplace Moderate Action ───────────────────────────────────────────
const postIdParamSchema = z.object({ postId: z.string().cuid() });

moderationRouter.post(
  "/marketplace/:postId/decision",
  validate({ params: postIdParamSchema, body: moderateMarketplaceDecisionSchema }),
  asyncHandler(moderationController.moderateMarketplacePost)
);

// ── Marketplace Asset Moderation ───────────────────────────────────────────
moderationRouter.get(
  "/marketplace/assets",
  validate({ query: getMarketplaceAssetQueueQuerySchema }),
  asyncHandler(moderationController.getMarketplaceAssetQueue)
);

const assetIdParamSchema = z.object({ assetId: z.string().cuid() });

moderationRouter.post(
  "/marketplace/assets/:assetId/decision",
  validate({ params: assetIdParamSchema, body: moderateMarketplaceAssetDecisionSchema }),
  asyncHandler(moderationController.moderateMarketplaceAsset)
);
