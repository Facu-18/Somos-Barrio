import {
  MarketplaceAssetStatus,
  MarketplaceModerationAction,
  ModerationStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { moderationMetrics } from "../../lib/metrics";
import { ApiError } from "../../utils/api-error";
import { marketplaceAssetService } from "../upload/marketplace-asset.service";
import { ModerateMarketplaceAssetDecisionInput, ModerateMarketplaceDecisionInput } from "./moderation.schema";
import { assertBarrioAccess, getModerator, resolveQueueBarrio, serializable } from "./moderation.access";

type QueueName = "PENDING_REVIEW" | "REPORTED" | "REJECTED" | "REMOVED" | "APPEALED" | "DELETED";

const publicAssetSelect = { id: true, status: true, url: true } as const;

function postDecisionMatches(
  decision: {
    postId: string;
    moderatorId: string | null;
    action: MarketplaceModerationAction | null;
    reasonCode: string | null;
    privateNote: string | null;
    fromVersion: number | null;
  },
  userId: string,
  postId: string,
  input: ModerateMarketplaceDecisionInput
) {
  const expectedActions: MarketplaceModerationAction[] = input.decision === "APPROVE"
    ? [MarketplaceModerationAction.APPROVE, MarketplaceModerationAction.APPEAL_ACCEPT]
    : input.decision === "REJECT"
      ? [MarketplaceModerationAction.REJECT, MarketplaceModerationAction.APPEAL_REJECT]
      : [input.decision as MarketplaceModerationAction];
  return decision.postId === postId
    && decision.moderatorId === userId
    && decision.action !== null
    && expectedActions.includes(decision.action)
    && decision.reasonCode === input.reasonCode
    && decision.privateNote === (input.privateNote ?? null)
    && decision.fromVersion === input.expectedVersion;
}

function assetDecisionMatches(
  decision: {
    assetId: string;
    moderatorId: string | null;
    action: "APPROVE" | "REJECT";
    reasonCode: string | null;
    privateNote: string | null;
    fromVersion: number | null;
  },
  userId: string,
  assetId: string,
  input: ModerateMarketplaceAssetDecisionInput
) {
  return decision.assetId === assetId
    && decision.moderatorId === userId
    && decision.action === input.decision
    && decision.reasonCode === input.reasonCode
    && decision.privateNote === (input.privateNote ?? null)
    && decision.fromVersion === input.expectedVersion;
}

function presentModerationPost(post: any) {
  const { assets, images: _images, ...rest } = post;
  return {
    ...rest,
    images: assets.flatMap((asset: { status: MarketplaceAssetStatus; url: string | null }) =>
      asset.status === MarketplaceAssetStatus.APPROVED && asset.url ? [asset.url] : []
    ),
    assetIds: assets.map((asset: { id: string }) => asset.id),
    managedAssets: assets.map((asset: { id: string; status: MarketplaceAssetStatus }) => ({
      id: asset.id,
      status: asset.status
    }))
  };
}

function transitionFor(
  current: ModerationStatus,
  decision: ModerateMarketplaceDecisionInput["decision"],
  hasPendingAppeal: boolean
): { status: ModerationStatus; action: MarketplaceModerationAction } {
  if (hasPendingAppeal && (current === ModerationStatus.REJECTED || current === ModerationStatus.REMOVED)) {
    if (decision === "APPROVE") {
      return { status: ModerationStatus.APPROVED, action: MarketplaceModerationAction.APPEAL_ACCEPT };
    }
    if (decision === "REJECT") {
      return { status: current, action: MarketplaceModerationAction.APPEAL_REJECT };
    }
  }

  if (decision === "APPROVE" && (current === ModerationStatus.PENDING_REVIEW || current === ModerationStatus.REJECTED)) {
    return { status: ModerationStatus.APPROVED, action: MarketplaceModerationAction.APPROVE };
  }
  if (decision === "REJECT" && current === ModerationStatus.PENDING_REVIEW) {
    return { status: ModerationStatus.REJECTED, action: MarketplaceModerationAction.REJECT };
  }
  if (decision === "REMOVE" && current !== ModerationStatus.REMOVED) {
    return { status: ModerationStatus.REMOVED, action: MarketplaceModerationAction.REMOVE };
  }
  if (decision === "RESTORE" && current === ModerationStatus.REMOVED) {
    return { status: ModerationStatus.APPROVED, action: MarketplaceModerationAction.RESTORE };
  }
  throw new ApiError(409, "INVALID_MODERATION_TRANSITION");
}

export const moderationService = {
  async getMarketplaceQueue(
    userId: string,
    opts: { queue?: QueueName; barrioSlug?: string; page: number; limit: number }
  ) {
    const user = await getModerator(userId);
    const barrioId = await resolveQueueBarrio(user, opts.barrioSlug);
    const where: Prisma.MarketplacePostWhereInput = {
      ...(barrioId ? { barrioId } : {}),
      ...(opts.queue === "DELETED" ? { deletedAt: { not: null } } : { deletedAt: null })
    };

    if (opts.queue === "REPORTED") where.reports = { some: { status: "OPEN" } };
    else if (opts.queue === "APPEALED") where.appeals = { some: { status: "PENDING" } };
    else if (opts.queue && opts.queue !== "DELETED") where.moderationStatus = opts.queue;
    else if (!opts.queue) where.moderationStatus = { in: [ModerationStatus.PENDING_REVIEW, ModerationStatus.REJECTED] };

    const skip = (opts.page - 1) * opts.limit;
    const include = {
      user: { select: { id: true, name: true, email: true, nickname: true } },
      barrio: { select: { id: true, name: true, slug: true } },
      reports: {
        where: { status: "OPEN" as const },
        select: { id: true, category: true, comment: true, createdAt: true, reporter: { select: { name: true } } }
      },
      appeals: { where: { status: "PENDING" as const }, select: { id: true, statement: true, createdAt: true } },
      decisions: {
        orderBy: { createdAt: "desc" as const },
        select: { id: true, action: true, reasonCode: true, privateNote: true, status: true, fromVersion: true, toVersion: true, ruleId: true, ruleVersion: true, policyVersion: true, moderator: { select: { name: true } }, createdAt: true }
      },
      assets: { select: publicAssetSelect, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] }
    };
    const [items, total] = await Promise.all([
      prisma.marketplacePost.findMany({ where, skip, take: opts.limit, orderBy: { updatedAt: "desc" }, include }),
      prisma.marketplacePost.count({ where })
    ]);
    return { items: items.map(presentModerationPost), total, page: opts.page, limit: opts.limit };
  },

  async moderateMarketplacePost(userId: string, postId: string, input: ModerateMarketplaceDecisionInput) {
    const user = await getModerator(userId);

    const apply = () => serializable(async (tx) => {
      const existing = await tx.marketplaceModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (!postDecisionMatches(existing, userId, postId, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
        const post = await tx.marketplacePost.findUniqueOrThrow({
          where: { id: postId },
          include: { assets: { select: publicAssetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
        });
        return presentModerationPost(post);
      }

      const post = await tx.marketplacePost.findUnique({
        where: { id: postId },
        include: {
          assets: { select: publicAssetSelect },
          appeals: { where: { status: "PENDING" }, take: 1 }
        }
      });
      if (!post || post.deletedAt) throw new ApiError(404, "Publicación no encontrada");
      assertBarrioAccess(user, post.barrioId);
      if (post.moderationVersion !== input.expectedVersion) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

      const pendingAppeal = post.appeals[0];
      const transition = transitionFor(post.moderationStatus, input.decision, Boolean(pendingAppeal));
      if (transition.status === ModerationStatus.APPROVED && post.userId === userId) {
        throw new ApiError(403, "No podés aprobar tu propia publicación");
      }
      if (transition.status === ModerationStatus.APPROVED && post.assets.some((asset) => asset.status !== MarketplaceAssetStatus.APPROVED)) {
        throw new ApiError(409, "POST_HAS_UNAPPROVED_ASSETS");
      }

      const updated = await tx.marketplacePost.updateMany({
        where: { id: postId, moderationVersion: input.expectedVersion, deletedAt: null },
        data: {
          moderationStatus: transition.status,
          moderationReasonCode: transition.status === ModerationStatus.APPROVED ? null : input.reasonCode,
          moderationVersion: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

      const moderationDecision = await tx.marketplaceModerationDecision.create({
        data: {
          postId,
          moderatorId: userId,
          action: transition.action,
          status: transition.status,
          fromStatus: post.moderationStatus,
          fromVersion: input.expectedVersion,
          toVersion: input.expectedVersion + 1,
          reasonCode: input.reasonCode,
          privateNote: input.privateNote,
          idempotencyKey: input.idempotencyKey,
          appealId: pendingAppeal?.id,
          ruleId: "MANUAL_REVIEW",
          ruleVersion: "manual-2",
          policyVersion: "marketplace-review-2",
          domain: "MARKETPLACE",
          severity: transition.status === ModerationStatus.APPROVED ? "NONE" : "HIGH",
          categories: [input.reasonCode]
        }
      });

      moderationMetrics.manualDecisions.inc({ domain: "MARKETPLACE", action: transition.action });

      await tx.marketplaceReport.updateMany({
        where: { postId, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId, resolutionDecisionId: moderationDecision.id }
      });
      if (pendingAppeal) {
        await tx.marketplaceAppeal.update({
          where: { id: pendingAppeal.id },
          data: {
            status: transition.action === MarketplaceModerationAction.APPEAL_ACCEPT ? "ACCEPTED" : "REJECTED",
            resolvedAt: new Date(),
            resolvedById: userId,
            resolutionDecisionId: moderationDecision.id
          }
        });
      }

      const result = await tx.marketplacePost.findUniqueOrThrow({
        where: { id: postId },
        include: { assets: { select: publicAssetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
      });
      return presentModerationPost(result);
    });

    try {
      return await apply();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.marketplaceModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (existing && postDecisionMatches(existing, userId, postId, input)) {
          const post = await prisma.marketplacePost.findUniqueOrThrow({
            where: { id: postId },
            include: { assets: { select: publicAssetSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }
          });
          return presentModerationPost(post);
        }
      }
      throw error;
    }
  },

  async getMarketplaceAssetQueue(
    userId: string,
    opts: { status: MarketplaceAssetStatus; barrioSlug?: string; page: number; limit: number }
  ) {
    const user = await getModerator(userId);
    const barrioId = await resolveQueueBarrio(user, opts.barrioSlug);
    const where: Prisma.MarketplaceAssetWhereInput = {
      status: opts.status,
      postId: { not: null },
      ...(barrioId ? { barrioId } : user.role === UserRole.EDITOR ? { barrioId: user.barrioId! } : {})
    };
    const skip = (opts.page - 1) * opts.limit;
    const [items, total] = await Promise.all([
      prisma.marketplaceAsset.findMany({
        where,
        skip,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          mimeType: true,
          byteSize: true,
          moderationVersion: true,
          scores: true,
          ocrCategories: true,
          createdAt: true,
          uploader: { select: { id: true, name: true, email: true } },
          post: { select: { id: true, title: true, barrioId: true } },
          reviewDecisions: {
            orderBy: { createdAt: "desc" },
            select: { action: true, reasonCode: true, privateNote: true, moderator: { select: { name: true } }, createdAt: true }
          },
          cloudinaryPublicId: true
        }
      }),
      prisma.marketplaceAsset.count({ where })
    ]);
    return {
      items: items.map(({ cloudinaryPublicId, ...item }) => ({
        ...item,
        previewUrl: item.status === MarketplaceAssetStatus.QUARANTINED && cloudinaryPublicId
          ? marketplaceAssetService.getSignedUrl(cloudinaryPublicId)
          : null
      })),
      total,
      page: opts.page,
      limit: opts.limit
    };
  },

  async moderateMarketplaceAsset(userId: string, assetId: string, input: ModerateMarketplaceAssetDecisionInput) {
    const user = await getModerator(userId);
    const targetStatus = input.decision === "APPROVE"
      ? MarketplaceAssetStatus.PROMOTION_PENDING
      : MarketplaceAssetStatus.REJECTION_PENDING;
    const finalStatus = input.decision === "APPROVE"
      ? MarketplaceAssetStatus.APPROVED
      : MarketplaceAssetStatus.REJECTED;

    const claim = () => serializable(async (tx) => {
      const existing = await tx.marketplaceAssetModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (!assetDecisionMatches(existing, userId, assetId, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
        return;
      }

      const asset = await tx.marketplaceAsset.findUnique({ where: { id: assetId } });
      if (!asset) throw new ApiError(404, "Asset no encontrado");
      assertBarrioAccess(user, asset.barrioId);
      if (asset.moderationVersion !== input.expectedVersion) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");
      if (asset.status !== MarketplaceAssetStatus.QUARANTINED) throw new ApiError(409, "INVALID_ASSET_TRANSITION");

      const claimed = await tx.marketplaceAsset.updateMany({
        where: { id: assetId, moderationVersion: input.expectedVersion, status: MarketplaceAssetStatus.QUARANTINED },
        data: { status: targetStatus, moderationVersion: { increment: 1 } }
      });
      if (claimed.count !== 1) throw new ApiError(409, "MODERATION_VERSION_CONFLICT");

      await tx.marketplaceAssetModerationDecision.create({
        data: {
          assetId,
          moderatorId: userId,
          action: input.decision,
          reasonCode: input.reasonCode,
          privateNote: input.privateNote,
          fromStatus: MarketplaceAssetStatus.QUARANTINED,
          toStatus: finalStatus,
          fromVersion: input.expectedVersion,
          toVersion: input.expectedVersion + 1,
          idempotencyKey: input.idempotencyKey,
          policyVersion: "marketplace-asset-review-1"
        }
      });
    });

    try {
      await claim();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.marketplaceAssetModerationDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (!existing || !assetDecisionMatches(existing, userId, assetId, input)) throw new ApiError(409, "IDEMPOTENCY_KEY_IN_USE");
      } else {
        throw error;
      }
    }

    const reconciled = await marketplaceAssetService.reconcileReviewAsset(assetId);
    if (!reconciled) throw new ApiError(502, "ASSET_REVIEW_PENDING_RETRY");
    return reconciled;
  }
};
