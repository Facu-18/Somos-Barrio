import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middlewares/validate";
import { authRateLimiter } from "../../middlewares/rate-limit";
import { requireAuth } from "../../middlewares/auth";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schema";

const authRouter = Router();

authRouter.post("/register", authRateLimiter, validate({ body: registerSchema }), asyncHandler(authController.register));
authRouter.post("/login",    authRateLimiter, validate({ body: loginSchema }),    asyncHandler(authController.login));
authRouter.post("/refresh",  authRateLimiter, asyncHandler(authController.refresh));
authRouter.post("/logout",   requireAuth,     asyncHandler(authController.logout));
authRouter.get("/me",        requireAuth,     authController.me);

export { authRouter };
