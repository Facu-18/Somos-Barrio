import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { optionalAuth, requireAuth, requireBarrioMember } from "../../middlewares/auth";
import {
  forumAppealRateLimiter,
  forumEditRateLimiter,
  forumIpRateLimiter,
  forumReplyRateLimiter,
  forumReportRateLimiter,
  forumThreadRateLimiter
} from "../../middlewares/rate-limit";
import {
  forumListQuerySchema,
  forumSubforumParamSchema,
  forumThreadParamSchema,
  replyIdParamSchema,
  createThreadSchema,
  updateThreadSchema,
  createReplySchema,
  updateReplySchema,
  voteSchema,
  createForumReportSchema,
  createForumAppealSchema
} from "./forum.schema";
import { forumController } from "./forum.controller";

const forumRouter = Router({ mergeParams: true });

// GET /barrios/:barrioSlug/forum
forumRouter.get("/", asyncHandler(forumController.listSubforums));

// GET /barrios/:barrioSlug/forum/:subforumSlug/threads
forumRouter.get(
  "/:subforumSlug/threads",
  optionalAuth,
  validate({ params: forumSubforumParamSchema, query: forumListQuerySchema }),
  asyncHandler(forumController.listThreads)
);

// GET /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
forumRouter.get(
  "/:subforumSlug/threads/:threadId",
  optionalAuth,
  validate({ params: forumThreadParamSchema }),
  asyncHandler(forumController.getThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads
forumRouter.post(
  "/:subforumSlug/threads",
  requireAuth,
  requireBarrioMember,
  forumIpRateLimiter,
  forumThreadRateLimiter,
  validate({ params: forumSubforumParamSchema, body: createThreadSchema }),
  asyncHandler(forumController.createThread)
);

// PATCH /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId
forumRouter.patch(
  "/:subforumSlug/threads/:threadId",
  requireAuth,
  requireBarrioMember,
  forumIpRateLimiter,
  forumEditRateLimiter,
  validate({ params: forumThreadParamSchema, body: updateThreadSchema }),
  asyncHandler(forumController.updateThread)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies",
  requireAuth,
  requireBarrioMember,
  forumIpRateLimiter,
  forumReplyRateLimiter,
  validate({ params: forumThreadParamSchema, body: createReplySchema }),
  asyncHandler(forumController.createReply)
);

// PATCH /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies/:replyId
forumRouter.patch(
  "/:subforumSlug/threads/:threadId/replies/:replyId",
  requireAuth,
  requireBarrioMember,
  forumIpRateLimiter,
  forumEditRateLimiter,
  validate({ params: replyIdParamSchema, body: updateReplySchema }),
  asyncHandler(forumController.updateReply)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/reports
forumRouter.post(
  "/:subforumSlug/threads/:threadId/reports",
  requireAuth,
  requireBarrioMember,
  forumReportRateLimiter,
  validate({ params: forumThreadParamSchema, body: createForumReportSchema }),
  asyncHandler(forumController.report)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies/:replyId/reports
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies/:replyId/reports",
  requireAuth,
  requireBarrioMember,
  forumReportRateLimiter,
  validate({ params: replyIdParamSchema, body: createForumReportSchema }),
  asyncHandler(forumController.report)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/appeals
forumRouter.post(
  "/:subforumSlug/threads/:threadId/appeals",
  requireAuth,
  requireBarrioMember,
  forumAppealRateLimiter,
  validate({ params: forumThreadParamSchema, body: createForumAppealSchema }),
  asyncHandler(forumController.appeal)
);

// POST /barrios/:barrioSlug/forum/:subforumSlug/threads/:threadId/replies/:replyId/appeals
forumRouter.post(
  "/:subforumSlug/threads/:threadId/replies/:replyId/appeals",
  requireAuth,
  requireBarrioMember,
  forumAppealRateLimiter,
  validate({ params: replyIdParamSchema, body: createForumAppealSchema }),
  asyncHandler(forumController.appeal)
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
