import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  eventsListQuerySchema,
  eventIdParamSchema,
  createEventSchema,
  updateEventSchema,
  rsvpSchema
} from "./events.schema";
import { eventsController } from "./events.controller";

const eventsRouter = Router({ mergeParams: true });

eventsRouter.get(
  "/",
  validate({ query: eventsListQuerySchema }),
  asyncHandler(eventsController.list)
);

eventsRouter.get(
  "/:eventId",
  validate({ params: eventIdParamSchema }),
  asyncHandler(eventsController.getById)
);

eventsRouter.post(
  "/",
  requireAuth,
  validate({ body: createEventSchema }),
  asyncHandler(eventsController.create)
);

eventsRouter.patch(
  "/:eventId",
  requireAuth,
  validate({ params: eventIdParamSchema, body: updateEventSchema }),
  asyncHandler(eventsController.update)
);

eventsRouter.delete(
  "/:eventId",
  requireAuth,
  validate({ params: eventIdParamSchema }),
  asyncHandler(eventsController.remove)
);

eventsRouter.post(
  "/:eventId/rsvp",
  requireAuth,
  validate({ params: eventIdParamSchema, body: rsvpSchema }),
  asyncHandler(eventsController.rsvp)
);

export { eventsRouter };
