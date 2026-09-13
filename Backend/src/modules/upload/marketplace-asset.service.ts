import { createHash } from "node:crypto";
import { MarketplaceAssetStatus, Prisma } from "@prisma/client";
import { UploadApiResponse } from "cloudinary";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import { sightengineProvider, SightengineProviderError, SightengineScores } from "../content-moderation/sightengine.provider";

const publicAssetSelect = {
  id: true,
  status: true,
  url: true,
  createdAt: true,
  scannedAt: true
} satisfies Prisma.MarketplaceAssetSelect;

export function classifyVisualScores(scores: SightengineScores): MarketplaceAssetStatus {
  if (Object.entries(scores).some(([category, score]) => score >= env.SIGHTENGINE_THRESHOLDS[category as keyof SightengineScores].block)) {
    return MarketplaceAssetStatus.REJECTED;
  }
  if (Object.entries(scores).some(([category, score]) => score >= env.SIGHTENGINE_THRESHOLDS[category as keyof SightengineScores].review)) {
    return MarketplaceAssetStatus.QUARANTINED;
  }
  return MarketplaceAssetStatus.APPROVED;
}

type CloudinaryType = "upload" | "authenticated";

function uploadStoredAsset(buffer: Buffer, userId: string, assetId: string, type: CloudinaryType): Promise<UploadApiResponse> {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ApiError(503, "El almacenamiento de imágenes no está disponible.");
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `somos-barrio/marketplace/${userId}/${assetId}`,
      public_id: "asset",
      type,
      resource_type: "image",
      allowed_formats: ["jpg", "png", "webp"]
    }, (error, result) => error || !result ? reject(error ?? new Error("missing upload result")) : resolve(result));
    stream.end(buffer);
  });
}

async function destroyClaimedAsset(asset: { id: string; cloudinaryPublicId: string | null; cloudinaryType: string | null }): Promise<boolean> {
  try {
    if (asset.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(asset.cloudinaryPublicId, {
        resource_type: "image",
        type: asset.cloudinaryType ?? "upload",
        invalidate: true
      });
    }
    const deleted = await prisma.marketplaceAsset.deleteMany({
      where: { id: asset.id, postId: null, status: MarketplaceAssetStatus.DELETE_PENDING }
    });
    return deleted.count === 1;
  } catch {
    await prisma.marketplaceAsset.updateMany({
      where: { id: asset.id, postId: null, status: MarketplaceAssetStatus.DELETE_PENDING },
      data: { deletionRequestedAt: new Date(), deletionAttempts: { increment: 1 } }
    }).catch(() => undefined);
    logger.warn({ assetId: asset.id, provider: "cloudinary" }, "No se pudo eliminar un asset de marketplace; queda pendiente para reintento");
    return false;
  }
}

