import { MarketplaceAssetStatus, MarketplaceAvailability, ModerationStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";
import { contentModerationService } from "../content-moderation/content-moderation.service";
import { marketplaceAssetService } from "../upload/marketplace-asset.service";
import { logger } from "../../config/logger";
import { env } from "../../config/env";
import { moderationMetrics } from "../../lib/metrics";

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
}> & { expectedVersion: number };

const userSelect = { id: true, nickname: true, avatarUrl: true };
const assetSelect = { id: true, status: true, url: true };

export function presentMarketplacePost<T extends {
  images: string[];
  legacyImages?: string[];
  assets: { id: string; url: string | null }[];
  appeals?: unknown;
  moderationVersion?: number;
  deletedAt?: Date | null;
}>(post: T) {
  const {
    assets,
    images: _legacyImages,
    legacyImages: _restrictedLegacyImages,
    appeals: _appeals,
    moderationVersion: _moderationVersion,
    deletedAt: _deletedAt,
    ...rest
  } = post;
  return {
    ...rest,
    images: assets.flatMap((asset) => asset.url ? [asset.url] : []),
    assetIds: assets.map((asset) => asset.id)
  };
}

function presentMarketplaceOwnerPost<T extends {
  images: string[];
  legacyImages?: string[];
  assets: { id: string; status: MarketplaceAssetStatus; url: string | null }[];
  appeals?: { id: string; status: string; statement: string; createdAt: Date }[];
  moderationVersion: number;
}>(post: T) {
  const { appeals, ...postWithoutAppeals } = post;
  return {
    ...presentMarketplacePost(postWithoutAppeals),
    moderationVersion: post.moderationVersion,
    currentAppeal: appeals?.[0] ?? null,
    managedAssets: post.assets.map((asset) => ({ id: asset.id, status: asset.status, url: asset.url }))
  };
}

async function loadAttachableAssets(
  tx: Prisma.TransactionClient,
  uploaderId: string,
  barrioId: string,
  postId: string | null,
  assetIds: string[]
) {
  if (assetIds.length === 0) return [];
  const assets = await tx.marketplaceAsset.findMany({ where: { id: { in: assetIds } } });
  const valid = assets.length === assetIds.length && assets.every((asset) => {
    const approved = asset.status === MarketplaceAssetStatus.APPROVED
      && Boolean(asset.url && asset.cloudinaryPublicId && asset.cloudinaryType === "upload");
    const quarantined = asset.status === MarketplaceAssetStatus.QUARANTINED
      && Boolean(!asset.url && asset.cloudinaryPublicId && asset.cloudinaryType === "authenticated");
    return asset.uploaderId === uploaderId
      && (approved || quarantined)
      && (asset.barrioId === null || asset.barrioId === barrioId)
      && (asset.postId === null || asset.postId === postId);
  });
  if (!valid) {
    throw new ApiError(400, "Los assets deben pertenecer al autor y estar aprobados o en cuarentena privada");
  }
  return assets;
}

async function attachAssets(
  tx: Prisma.TransactionClient,
  uploaderId: string,
  barrioId: string,
  postId: string,
  assetIds: string[]
) {
  const assets = await loadAttachableAssets(tx, uploaderId, barrioId, postId, assetIds);
  if (assets.length === 0) return { hasQuarantined: false };

  const attached = await tx.marketplaceAsset.updateMany({
    where: {
      id: { in: assetIds }, uploaderId,
      status: { in: [MarketplaceAssetStatus.APPROVED, MarketplaceAssetStatus.QUARANTINED] },
      AND: [
        { OR: [{ barrioId: null }, { barrioId }] },
        { OR: [{ postId: null }, { postId }] }
      ]
    },
    data: { postId, barrioId, deletionRequestedAt: null }
  });
  if (attached.count !== assetIds.length) throw new ApiError(409, "Alguno de los assets ya fue utilizado");
  return { hasQuarantined: assets.some((a) => a.status === MarketplaceAssetStatus.QUARANTINED) };
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

async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
}

function contentForModeration(post: { title: string; description: string; category: string; location?: string | null }) {
  return [post.title, post.description, post.category, post.location].filter(Boolean).join("\n");
}

// Reglas en shadow mode que coincidieron: quedan en la decisión para medir falsos positivos.
function shadowEvidence(result: { shadowMatches: { ruleId: string }[] }) {
  return result.shadowMatches.length ? { evidence: { shadowRuleIds: result.shadowMatches.map((match) => match.ruleId) } } : {};
}

