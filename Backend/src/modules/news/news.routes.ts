import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole, requireBarrioMember } from "../../middlewares/auth";
import {
  approveNewsSchema,
  createNewsSchema,
  newsAssistSchema,
  newsListQuerySchema,
  newsSlugParamSchema,
  newsVoteSchema,
  rejectNewsSchema,
  updateNewsSchema
} from "./news.schema";
import { newsController } from "./news.controller";

const newsRouter = Router({ mergeParams: true });

newsRouter.get(
  "/",
  validate({ query: newsListQuerySchema }),
  asyncHandler(newsController.list)
);

newsRouter.get(
  "/mine",
  requireAuth,
  requireBarrioMember,
  validate({ query: newsListQuerySchema }),
  asyncHandler(newsController.listMine)
);

newsRouter.get(
  "/manage/:newsSlug",
  requireAuth,
  requireBarrioMember,
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.getManagedBySlug)
);

newsRouter.get(
  "/editorial/pending",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ query: newsListQuerySchema }),
  asyncHandler(newsController.listPending)
);

newsRouter.get(
  "/:newsSlug",
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.getBySlug)
);

newsRouter.post(
  "/",
  requireAuth,
  requireBarrioMember,
  validate({ body: createNewsSchema }),
  asyncHandler(newsController.create)
);

newsRouter.post(
  "/assist",
  requireAuth,
  requireBarrioMember,
  validate({ body: newsAssistSchema }),
  asyncHandler(newsController.assist)
);

newsRouter.patch(
  "/:newsSlug",
  requireAuth,
  requireBarrioMember,
  validate({ params: newsSlugParamSchema, body: updateNewsSchema }),
  asyncHandler(newsController.update)
);

newsRouter.delete(
  "/:newsSlug",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.remove)
);

newsRouter.post(
  "/:newsSlug/vote",
  requireAuth,
  requireBarrioMember,
  validate({ params: newsSlugParamSchema, body: newsVoteSchema }),
  asyncHandler(newsController.vote)
);

newsRouter.get(
  "/:newsSlug/votes",
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.getVotes)
);

newsRouter.post(
  "/:newsSlug/approve",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ params: newsSlugParamSchema, body: approveNewsSchema }),
  asyncHandler(newsController.approve)
);

newsRouter.post(
  "/:newsSlug/reject",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ params: newsSlugParamSchema, body: rejectNewsSchema }),
  asyncHandler(newsController.reject)
);

newsRouter.post(
  "/editorial/:newsSlug/summarize",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.summarize)
);

newsRouter.post(
  "/editorial/:newsSlug/improve",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  requireBarrioMember,
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.improve)
);

export { newsRouter };
