import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  forumListQuerySchema,
  forumSubforumParamSchema,
  forumThreadParamSchema,
  replyIdParamSchema,
  createThreadSchema,
  createReplySchema,
  voteSchema
} from "./forum.schema";
import { forumController } from "./forum.controller";

const forumRouter = Router({ mergeParams: true });

// GET /barrios/:barrioSlug/forum
forumRouter.get("/", asyncHandler(forumController.listSubforums));

// GET /barrios/:barrioSlug/forum/:subforumSlug/threads
forumRouter.get(
  "/:subforumSlug/threads",
  validate({ params: forumSubforumParamSchema, query: forumListQuerySchema }),
  asyncHandler(forumController.listThreads)
);

// GET /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
forumRouter.get(
  "/:subforumSlug/threads/:threadId",
  validate({ params: forumThreadParamSchema }),
  asyncHandler(forumController.getThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads
forumRouter.post(
  "/:subforumSlug/threads",
  requireAuth,
  validate({ params: forumSubforumParamSchema, body: createThreadSchema }),
  asyncHandler(forumController.createThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies",
  requireAuth,
  validate({ params: forumThreadParamSchema, body: createReplySchema }),
  asyncHandler(forumController.createReply)
);

// DELETE /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
forumRouter.delete(
  "/:subforumSlug/threads/:threadId",
  requireAuth,
  validate({ params: forumThreadParamSchema }),
  asyncHandler(forumController.deleteThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/vote
forumRouter.post(
  "/:subforumSlug/threads/:threadId/vote",
  requireAuth,
  validate({ params: forumThreadParamSchema, body: voteSchema }),
  asyncHandler(forumController.voteThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies/:replyId/vote
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies/:replyId/vote",
  requireAuth,
  validate({ params: replyIdParamSchema, body: voteSchema }),
  asyncHandler(forumController.voteReply)
);

export { forumRouter };
