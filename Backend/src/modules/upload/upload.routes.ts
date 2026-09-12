import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { uploadSingle, uploadToCloudinary, verifyImageContent, moderateImageContent } from "../../middlewares/upload";
import { uploadRateLimiter } from "../../middlewares/rate-limit";
import { uploadController } from "./upload.controller";

const uploadRouter = Router();

/**
 * POST /api/v1/upload
 * Body: multipart/form-data, campo "file" (imagen)
 * Requiere autenticación.
 * Devuelve { success, data: { url, publicId } }
 */
uploadRouter.post(
  "/",
  requireAuth,
  uploadRateLimiter,
  uploadSingle,
  verifyImageContent,
  moderateImageContent,
  uploadToCloudinary("somos-barrio"),
  uploadController.uploadImage
);

uploadRouter.post(
  "/avatar",
  requireAuth,
  uploadRateLimiter,
  uploadSingle,
  verifyImageContent,
  moderateImageContent,
  uploadToCloudinary((req) => `somos-barrio/avatars/${req.user!.id}`),
  uploadController.uploadImage
);

export { uploadRouter };
