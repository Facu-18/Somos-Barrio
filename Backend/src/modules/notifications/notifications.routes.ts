import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { requireAuth } from "../../middlewares/auth";
import { notificationsService } from "./notifications.service";
import { z } from "zod";
import { validate } from "../../middlewares/validate";

const notificationsRouter = Router();

const registerSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["android", "ios", "web"])
});

notificationsRouter.post(
  "/register",
  requireAuth,
  validate({ body: registerSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, platform } = req.body;
    await notificationsService.registerDevice(req.user!.id, token, platform);
    res.json({ success: true, message: "Dispositivo registrado" });
  })
);

export { notificationsRouter };
