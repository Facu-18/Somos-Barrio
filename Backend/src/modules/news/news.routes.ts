import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { newsListQuerySchema, createNewsSchema, updateNewsSchema, newsSlugParamSchema } from "./news.schema";
import { newsController } from "./news.controller";

const newsRouter = Router({ mergeParams: true });

newsRouter.get(
  "/",
  validate({ query: newsListQuerySchema }),
  asyncHandler(newsController.list)
);

newsRouter.get(
  "/:newsSlug",
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.getBySlug)
);

newsRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ body: createNewsSchema }),
  asyncHandler(newsController.create)
);

newsRouter.patch(
  "/:newsSlug",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ params: newsSlugParamSchema, body: updateNewsSchema }),
  asyncHandler(newsController.update)
);

newsRouter.delete(
  "/:newsSlug",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.remove)
);

export { newsRouter };
