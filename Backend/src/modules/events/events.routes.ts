import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireBarrioMember } from "../../middlewares/auth";
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
  requireAuth,
  requireBarrioMember,
  validate({ query: eventsListQuerySchema }),
  asyncHandler(eventsController.list)
);

eventsRouter.get(
  "/:eventId",
  requireAuth,
  requireBarrioMember,
  validate({ params: eventIdParamSchema }),
  asyncHandler(eventsController.getById)
);

eventsRouter.post(
  "/",
  requireAuth,
  requireBarrioMember,
  validate({ body: createEventSchema }),
  asyncHandler(eventsController.create)
);

eventsRouter.patch(
  "/:eventId",
  requireAuth,
  requireBarrioMember,
  validate({ params: eventIdParamSchema, body: updateEventSchema }),
  asyncHandler(eventsController.update)
);

eventsRouter.delete(
  "/:eventId",
  requireAuth,
  requireBarrioMember,
  validate({ params: eventIdParamSchema }),
  asyncHandler(eventsController.remove)
);

eventsRouter.post(
  "/:eventId/rsvp",
  requireAuth,
  requireBarrioMember,
  validate({ params: eventIdParamSchema, body: rsvpSchema }),
  asyncHandler(eventsController.rsvp)
);

export { eventsRouter };
