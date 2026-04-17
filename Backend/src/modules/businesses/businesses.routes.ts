import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  businessListQuerySchema,
  businessSlugParamSchema,
  createBusinessSchema,
  updateBusinessSchema
} from "./businesses.schema";
import { businessesController } from "./businesses.controller";

const businessesRouter = Router({ mergeParams: true });

businessesRouter.get(
  "/",
  validate({ query: businessListQuerySchema }),
  asyncHandler(businessesController.list)
);

businessesRouter.get(
  "/:businessSlug",
  validate({ params: businessSlugParamSchema }),
  asyncHandler(businessesController.getBySlug)
);

businessesRouter.post(
  "/",
  requireAuth,
  validate({ body: createBusinessSchema }),
  asyncHandler(businessesController.create)
);

businessesRouter.patch(
  "/:businessSlug",
  requireAuth,
  validate({ params: businessSlugParamSchema, body: updateBusinessSchema }),
  asyncHandler(businessesController.update)
);

businessesRouter.delete(
  "/:businessSlug",
  requireAuth,
  validate({ params: businessSlugParamSchema }),
  asyncHandler(businessesController.remove)
);

export { businessesRouter };
