import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireBarrioMember } from "../../middlewares/auth";
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
  requireBarrioMember,
  validate({ params: forumSubforumParamSchema, body: createThreadSchema }),
  asyncHandler(forumController.createThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies",
  requireAuth,
  requireBarrioMember,
  validate({ params: forumThreadParamSchema, body: createReplySchema }),
  asyncHandler(forumController.createReply)
);

// DELETE /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
forumRouter.delete(
  "/:subforumSlug/threads/:threadId",
  requireAuth,
  requireBarrioMember,
  validate({ params: forumThreadParamSchema }),
  asyncHandler(forumController.deleteThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/close
forumRouter.post(
  "/:subforumSlug/threads/:threadId/close",
  requireAuth,
  requireBarrioMember,
  validate({ params: forumThreadParamSchema }),
  asyncHandler(forumController.closeThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/vote
forumRouter.post(
  "/:subforumSlug/threads/:threadId/vote",
  requireAuth,
  requireBarrioMember,
  validate({ params: forumThreadParamSchema, body: voteSchema }),
  asyncHandler(forumController.voteThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies/:replyId/vote
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies/:replyId/vote",
  requireAuth,
  requireBarrioMember,
  validate({ params: replyIdParamSchema, body: voteSchema }),
  asyncHandler(forumController.voteReply)
);

export { forumRouter };
