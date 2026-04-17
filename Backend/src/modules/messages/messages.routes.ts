import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { messageIdParamSchema, messagesListQuerySchema, sendMessageSchema } from "./messages.schema";
import { messagesController } from "./messages.controller";

const messagesRouter = Router();

messagesRouter.get(
  "/",
  requireAuth,
  validate({ query: messagesListQuerySchema }),
  asyncHandler(messagesController.list)
);

messagesRouter.post(
  "/",
  requireAuth,
  validate({ body: sendMessageSchema }),
  asyncHandler(messagesController.send)
);

messagesRouter.patch(
  "/:messageId/read",
  requireAuth,
  validate({ params: messageIdParamSchema }),
  asyncHandler(messagesController.markRead)
);

export { messagesRouter };
