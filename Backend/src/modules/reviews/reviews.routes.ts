import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireBarrioMember } from "../../middlewares/auth";
import { reviewParamSchema, createReviewSchema } from "./reviews.schema";
import { reviewsController } from "./reviews.controller";

const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.get(
  "/",
  validate({ params: reviewParamSchema }),
  asyncHandler(reviewsController.list)
);

reviewsRouter.post(
  "/",
  requireAuth,
  requireBarrioMember,
  validate({ params: reviewParamSchema, body: createReviewSchema }),
  asyncHandler(reviewsController.create)
);

export { reviewsRouter };
