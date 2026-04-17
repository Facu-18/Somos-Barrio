import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../lib/cloudinary";
import { ApiError } from "../utils/api-error";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const multerMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(422, "Formato no soportado. Usá JPG, PNG, WebP o GIF."));
    }
  },
});

export const uploadSingle = multerMiddleware.single("file");

export const uploadToCloudinary = (folder = "somos-barrio") =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) return next(new ApiError(400, "No se encontró ningún archivo"));

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", allowed_formats: ["jpg", "png", "webp", "gif"] },
          (err, result) => {
            if (err || !result) reject(err ?? new Error("Cloudinary no devolvió resultado"));
            else resolve(result);
          }
        );
        stream.end(req.file!.buffer);
      });

      // Adjuntar URL al request para que el controller lo use
      (req as Request & { cloudinaryUrl: string }).cloudinaryUrl = result.secure_url;
      (req as Request & { cloudinaryPublicId: string }).cloudinaryPublicId = result.public_id;
      next();
    } catch {
      next(new ApiError(502, "Error subiendo imagen a Cloudinary"));
    }
  };
