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
  moderationVersion: true,
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
    const reviewDecisions = await prisma.marketplaceAssetModerationDecision.count({ where: { assetId: asset.id } });
    if (reviewDecisions > 0) {
      const retained = await prisma.marketplaceAsset.updateMany({
        where: { id: asset.id, postId: null, status: MarketplaceAssetStatus.DELETE_PENDING },
        data: { cloudinaryPublicId: null, cloudinaryType: null, deletionRequestedAt: null }
      });
      return retained.count === 1;
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
  getSignedUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + env.MARKETPLACE_ASSET_REVIEW_URL_TTL_SECONDS
    });
  },

  async promoteToPublic(publicId: string): Promise<{ public_id: string; secure_url: string }> {
    try {
      return await cloudinary.uploader.rename(publicId, publicId, {
        type: "authenticated",
        to_type: "upload",
        invalidate: true
      }) as { public_id: string; secure_url: string };
    } catch (error) {
      // A retry after a successful rename must recognize the already-public resource.
      try {
        return await cloudinary.api.resource(publicId, { type: "upload", resource_type: "image" }) as {
          public_id: string;
          secure_url: string;
        };
      } catch {
        throw error;
      }
    }
  },

  async reconcileReviewAsset(assetId: string) {
    const asset = await prisma.marketplaceAsset.findUnique({ where: { id: assetId } });
    if (!asset) return null;
    if (asset.status === MarketplaceAssetStatus.APPROVED || asset.status === MarketplaceAssetStatus.REJECTED) {
      return prisma.marketplaceAsset.findUnique({ where: { id: assetId }, select: publicAssetSelect });
    }

    try {
      if (asset.status === MarketplaceAssetStatus.PROMOTION_PENDING) {
        if (!asset.cloudinaryPublicId || asset.cloudinaryType !== "authenticated") {
          throw new Error("missing authenticated resource");
        }
        const promoted = await marketplaceAssetService.promoteToPublic(asset.cloudinaryPublicId);
        await prisma.marketplaceAsset.updateMany({
          where: { id: assetId, status: MarketplaceAssetStatus.PROMOTION_PENDING },
          data: {
            status: MarketplaceAssetStatus.APPROVED,
            cloudinaryPublicId: promoted.public_id,
            cloudinaryType: "upload",
            url: promoted.secure_url
          }
        });
      } else if (asset.status === MarketplaceAssetStatus.REJECTION_PENDING) {
        if (asset.cloudinaryPublicId) {
          await cloudinary.uploader.destroy(asset.cloudinaryPublicId, {
            resource_type: "image",
            type: asset.cloudinaryType ?? "authenticated",
            invalidate: true
          });
        }
        await prisma.marketplaceAsset.updateMany({
          where: { id: assetId, status: MarketplaceAssetStatus.REJECTION_PENDING },
          data: {
            status: MarketplaceAssetStatus.REJECTED,
            cloudinaryPublicId: null,
            cloudinaryType: null,
            url: null
          }
        });
      } else {
        return null;
      }
      return prisma.marketplaceAsset.findUnique({ where: { id: assetId }, select: publicAssetSelect });
    } catch {
      logger.warn({ assetId, provider: "cloudinary", status: asset.status }, "La decisión de asset quedó pendiente de reconciliación");
      return null;
    }
  },

  async reconcilePendingReviews(): Promise<{ completed: number; pending: number }> {
    const assets = await prisma.marketplaceAsset.findMany({
      where: { status: { in: [MarketplaceAssetStatus.PROMOTION_PENDING, MarketplaceAssetStatus.REJECTION_PENDING] } },
      select: { id: true }
    });
    const results = await Promise.all(assets.map((asset) => marketplaceAssetService.reconcileReviewAsset(asset.id)));
    const completed = results.filter(Boolean).length;
    return { completed, pending: results.length - completed };
  },

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

  async cleanupOrphanAssets(
    olderThan = new Date(Date.now() - env.MARKETPLACE_ASSET_ORPHAN_TTL_MS),
    reviewOlderThan = new Date(Date.now() - env.MARKETPLACE_ASSET_REVIEW_TTL_MS)
  ) {
    const assets = await prisma.marketplaceAsset.findMany({
      where: {
        postId: null,
        OR: [
          { status: MarketplaceAssetStatus.DELETE_PENDING, deletionRequestedAt: { not: null } },
          { status: MarketplaceAssetStatus.QUARANTINED, createdAt: { lt: reviewOlderThan } },
          { status: { in: [MarketplaceAssetStatus.APPROVED, MarketplaceAssetStatus.REJECTED] }, createdAt: { lt: olderThan } }
        ]
      },
      select: { id: true }
    });
    return marketplaceAssetService.cleanupAssetsById(assets.map((asset) => asset.id));
  }
};
