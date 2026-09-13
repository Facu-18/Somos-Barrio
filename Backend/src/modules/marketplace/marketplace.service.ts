import { MarketplaceAssetStatus, MarketplaceAvailability, ModerationStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import { marketplaceAssetService } from "../upload/marketplace-asset.service";
import { logger } from "../../config/logger";

type CreatePostInput = {
  title: string;
  description: string;
  price?: number;
  currency: string;
  category: string;
  assetIds: string[];
  location?: string;
  whatsapp: string;
};

type UpdatePostInput = Partial<{
  title: string;
  description: string;
  price: number;
  category: string;
  availability: MarketplaceAvailability;
  assetIds: string[];
  location: string;
  whatsapp: string;
}>;

const userSelect = { id: true, nickname: true, avatarUrl: true };
const assetSelect = { id: true, url: true };

export function presentMarketplacePost<T extends { images: string[]; legacyImages?: string[]; assets: { id: string; url: string | null }[] }>(post: T) {
  const { assets, images: _legacyImages, legacyImages: _restrictedLegacyImages, ...rest } = post;
  return {
    ...rest,
    images: assets.flatMap((asset) => asset.url ? [asset.url] : []),
    assetIds: assets.map((asset) => asset.id)
  };
}

async function attachAssets(
  tx: Prisma.TransactionClient,
  uploaderId: string,
  postId: string,
  assetIds: string[]
) {
  if (assetIds.length === 0) return;
  const assets = await tx.marketplaceAsset.findMany({ where: { id: { in: assetIds } } });
  const valid = assets.length === assetIds.length && assets.every((asset) =>
    asset.uploaderId === uploaderId &&
    asset.status === MarketplaceAssetStatus.APPROVED &&
    Boolean(asset.url && asset.cloudinaryPublicId) &&
    (asset.postId === null || asset.postId === postId)
  );
  if (!valid) throw new ApiError(400, "Los assets deben estar aprobados, pertenecer al autor y no estar adjuntos a otra publicación");

  const attached = await tx.marketplaceAsset.updateMany({
    where: {
      id: { in: assetIds }, uploaderId, status: MarketplaceAssetStatus.APPROVED,
      OR: [{ postId: null }, { postId }]
    },
    data: { postId, deletionRequestedAt: null }
  });
  if (attached.count !== assetIds.length) throw new ApiError(409, "Alguno de los assets ya fue utilizado");
}

function normalizeWhatsapp(value: string): string {
  const trimmed = value.trim();
  if (/[A-Za-z]/.test(trimmed)) throw new ApiError(400, "Numero de WhatsApp invalido");
  const digits = (trimmed.startsWith("00") ? trimmed.slice(2) : trimmed).replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new ApiError(400, "Numero de WhatsApp invalido");
  return `+${digits}`;
}

async function resolveBarrio(barrioSlug: string) {
  const barrio = await prisma.barrio.findUnique({ where: { slug: barrioSlug } });
  if (!barrio) throw new ApiError(404, "Barrio no encontrado");
  return barrio;
}

function contentForModeration(post: { title: string; description: string; category: string; location?: string | null }) {
  return [post.title, post.description, post.category, post.location].filter(Boolean).join("\n");
}

function initialModerationStatus(decision: "ALLOW" | "REVIEW" | "BLOCK") {
  if (decision === "BLOCK") return ModerationStatus.REJECTED;
  if (decision === "REVIEW") return ModerationStatus.PENDING_REVIEW;
  return ModerationStatus.APPROVED;
}

export const marketplaceService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      availability: MarketplaceAvailability.AVAILABLE,
      moderationStatus: ModerationStatus.APPROVED,
      ...(opts.category ? { category: opts.category as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          category: true,
          availability: true,
          moderationStatus: true,
          moderationReasonCode: true,
          images: true,
          assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          location: true,
          views: true,
          createdAt: true,
          user: { select: userSelect }
        }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items: items.map(presentMarketplacePost), total, page: opts.page, limit: opts.limit };
  },

  async listMe(barrioSlug: string, userId: string, opts: { page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      userId
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: userSelect }, assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items: items.map(presentMarketplacePost), total, page: opts.page, limit: opts.limit };
  },

  async getById(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id },
      include: { user: { select: userSelect }, assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
    });

    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    const isOwnerOrModerator =
      post.userId === requesterId ||
      requesterRole === UserRole.EDITOR ||
      requesterRole === UserRole.ADMIN;
    
    // Si no es el dueño ni un admin, la publicación debe estar aprobada y disponible.
    if (!isOwnerOrModerator) {
      if (post.availability !== MarketplaceAvailability.AVAILABLE || post.moderationStatus !== ModerationStatus.APPROVED) {
        throw new ApiError(404, "Publicacion no encontrada");
      }
    }

    const updated = await prisma.marketplacePost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
      include: { user: { select: userSelect }, assets: { select: assetSelect, orderBy: { createdAt: "asc" } } }
    });
    return presentMarketplacePost(updated);
  },

  async create(barrioSlug: string, userId: string, input: CreatePostInput) {
    const barrio = await resolveBarrio(barrioSlug);

    const { assetIds, ...postInput } = input;
    const moderationResult = contentModerationService.evaluate(contentForModeration(input), 'MARKETPLACE');
    const modStatus = initialModerationStatus(moderationResult.decision);
    const moderationReasonCode = moderationResult.categories[0] ?? null;

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.marketplacePost.create({
        data: {
          ...postInput,
          images: [],
          category: input.category as any,
          whatsapp: normalizeWhatsapp(input.whatsapp),
          userId,
          barrioId: barrio.id,
          moderationStatus: modStatus,
          moderationReasonCode,
          decisions: {
            create: {
              status: modStatus,
              reason: moderationReasonCode ?? "Automated approval",
              ruleId: moderationResult.ruleId,
              ruleVersion: moderationResult.ruleVersion,
              policyVersion: moderationResult.policyVersion,
              domain: moderationResult.domain,
              severity: moderationResult.severity,
              contentHash: moderationResult.contentHash,
              categories: moderationResult.categories
            }
          }
        },
        include: { user: { select: userSelect } }
      });
      await attachAssets(tx, userId, created.id, assetIds);
      return tx.marketplacePost.findUniqueOrThrow({
        where: { id: created.id },
        include: { user: { select: userSelect }, assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return presentMarketplacePost(post);
  },

  async update(
    barrioSlug: string,
    postId: string,
    requesterId: string,
    requesterRole: UserRole,
    input: UpdatePostInput
  ) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id },
      include: { assets: { select: { id: true, url: true, cloudinaryPublicId: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para editar esta publicacion");
    }

    const materialChanged =
      (input.title !== undefined && input.title !== post.title) ||
      (input.description !== undefined && input.description !== post.description) ||
      (input.price !== undefined && input.price !== post.price) ||
      (input.category !== undefined && input.category !== post.category) ||
      (input.location !== undefined && input.location !== post.location) ||
      (input.assetIds !== undefined && (
        input.assetIds.length !== post.assets.length ||
        input.assetIds.some((assetId) => !post.assets.some((asset) => asset.id === assetId))
      ));

    let modStatus = post.moderationStatus;
    let moderationReasonCode = post.moderationReasonCode;
    let decisionCreate: Prisma.MarketplaceModerationDecisionCreateWithoutPostInput | undefined;

    if (materialChanged) {
      const candidate = {
        title: input.title ?? post.title,
        description: input.description ?? post.description,
        category: input.category ?? post.category,
        location: input.location ?? post.location
      };
      const result = contentModerationService.evaluate(contentForModeration(candidate), 'MARKETPLACE');
      const cleanContentRequiresReview = result.decision === 'ALLOW';

      // Clean edits still require a human to restore public visibility.
      modStatus = result.decision === 'BLOCK' ? ModerationStatus.REJECTED : ModerationStatus.PENDING_REVIEW;
      moderationReasonCode = result.categories[0] ?? 'CONTENT_CHANGED';
      decisionCreate = {
        status: modStatus,
        reason: result.categories.length ? result.categories.join(", ") : "Material content changed",
        ruleId: cleanContentRequiresReview
          ? 'MATERIAL_CHANGE_REVIEW'
          : result.ruleId,
        ruleVersion: cleanContentRequiresReview
          ? 'marketplace-edit-1'
          : result.ruleVersion,
        policyVersion: result.policyVersion,
        domain: result.domain,
        severity: cleanContentRequiresReview ? 'MEDIUM' : result.severity,
        contentHash: result.contentHash,
        categories: cleanContentRequiresReview ? [moderationReasonCode] : result.categories
      };
    }

    const { assetIds, ...postInput } = input;
    const selectedAssetIds = assetIds ?? post.assets.map((asset) => asset.id);
    const removedAssetIds = post.assets.filter((asset) => !selectedAssetIds.includes(asset.id)).map((asset) => asset.id);
    const updated = await prisma.$transaction(async (tx) => {
      await attachAssets(tx, post.userId, post.id, selectedAssetIds);
      if (removedAssetIds.length) {
        await tx.marketplaceAsset.updateMany({
          where: { id: { in: removedAssetIds }, postId: post.id },
          data: { postId: null, status: MarketplaceAssetStatus.DELETE_PENDING, url: null, deletionRequestedAt: new Date() }
        });
      }
      return tx.marketplacePost.update({
        where: { id: post.id },
        data: {
          ...postInput,
          category: input.category as any,
          ...(input.whatsapp !== undefined ? { whatsapp: normalizeWhatsapp(input.whatsapp) } : {}),
          moderationStatus: modStatus,
          moderationReasonCode,
          ...(decisionCreate ? { decisions: { create: decisionCreate } } : {})
        },
        include: { user: { select: userSelect }, assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await marketplaceAssetService.cleanupAssetsById(removedAssetIds).catch(() => {
      logger.warn({ assetCount: removedAssetIds.length }, "La limpieza inmediata de assets reemplazados quedó pendiente");
    });
    return presentMarketplacePost(updated);
  },

  async remove(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id },
      include: { assets: { select: { id: true } } }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar esta publicacion");
    }

    const assetIds = post.assets.map((asset) => asset.id);
    await prisma.$transaction(async (tx) => {
      await tx.marketplaceAsset.updateMany({
        where: { postId: post.id },
        data: { postId: null, status: MarketplaceAssetStatus.DELETE_PENDING, url: null, deletionRequestedAt: new Date() }
      });
      await tx.marketplacePost.delete({ where: { id: post.id } });
    });
    await marketplaceAssetService.cleanupAssetsById(assetIds).catch(() => {
      logger.warn({ assetCount: assetIds.length }, "La limpieza inmediata de assets eliminados quedó pendiente");
    });
  },

  async report(barrioSlug: string, postId: string, requesterId: string, input: { category: string; comment?: string }) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: {
        id: postId,
        barrioId: barrio.id,
        availability: MarketplaceAvailability.AVAILABLE,
        moderationStatus: ModerationStatus.APPROVED
      }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId === requesterId) {
      throw new ApiError(400, "No podés reportar tu propia publicación");
    }

    const existingReport = await prisma.marketplaceReport.findUnique({
      where: { postId_reporterId: { postId, reporterId: requesterId } }
    });

    if (existingReport) {
      throw new ApiError(409, "Ya reportaste esta publicación");
    }

    await prisma.$transaction(async (tx) => {
      await tx.marketplaceReport.create({
        data: {
          postId,
          reporterId: requesterId,
          category: input.category as any,
          comment: input.comment
        }
      });

      const reportsCount = await tx.marketplaceReport.count({ where: { postId } });

      // Auto-ocultamiento si llega a 3 reportes
      if (reportsCount >= 3 && post.moderationStatus === ModerationStatus.APPROVED) {
        await tx.marketplacePost.update({
          where: { id: postId },
          data: {
            moderationStatus: ModerationStatus.PENDING_REVIEW,
            moderationReasonCode: "REPORT_THRESHOLD"
          }
        });

        await tx.marketplaceModerationDecision.create({
          data: {
            postId,
            status: ModerationStatus.PENDING_REVIEW,
            reason: "Auto-ocultamiento por umbral de reportes (>=3)",
            ruleId: "REPORT_THRESHOLD",
            ruleVersion: "reports-1",
            policyVersion: "reports-1",
            domain: "MARKETPLACE",
            severity: "MEDIUM",
            categories: ["REPORT_THRESHOLD"]
          }
        });
      }
    });
  }
};
