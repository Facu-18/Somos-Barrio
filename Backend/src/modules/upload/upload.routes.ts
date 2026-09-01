import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { uploadSingle, uploadToCloudinary, verifyImageContent } from "../../middlewares/upload";
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
  uploadToCloudinary("somos-barrio"),
  uploadController.uploadImage
);

export { uploadRouter };
