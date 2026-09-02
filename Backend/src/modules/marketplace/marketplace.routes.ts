import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireBarrioMember } from "../../middlewares/auth";
import {
  marketplaceIdParamSchema,
  marketplaceListQuerySchema,
  createMarketplacePostSchema,
  updateMarketplacePostSchema
} from "./marketplace.schema";
import { marketplaceController } from "./marketplace.controller";

const marketplaceRouter = Router({ mergeParams: true });

marketplaceRouter.get(
  "/",
  validate({ query: marketplaceListQuerySchema }),
  asyncHandler(marketplaceController.list)
);

marketplaceRouter.get(
  "/:postId",
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

export { marketplaceRouter };
