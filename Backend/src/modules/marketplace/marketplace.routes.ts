import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireBarrioMember } from "../../middlewares/auth";
import {
  marketplaceIdParamSchema,
  marketplaceListQuerySchema,
  createMarketplacePostSchema,
  updateMarketplacePostSchema,
  createMarketplaceReportSchema,
  createMarketplaceAppealSchema
} from "./marketplace.schema";
import { marketplaceController } from "./marketplace.controller";
import { marketplaceAppealRateLimiter, marketplaceReportRateLimiter } from "../../middlewares/rate-limit";

const marketplaceRouter = Router({ mergeParams: true });

marketplaceRouter.get(
  "/",
  validate({ query: marketplaceListQuerySchema }),
  asyncHandler(marketplaceController.list)
);

marketplaceRouter.get(
  "/me",
  requireAuth,
  requireBarrioMember,
  validate({ query: marketplaceListQuerySchema }),
  asyncHandler(marketplaceController.listMe)
);

marketplaceRouter.get(
  "/:postId",
  requireAuth,
  requireBarrioMember,
  validate({ params: marketplaceIdParamSchema }),
  asyncHandler(marketplaceController.getById)
);

marketplaceRouter.post(
  "/",
  requireAuth,
  requireBarrioMember,
  validate({ body: createMarketplacePostSchema }),
  asyncHandler(marketplaceController.create)
);

marketplaceRouter.patch(
  "/:postId",
  requireAuth,
  requireBarrioMember,
  validate({ params: marketplaceIdParamSchema, body: updateMarketplacePostSchema }),
  asyncHandler(marketplaceController.update)
);

marketplaceRouter.delete(
  "/:postId",
  requireAuth,
  requireBarrioMember,
  validate({ params: marketplaceIdParamSchema }),
  asyncHandler(marketplaceController.remove)
);

marketplaceRouter.post(
  "/:postId/reports",
  requireAuth,
  requireBarrioMember,
  marketplaceReportRateLimiter,
  validate({ params: marketplaceIdParamSchema, body: createMarketplaceReportSchema }),
  asyncHandler(marketplaceController.report)
);

marketplaceRouter.post(
  "/:postId/appeals",
  requireAuth,
  requireBarrioMember,
  marketplaceAppealRateLimiter,
  validate({ params: marketplaceIdParamSchema, body: createMarketplaceAppealSchema }),
  asyncHandler(marketplaceController.appeal)
);

export { marketplaceRouter };
