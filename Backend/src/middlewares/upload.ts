import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../lib/cloudinary";
import { ApiError } from "../utils/api-error";
import { env } from "../config/env";
import { sightengineProvider, SightengineProviderError } from "../modules/content-moderation/sightengine.provider";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MARKETPLACE_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const detectImageMime = (buffer: Buffer): string | null => {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (isJpeg) return "image/jpeg";
  if (isPng) return "image/png";
  if (isGif) return "image/gif";
  if (isWebp) return "image/webp";
  return null;
};

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

const marketplaceMulterMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/gif") return cb(new ApiError(422, "GIF no está permitido en marketplace."));
    if (!MARKETPLACE_ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new ApiError(422, "Formato no soportado. Usá JPG, PNG o WebP."));
    }
    cb(null, true);
  }
});

export const uploadMarketplaceSingle = marketplaceMulterMiddleware.single("file");

export const verifyImageContent = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.file) return next(new ApiError(400, "No se encontro ningun archivo"));
  if (!detectImageMime(req.file.buffer)) {
    return next(new ApiError(422, "El contenido del archivo no es una imagen valida"));
  }
  next();
};

export const verifyMarketplaceImageContent = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.file) return next(new ApiError(400, "No se encontro ningun archivo"));
  const detectedMime = detectImageMime(req.file.buffer);
  if (detectedMime === "image/gif") return next(new ApiError(422, "GIF no está permitido en marketplace."));
  if (!detectedMime || detectedMime !== req.file.mimetype || !MARKETPLACE_ALLOWED_MIME.includes(detectedMime)) {
    return next(new ApiError(422, "El tipo declarado no coincide con una imagen JPG, PNG o WebP válida."));
  }
  next();
};

export const moderateImageContent = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.file) return next(new ApiError(400, "No se encontro ningun archivo"));

  if (!env.SIGHTENGINE_ENABLED) return next();

  try {
    const scan = await sightengineProvider.scan(req.file.buffer, req.file.mimetype, req.file.originalname);
    const blocked = Object.entries(scan.scores).some(([category, score]) =>
      score >= env.SIGHTENGINE_THRESHOLDS[category as keyof typeof scan.scores].block
    );
    if (blocked) {
      return next(new ApiError(422, "La imagen fue rechazada por nuestro sistema de moderación automatizado."));
    }
    next();
  } catch (error: unknown) {
    const providerError = error instanceof SightengineProviderError
      ? error
      : new SightengineProviderError(502, "PROVIDER_UNAVAILABLE");
    next(new ApiError(providerError.statusCode, "No pudimos verificar la imagen. Intentá nuevamente más tarde."));
  }
};

export const uploadToCloudinary = (folder: string | ((req: Request) => string) = "somos-barrio") =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) return next(new ApiError(400, "No se encontro ningun archivo"));

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: typeof folder === "function" ? folder(req) : folder, resource_type: "image", allowed_formats: ["jpg", "png", "webp", "gif"] },
          (err, result) => {
            if (err || !result) reject(err ?? new Error("Cloudinary no devolvió resultado"));
            else resolve(result);
          }
        );
        stream.end(req.file!.buffer);
      });

      (req as Request & { cloudinaryUrl: string }).cloudinaryUrl = result.secure_url;
      (req as Request & { cloudinaryPublicId: string }).cloudinaryPublicId = result.public_id;
      next();
    } catch {
      next(new ApiError(502, "Error subiendo imagen a Cloudinary"));
    }
  };
