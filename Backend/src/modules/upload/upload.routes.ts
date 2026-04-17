import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { uploadSingle, uploadToCloudinary } from "../../middlewares/upload";
import { uploadController } from "./upload.controller";

const uploadRouter = Router();

/**
 * POST /api/v1/upload
 * Body: multipart/form-data, campo "file" (imagen)
 * Query: ?folder=somos-barrio/news  (opcional)
 * Requiere autenticación.
 * Devuelve { url, publicId }
 */
uploadRouter.post(
  "/",
  requireAuth,
  uploadSingle,
  uploadToCloudinary("somos-barrio"),
  uploadController.uploadImage
);

export { uploadRouter };