export const marketplaceAssetService = {
  async create(userId: string, file: Express.Multer.File) {
    const asset = await prisma.marketplaceAsset.create({
      data: {
        uploaderId: userId,
        mimeType: file.mimetype,
        byteSize: file.size,
        contentHash: createHash("sha256").update(file.buffer).digest("hex")
      }
    });

    let scan;
    try {
      scan = await sightengineProvider.scan(file.buffer, file.mimetype, file.originalname);
    } catch (error) {
      const providerError = error instanceof SightengineProviderError
        ? error
        : new SightengineProviderError(502, "PROVIDER_UNAVAILABLE");
      let stored: UploadApiResponse | undefined;
      try {
        stored = await uploadStoredAsset(file.buffer, userId, asset.id, "authenticated");
        await prisma.marketplaceAsset.update({
          where: { id: asset.id },
          data: {
            providerRequestId: providerError.requestId,
            scannedAt: new Date(),
            cloudinaryPublicId: stored.public_id,
            cloudinaryType: "authenticated",
            url: null
          }
        });
      } catch {
        if (stored?.public_id) {
          await cloudinary.uploader.destroy(stored.public_id, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => undefined);
        }
        await prisma.marketplaceAsset.update({
          where: { id: asset.id },
          data: { providerRequestId: providerError.requestId, scannedAt: new Date() }
        });
        logger.warn({ assetId: asset.id, provider: "cloudinary" }, "No se pudo conservar un asset en cuarentena privada");
      }
      throw new ApiError(providerError.statusCode, "No pudimos verificar la imagen. Intentá nuevamente más tarde.", {
        assetId: asset.id,
        status: MarketplaceAssetStatus.QUARANTINED,
        code: providerError.code
      });
    }

    const ocrModeration = contentModerationService.evaluate(scan.ocrText, "MARKETPLACE");
    const visualStatus = classifyVisualScores(scan.scores);
    const status = ocrModeration.decision === "BLOCK"
      ? MarketplaceAssetStatus.REJECTED
      : ocrModeration.decision === "REVIEW" && visualStatus === MarketplaceAssetStatus.APPROVED
        ? MarketplaceAssetStatus.QUARANTINED
        : visualStatus;
    const moderationData = {
      status,
      provider: scan.provider,
      providerRequestId: scan.requestId,
      scores: scan.scores,
      ocrDecision: ocrModeration.decision,
      ocrCategories: ocrModeration.categories,
      ocrRuleId: ocrModeration.ruleId,
      ocrRuleVersion: ocrModeration.ruleVersion,
      ocrPolicyVersion: ocrModeration.policyVersion,
      ocrContentHash: ocrModeration.contentHash,
      scannedAt: new Date()
    } satisfies Prisma.MarketplaceAssetUpdateInput;

    if (status !== MarketplaceAssetStatus.APPROVED) {
      if (status === MarketplaceAssetStatus.REJECTED) {
        return prisma.marketplaceAsset.update({ where: { id: asset.id }, data: moderationData, select: publicAssetSelect });
      }
      let stored: UploadApiResponse | undefined;
      try {
        stored = await uploadStoredAsset(file.buffer, userId, asset.id, "authenticated");
        return await prisma.marketplaceAsset.update({
          where: { id: asset.id },
          data: { ...moderationData, cloudinaryPublicId: stored.public_id, cloudinaryType: "authenticated", url: null },
          select: publicAssetSelect
        });
      } catch {
        if (stored?.public_id) {
          await cloudinary.uploader.destroy(stored.public_id, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => undefined);
        }
        await prisma.marketplaceAsset.update({ where: { id: asset.id }, data: moderationData });
        logger.warn({ assetId: asset.id, provider: "cloudinary" }, "Falló el almacenamiento privado de un asset en cuarentena");
        throw new ApiError(502, "No pudimos conservar la imagen en revisión. Intentá nuevamente más tarde.");
      }
    }

    let uploaded: UploadApiResponse | undefined;
    try {
      uploaded = await uploadStoredAsset(file.buffer, userId, asset.id, "upload");
      return await prisma.marketplaceAsset.update({
        where: { id: asset.id },
        data: { ...moderationData, cloudinaryPublicId: uploaded.public_id, cloudinaryType: "upload", url: uploaded.secure_url },
        select: publicAssetSelect
      });
    } catch (error) {
      if (uploaded?.public_id) {
        await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "image", invalidate: true }).catch(() => undefined);
      }
      await prisma.marketplaceAsset.update({
        where: { id: asset.id },
        data: { ...moderationData, status: MarketplaceAssetStatus.QUARANTINED, cloudinaryPublicId: null, cloudinaryType: null, url: null }
      });
      if (error instanceof ApiError) throw error;
      logger.warn({ assetId: asset.id, provider: "cloudinary" }, "Falló la publicación de un asset aprobado");
      throw new ApiError(502, "No pudimos almacenar la imagen. Intentá nuevamente más tarde.");
    }
  },

  async cleanupAssetsById(assetIds: string[]): Promise<{ deleted: number; pending: number }> {
    if (assetIds.length === 0) return { deleted: 0, pending: 0 };
    await prisma.marketplaceAsset.updateMany({
      where: {
        id: { in: assetIds },
        postId: null,
        status: { in: [MarketplaceAssetStatus.APPROVED, MarketplaceAssetStatus.QUARANTINED, MarketplaceAssetStatus.REJECTED] }
      },
      data: { status: MarketplaceAssetStatus.DELETE_PENDING, url: null, deletionRequestedAt: new Date() }
    });
    const assets = await prisma.marketplaceAsset.findMany({
      where: { id: { in: assetIds }, postId: null, status: MarketplaceAssetStatus.DELETE_PENDING },
      select: { id: true, cloudinaryPublicId: true, cloudinaryType: true }
    });
    const results = await Promise.all(assets.map(destroyClaimedAsset));
    const deleted = results.filter(Boolean).length;
    return { deleted, pending: results.length - deleted };
  },

  async cleanupOrphanAssets(olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    const assets = await prisma.marketplaceAsset.findMany({
      where: {
        postId: null,
        OR: [{ createdAt: { lt: olderThan } }, { status: MarketplaceAssetStatus.DELETE_PENDING }]
      },
      select: { id: true }
    });
    return marketplaceAssetService.cleanupAssetsById(assets.map((asset) => asset.id));
  }
};
