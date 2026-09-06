import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireRole, requireBarrioMember } from "../../middlewares/auth";
import { newsListQuerySchema, createNewsSchema, updateNewsSchema, newsSlugParamSchema, newsVoteSchema } from "./news.schema";
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
  requireBarrioMember,
  validate({ body: createNewsSchema }),
  asyncHandler(newsController.create)
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

newsRouter.get(
  "/editorial/pending",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ query: newsListQuerySchema }),
  asyncHandler(newsController.listPending)
);

newsRouter.post(
  "/:newsSlug/approve",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ 
    params: newsSlugParamSchema,
    body: z.object({ aiSummary: z.any().optional() }).optional()
  }),
  asyncHandler(newsController.approve)
);

import { z } from "zod";
newsRouter.post(
  "/:newsSlug/reject",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ 
    params: newsSlugParamSchema, 
    body: z.object({ observation: z.string().min(5).max(1000) }) 
  }),
  asyncHandler(newsController.reject)
);

newsRouter.post(
  "/editorial/:newsSlug/summarize",
  requireAuth,
  requireRole(UserRole.EDITOR, UserRole.ADMIN),
  validate({ params: newsSlugParamSchema }),
  asyncHandler(newsController.summarize)
);

export { newsRouter };
