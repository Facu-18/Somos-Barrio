import { Request, Response, Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/async-handler";
import { deviceSchema, unregisterDeviceSchema } from "./notifications.schema";
import { notificationsService } from "./notifications.service";
import { deviceCleanupRateLimiter } from "../../middlewares/rate-limit";

const notificationsRouter = Router();

notificationsRouter.post(
  "/register",
  requireAuth,
  validate({ body: deviceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.registerDevice(req.user!.id, req.body.token, req.body.platform);
    res.json({ success: true, data: { message: "Dispositivo registrado" } });
  })
);

notificationsRouter.delete(
  "/register",
  requireAuth,
  validate({ body: unregisterDeviceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.unregisterDevice(req.user!.id, req.body.token);
    res.status(204).send();
  })
);

notificationsRouter.post(
  "/unregister",
  deviceCleanupRateLimiter,
  validate({ body: unregisterDeviceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.unregisterDeviceByToken(req.body.token);
    res.status(204).send();
  })
);

export { notificationsRouter };