function initialModerationStatus(decision: "ALLOW" | "REVIEW" | "BLOCK") {
  if (decision === "BLOCK") return ModerationStatus.REJECTED;
  if (decision === "REVIEW") return ModerationStatus.PENDING_REVIEW;
  return ModerationStatus.APPROVED;
}

function marketplaceReasonCode(categories: string[], fallback: "CONTENT_CORRECTED" | "OTHER_POLICY") {
  if (categories.includes("DRUGS")) return "PROHIBITED_ITEM";
  if (categories.includes("WEAPONS")) return "REGULATED_ITEM";
  if (categories.includes("INSULT")) return "INAPPROPRIATE_CONTENT";
  return categories.length ? "OTHER_POLICY" : fallback;
}

export const marketplaceService = {
  async list(barrioSlug: string, opts: { category?: string; page: number; limit: number }) {
    const barrio = await resolveBarrio(barrioSlug);
    const skip = (opts.page - 1) * opts.limit;

    const where = {
      barrioId: barrio.id,
      deletedAt: null,
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
      deletedAt: null,
      userId
    };

    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: userSelect },
          assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          appeals: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" } }
        }
      }),
      prisma.marketplacePost.count({ where })
    ]);

    return { items: items.map(presentMarketplaceOwnerPost), total, page: opts.page, limit: opts.limit };
  },

  async getById(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id, deletedAt: null },
      include: {
        user: { select: userSelect },
        assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        appeals: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" } }
      }
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
      include: {
        user: { select: userSelect },
        assets: { select: assetSelect, orderBy: { createdAt: "asc" } },
        appeals: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" } }
      }
    });
    return isOwnerOrModerator ? presentMarketplaceOwnerPost(updated) : presentMarketplacePost(updated);
  },

  async create(barrioSlug: string, userId: string, input: CreatePostInput) {
    const barrio = await resolveBarrio(barrioSlug);

    const { assetIds, ...postInput } = input;
    const moderationResult = contentModerationService.evaluate(contentForModeration(input), 'MARKETPLACE');
    const automaticStatus = initialModerationStatus(moderationResult.decision);
    const automaticReasonCode = moderationResult.decision === "ALLOW"
      ? null
      : marketplaceReasonCode(moderationResult.categories, "OTHER_POLICY");

    const post = await serializable(async (tx) => {
      const requestedAssets = await loadAttachableAssets(tx, userId, barrio.id, null, assetIds);
      const hasQuarantined = requestedAssets.some((asset) => asset.status === MarketplaceAssetStatus.QUARANTINED);
      const moderationStatus = hasQuarantined && automaticStatus === ModerationStatus.APPROVED
        ? ModerationStatus.PENDING_REVIEW
        : automaticStatus;
      const moderationReasonCode = hasQuarantined && automaticStatus === ModerationStatus.APPROVED
        ? "IMAGE_POLICY"
        : automaticReasonCode;
      const created = await tx.marketplacePost.create({
        data: {
          ...postInput,
          images: [],
          category: input.category as any,
          whatsapp: normalizeWhatsapp(input.whatsapp),
          userId,
          barrioId: barrio.id,
          moderationStatus,
          moderationReasonCode,
          decisions: {
            create: {
              action: "AUTO_REVIEW",
              status: moderationStatus,
              reasonCode: moderationReasonCode,
              toVersion: 0,
              reason: moderationReasonCode ?? "Automated approval",
              ruleId: moderationResult.ruleId,
              ruleVersion: moderationResult.ruleVersion,
              policyVersion: moderationResult.policyVersion,
              domain: moderationResult.domain,
              severity: moderationResult.severity,
              contentHash: moderationResult.contentHash,
              ...shadowEvidence(moderationResult),
              categories: moderationReasonCode === "IMAGE_POLICY"
                ? ["IMAGE_POLICY"]
                : moderationResult.categories
            }
          }
        },
        include: { user: { select: userSelect } }
      });
      await attachAssets(tx, userId, barrio.id, created.id, assetIds);
      return tx.marketplacePost.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          user: { select: userSelect },
          assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          appeals: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" } }
        }
      });
    });
    return presentMarketplaceOwnerPost(post);
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
      where: { id: postId, barrioId: barrio.id, deletedAt: null },
      include: { assets: { select: { id: true, url: true, cloudinaryPublicId: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.moderationVersion !== input.expectedVersion) {
      throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
    }

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
    let decisionCreate: Prisma.MarketplaceModerationDecisionUncheckedCreateWithoutPostInput | undefined;

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
      moderationReasonCode = marketplaceReasonCode(result.categories, 'CONTENT_CORRECTED');
      decisionCreate = {
        action: 'OWNER_RESUBMIT',
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
        reasonCode: moderationReasonCode,
        contentHash: result.contentHash,
        ...shadowEvidence(result),
        categories: cleanContentRequiresReview ? [moderationReasonCode] : result.categories
      };
    }

    const { assetIds, expectedVersion, ...postInput } = input;
    const selectedAssetIds = assetIds ?? post.assets.map((asset) => asset.id);
    const removedAssetIds = post.assets.filter((asset) => !selectedAssetIds.includes(asset.id)).map((asset) => asset.id);
    const updated = await serializable(async (tx) => {
      const { hasQuarantined } = await attachAssets(tx, post.userId, post.barrioId, post.id, selectedAssetIds);

      if (hasQuarantined && modStatus === ModerationStatus.APPROVED) {
        modStatus = ModerationStatus.PENDING_REVIEW;
        moderationReasonCode = 'IMAGE_POLICY';
        if (decisionCreate) {
          decisionCreate.status = modStatus;
          decisionCreate.reasonCode = moderationReasonCode;
          decisionCreate.categories = [moderationReasonCode];
        }
      }

      if (removedAssetIds.length) {
        await tx.marketplaceAsset.updateMany({
          where: { id: { in: removedAssetIds }, postId: post.id },
          data: { postId: null, status: MarketplaceAssetStatus.DELETE_PENDING, url: null, deletionRequestedAt: new Date() }
        });
      }
      if (materialChanged) {
        await tx.marketplaceAppeal.updateMany({
          where: { postId: post.id, status: 'PENDING' },
          data: { status: 'SUPERSEDED', updatedAt: new Date() }
        });
      }

      const changed = await tx.marketplacePost.updateMany({
        where: { id: post.id, moderationVersion: expectedVersion, deletedAt: null },
        data: {
          ...postInput,
          category: input.category as any,
          ...(input.whatsapp !== undefined ? { whatsapp: normalizeWhatsapp(input.whatsapp) } : {}),
          moderationStatus: modStatus,
          moderationReasonCode,
          moderationVersion: { increment: 1 },
        }
      });
      if (changed.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
      if (decisionCreate) {
        await tx.marketplaceModerationDecision.create({
          data: {
            ...decisionCreate,
            postId: post.id,
            fromStatus: post.moderationStatus,
            fromVersion: expectedVersion,
            toVersion: expectedVersion + 1
          }
        });
      }
      return tx.marketplacePost.findUniqueOrThrow({
        where: { id: post.id },
        include: {
          user: { select: userSelect },
          assets: { select: assetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          appeals: { where: { status: "PENDING" }, take: 1, orderBy: { createdAt: "desc" } }
        }
      });
    });
    await marketplaceAssetService.cleanupAssetsById(removedAssetIds).catch(() => {
      logger.warn({ assetCount: removedAssetIds.length }, "La limpieza inmediata de assets reemplazados quedó pendiente");
    });
    return presentMarketplaceOwnerPost(updated);
  },

  async remove(barrioSlug: string, postId: string, requesterId: string, requesterRole: UserRole) {
    const barrio = await resolveBarrio(barrioSlug);

    const post = await prisma.marketplacePost.findFirst({
      where: { id: postId, barrioId: barrio.id, deletedAt: null },
      include: { assets: { select: { id: true } } }
    });
    if (!post) throw new ApiError(404, "Publicacion no encontrada");

    if (post.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ApiError(403, "No tienes permisos para eliminar esta publicacion");
    }

    const assetIds = post.assets.map((asset) => asset.id);
    await serializable(async (tx) => {
      const removed = await tx.marketplacePost.updateMany({
        where: { id: post.id, moderationVersion: post.moderationVersion, deletedAt: null },
        data: { deletedAt: new Date(), moderationVersion: { increment: 1 } }
      });
      if (removed.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
      await tx.marketplaceAsset.updateMany({
        where: { postId: post.id },
        data: { postId: null, status: MarketplaceAssetStatus.DELETE_PENDING, url: null, deletionRequestedAt: new Date() }
      });
    });
    await marketplaceAssetService.cleanupAssetsById(assetIds).catch(() => {
      logger.warn({ assetCount: assetIds.length }, "La limpieza inmediata de assets eliminados quedó pendiente");
    });
  },

  async report(barrioSlug: string, postId: string, requesterId: string, input: { category: string; comment?: string }) {
    const barrio = await resolveBarrio(barrioSlug);

    try {
      await serializable(async (tx) => {
        const [lockedPost] = await tx.$queryRaw<{
          id: string;
          userId: string;
          barrioId: string;
          availability: MarketplaceAvailability;
          moderationStatus: ModerationStatus;
          moderationVersion: number;
          deletedAt: Date | null;
        }[]>`
        SELECT id, "userId", "barrioId", availability, "moderationStatus", "moderationVersion", "deletedAt"
        FROM "MarketplacePost"
        WHERE id = ${postId} FOR UPDATE
      `;
        if (!lockedPost
          || lockedPost.barrioId !== barrio.id
          || lockedPost.deletedAt
          || lockedPost.availability !== MarketplaceAvailability.AVAILABLE
          || lockedPost.moderationStatus !== ModerationStatus.APPROVED) {
          throw new ApiError(404, "Publicacion no encontrada");
        }
        if (lockedPost.userId === requesterId) throw new ApiError(400, "No podés reportar tu propia publicación");

        moderationMetrics.reports.inc({ domain: "MARKETPLACE", category: input.category });
        await tx.marketplaceReport.create({
          data: { postId, reporterId: requesterId, category: input.category as any, comment: input.comment }
        });

        const reportsCount = await tx.marketplaceReport.count({ where: { postId, status: "OPEN" } });
        if (reportsCount >= env.MARKETPLACE_REPORT_THRESHOLD) {
          const hidden = await tx.marketplacePost.updateMany({
            where: { id: postId, moderationVersion: lockedPost.moderationVersion, moderationStatus: ModerationStatus.APPROVED, deletedAt: null },
            data: {
              moderationStatus: ModerationStatus.PENDING_REVIEW,
              moderationReasonCode: "REPORT_REVIEW",
              moderationVersion: { increment: 1 }
            }
          });
          if (hidden.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
          await tx.marketplaceModerationDecision.create({
            data: {
              postId,
              action: "REPORT_THRESHOLD",
              status: ModerationStatus.PENDING_REVIEW,
              fromStatus: ModerationStatus.APPROVED,
              fromVersion: lockedPost.moderationVersion,
              toVersion: lockedPost.moderationVersion + 1,
              reasonCode: "REPORT_REVIEW",
              reason: "Auto-ocultamiento por umbral de reportes",
              ruleId: "REPORT_THRESHOLD",
              ruleVersion: "reports-2",
              policyVersion: "marketplace-review-2",
              domain: "MARKETPLACE",
              severity: "MEDIUM",
              categories: ["REPORT_THRESHOLD"],
              evidence: { openReports: reportsCount }
            }
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "ALREADY_REPORTED");
      }
      throw error;
    }
  },

  async appeal(barrioSlug: string, postId: string, requesterId: string, input: { statement: string, expectedVersion: number, idempotencyKey: string }) {
    const barrio = await resolveBarrio(barrioSlug);
    try {
      await serializable(async (tx) => {
        const byKey = await tx.marketplaceAppeal.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (byKey) {
          if (byKey.postId === postId
            && byKey.ownerId === requesterId
            && byKey.statement === input.statement
            && byKey.postVersion === input.expectedVersion) return;
          throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
        }

        const [post] = await tx.$queryRaw<{
          id: string;
          userId: string;
          barrioId: string;
          moderationStatus: ModerationStatus;
          moderationVersion: number;
          deletedAt: Date | null;
        }[]>`
          SELECT id, "userId", "barrioId", "moderationStatus", "moderationVersion", "deletedAt"
          FROM "MarketplacePost"
          WHERE id = ${postId} FOR UPDATE
        `;
        if (!post || post.barrioId !== barrio.id || post.deletedAt) throw new ApiError(404, "Publicacion no encontrada");
        if (post.userId !== requesterId) throw new ApiError(403, "Solo el propietario puede apelar");
        if (post.moderationStatus !== ModerationStatus.REJECTED && post.moderationStatus !== ModerationStatus.REMOVED) {
          throw new ApiError(409, "INVALID_APPEAL_STATE");
        }
        if (post.moderationVersion !== input.expectedVersion) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

        const againstDecision = await tx.marketplaceModerationDecision.findFirst({
          where: { postId },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        await tx.marketplaceAppeal.create({
          data: {
            postId,
            ownerId: requesterId,
            statement: input.statement,
            idempotencyKey: input.idempotencyKey,
            postVersion: input.expectedVersion,
            againstDecisionId: againstDecision?.id,
            status: "PENDING"
          }
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const byKey = await prisma.marketplaceAppeal.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (byKey?.postId === postId
          && byKey.ownerId === requesterId
          && byKey.statement === input.statement
          && byKey.postVersion === input.expectedVersion) return;
        throw new ApiError(409, "APPEAL_ALREADY_PENDING");
      }
      throw error;
    }
  }
};
